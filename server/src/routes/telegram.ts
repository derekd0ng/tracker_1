import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const BOT_TOKEN    = () => process.env.TELEGRAM_BOT_TOKEN ?? '';
const WH_SECRET    = () => process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const ANTHROPIC_KEY = () => process.env.ANTHROPIC_API_KEY ?? '';
const GROQ_KEY     = () => process.env.GROQ_API_KEY ?? '';

const SYMPTOM_NAMES = [
  'Dizziness', 'Brain Fog', 'Headache', 'Fatigue', 'Nausea',
  'Vision Problems', 'Weakness', 'Numbness', 'Ear Ringing',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function transcribeVoice(fileId: string): Promise<string> {
  const fileRes = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN()}/getFile?file_id=${fileId}`,
  );
  const fileData = (await fileRes.json()) as any;
  const filePath: string | undefined = fileData.result?.file_path;
  if (!filePath) throw new Error('Could not get file path from Telegram');

  const dlRes  = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN()}/${filePath}`);
  const buffer = Buffer.from(await dlRes.arrayBuffer());

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: 'audio/ogg' }), 'voice.ogg');
  formData.append('model', 'whisper-large-v3-turbo');

  const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY()}` },
    body: formData,
  });
  const whisperData = (await whisperRes.json()) as any;
  return (whisperData.text ?? '') as string;
}

async function parseWellbeing(text: string): Promise<any> {
  const prompt = `Parse the following health update into a structured wellbeing entry.
Return ONLY valid JSON with these fields (use null for anything not mentioned):
{
  "overallFeel": number | null,
  "heartRate": number | null,
  "systolicBP": number | null,
  "diastolicBP": number | null,
  "spo2": number | null,
  "symptoms": [{"name": string, "intensity": number, "duration": string | null}],
  "notes": string | null
}
overallFeel is 1-10. symptom intensity is 1-10.
Valid symptom names (use exact spelling): ${SYMPTOM_NAMES.join(', ')}.
For duration use short human-readable format e.g. "10 min", "2 h", "all day". Use null if not mentioned.
Text: "${text}"`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY(),
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = (await res.json()) as any;
  const raw: string = data.content?.[0]?.text ?? '{}';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in Claude response');
  return JSON.parse(match[0]);
}

const TZ = process.env.REMINDER_TIMEZONE ?? 'UTC';

function localDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}
function localTime(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmt12(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

async function parseCalendarIntent(text: string, today: string): Promise<{
  action: 'add' | 'list' | 'none';
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  rangeStart?: string;
  rangeEnd?: string;
} | null> {
  try {
    const prompt = `Today is ${today}. Determine if the following message is about calendar events.
Return ONLY valid JSON:
{
  "action": "add" | "list" | "none",
  "title": string | null,
  "date": "YYYY-MM-DD" | null,
  "startTime": "HH:MM" | null,
  "endTime": "HH:MM" | null,
  "description": string | null,
  "rangeStart": "YYYY-MM-DD" | null,
  "rangeEnd": "YYYY-MM-DD" | null
}
- "add" if the user wants to create/schedule an event or appointment
- "list" if the user wants to see events (rangeStart/rangeEnd = date range to show; null = next 7 days)
- "none" if it's a health update, to-do, or something else
For relative dates ("tomorrow", "next Monday", "this week") resolve to absolute ISO dates from today.
Use 24h HH:MM for times. title should be the clean event name only.
Message: "${text}"`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY(), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = (await res.json()) as any;
    const raw = data.content?.[0]?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch { return null; }
}

async function getEvents(userId: string, from: string, to: string) {
  const { rows } = await pool.query(
    `SELECT title, description,
            TO_CHAR(date,       'YYYY-MM-DD') AS date,
            TO_CHAR(start_time, 'HH24:MI')   AS start_time,
            TO_CHAR(end_time,   'HH24:MI')   AS end_time
     FROM calendar_events
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     ORDER BY date, start_time NULLS LAST`,
    [userId, from, to],
  );
  return rows;
}

async function parseTodoIntent(text: string): Promise<{ action: 'add' | 'done' | 'none'; title?: string } | null> {
  try {
    const prompt = `Determine if the following message is a to-do task action. Return ONLY valid JSON:
{ "action": "add" | "done" | "none", "title": string | null }
- "add" if the user wants to add/create a task (e.g. "add to-do: buy groceries", "remind me to call doctor", "I need to...")
- "done" if the user wants to mark a task as complete (e.g. "done with groceries", "I completed...", "mark ... as done")
- "none" if it's a health update, calendar event/appointment, question, or anything else
IMPORTANT: calendar events, appointments, meetings, and scheduled events are NOT to-dos — return "none" for those.
title should be the clean task text without action words.
Message: "${text}"`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY(), 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 128, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = (await res.json()) as any;
    const raw = data.content?.[0]?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

const SLOT_LABELS: Record<string, string> = {
  morning: '🌅 Morning', afternoon: '☀️ Afternoon', evening: '🌆 Evening', night: '🌙 Night',
};

async function getPendingMeds(userId: string, timeOfDay: string, today: string) {
  const { rows } = await pool.query<{ name: string; dose: string | null }>(
    `-- Natively scheduled meds not yet acted on
     SELECT m.name, m.dose
     FROM medications m
     WHERE m.user_id = $1
       AND m.active  = true
       AND $2 = ANY(m.times_of_day)
       AND (m.start_date IS NULL OR m.start_date <= $3)
       AND (m.duration_days IS NULL OR m.start_date IS NULL
            OR m.start_date::date + (m.duration_days - 1) >= $3::date)
       AND NOT EXISTS (
         SELECT 1 FROM medication_logs ml
         WHERE ml.medication_id = m.id
           AND ml.user_id       = $1
           AND ml.date          = $3
           AND ml.time_of_day   = $2
           AND (ml.taken = true OR ml.skipped = true OR ml.moved_to IS NOT NULL)
       )
     UNION
     -- Meds moved into this slot and not yet taken/skipped
     SELECT m.name, m.dose
     FROM medications m
     JOIN medication_logs ml
       ON  ml.medication_id = m.id
       AND ml.user_id       = $1
       AND ml.date          = $3
       AND ml.moved_to      = $2
     WHERE m.user_id  = $1
       AND m.active   = true
       AND ml.taken   = false
       AND (ml.skipped IS NULL OR ml.skipped = false)
     ORDER BY name`,
    [userId, timeOfDay, today],
  );
  return rows;
}

export async function registerBotCommands() {
  if (!BOT_TOKEN()) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'events',    description: 'Upcoming events (today/tomorrow/week)' },
          { command: 'event',     description: 'Add event: /event Dentist on 2026-05-01 at 14:00' },
          { command: 'todos',     description: 'List pending to-dos' },
          { command: 'todo',      description: 'Add a to-do: /todo buy groceries' },
          { command: 'done',      description: 'Mark to-do done: /done 2' },
          { command: 'meds',      description: 'All pending medications for today' },
          { command: 'morning',   description: 'Pending morning medications' },
          { command: 'afternoon', description: 'Pending afternoon medications' },
          { command: 'evening',   description: 'Pending evening medications' },
          { command: 'night',     description: 'Pending night medications' },
          { command: 'help',      description: 'Show available commands' },
        ],
      }),
    });
    console.log('Telegram bot commands registered');
  } catch (err) {
    console.error('Failed to register bot commands:', err);
  }
}

// ── POST /api/telegram/webhook ─────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (!WH_SECRET() || secret !== WH_SECRET()) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Respond immediately — Telegram requires a fast 200
  res.json({ ok: true });

  const message = req.body?.message;
  if (!message) return;
  const chatId: number = message.chat?.id;
  if (!chatId) return;

  try {
    const text: string | undefined = message.text?.trim();
    const voice = message.voice;

    // ── Linking: /start CODE or plain CODE ──
    const isStartCmd = text?.startsWith('/start');
    const looksLikeCode = text ? /^[0-9a-f]{32}$/i.test(text) : false;
    if (isStartCmd || looksLikeCode) {
      const code = isStartCmd ? text!.split(/\s+/)[1]?.trim() : text!.trim();
      if (!code) {
        await sendMessage(chatId, 'Open the app and tap "Connect Telegram" to get a link code.');
        return;
      }
      const { rows } = await pool.query(
        'SELECT user_id FROM telegram_link_codes WHERE code = $1 AND expires_at > now()',
        [code],
      );
      if (rows.length === 0) {
        await sendMessage(chatId, 'Link code is invalid or expired. Please generate a new one in the app.');
        return;
      }
      const userId: string = rows[0].user_id;
      await pool.query('DELETE FROM telegram_link_codes WHERE code = $1', [code]);
      await pool.query(
        `INSERT INTO telegram_connections (user_id, chat_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET chat_id = EXCLUDED.chat_id, connected_at = now()`,
        [userId, chatId],
      );
      await sendMessage(
        chatId,
        '✅ Connected! Send me a message like:\n"Feel 7/10, headache intensity 4, HR 72, BP 120/80"\nI\'ll log it as a well-being entry.',
      );
      return;
    }

    // ── Look up linked user ──
    const { rows: connRows } = await pool.query(
      'SELECT user_id FROM telegram_connections WHERE chat_id = $1',
      [chatId],
    );
    if (connRows.length === 0) {
      await sendMessage(chatId, 'Your Telegram is not linked. Open the app and tap "Connect Telegram" to link your account.');
      return;
    }
    const userId: string = connRows[0].user_id;

    // ── Commands ──
    if (text?.startsWith('/')) {
      const cmd = text.split(/\s+/)[0].toLowerCase();
      const today = localDate();

      if (cmd === '/help') {
        await sendMessage(chatId,
          'Commands:\n' +
          '/events — upcoming events (next 7 days)\n' +
          '/events today — today\'s events\n' +
          '/events tomorrow — tomorrow\'s events\n' +
          '/event <title> on YYYY-MM-DD at HH:MM — add event\n\n' +
          '/todos — list pending to-dos\n' +
          '/todo <text> — add a new to-do\n' +
          '/done <number> — mark to-do #N as done\n\n' +
          '/meds — all pending medications for today\n' +
          '/morning · /afternoon · /evening · /night — slot meds\n\n' +
          'Or just send a message / voice note:\n' +
          '• "Add event: dentist on Friday at 2pm"\n' +
          '• "What\'s on my calendar tomorrow?"\n' +
          '• "Add to-do: call the bank"\n' +
          '• "Feel 7/10, slight headache" → logs well-being',
        );
        return;
      }

      if (cmd === '/todos') {
        const { rows } = await pool.query(
          `SELECT id, title, due_date FROM todos WHERE user_id = $1 AND done = false ORDER BY created_at DESC`,
          [userId],
        );
        if (rows.length === 0) {
          await sendMessage(chatId, '✅ No pending to-dos!');
        } else {
          const lines = rows.map((r: any, i: number) =>
            `${i + 1}. ${r.title}${r.due_date ? ` (due ${String(r.due_date).slice(0,10)})` : ''}`
          );
          await sendMessage(chatId, `📋 Pending to-dos:\n${lines.join('\n')}`);
        }
        return;
      }

      if (cmd === '/todo') {
        const title = text!.slice('/todo'.length).trim();
        if (!title) {
          await sendMessage(chatId, 'Usage: /todo <task text>');
          return;
        }
        await pool.query(
          `INSERT INTO todos (user_id, title) VALUES ($1, $2)`,
          [userId, title],
        );
        await sendMessage(chatId, `✅ Added: "${title}"`);
        return;
      }

      if (cmd === '/done') {
        const numStr = text!.slice('/done'.length).trim();
        const num = parseInt(numStr, 10);
        if (isNaN(num) || num < 1) {
          await sendMessage(chatId, 'Usage: /done <number> — use /todos to see the list');
          return;
        }
        const { rows } = await pool.query(
          `SELECT id, title FROM todos WHERE user_id = $1 AND done = false ORDER BY created_at DESC`,
          [userId],
        );
        const todo = rows[num - 1];
        if (!todo) {
          await sendMessage(chatId, `No to-do #${num}. Use /todos to see the list.`);
          return;
        }
        await pool.query(`UPDATE todos SET done = true, updated_at = now() WHERE id = $1`, [todo.id]);
        await sendMessage(chatId, `✅ Done: "${todo.title}"`);
        return;
      }

      if (cmd === '/meds') {
        const slots = ['morning', 'afternoon', 'evening', 'night'];
        const lines: string[] = [];
        for (const slot of slots) {
          const meds = await getPendingMeds(userId, slot, today);
          if (meds.length > 0) {
            lines.push(`${SLOT_LABELS[slot]}:`);
            meds.forEach(m => lines.push(`  • ${m.name}${m.dose ? ` — ${m.dose}` : ''}`));
          }
        }
        await sendMessage(chatId, lines.length > 0 ? lines.join('\n') : '✅ All medications done for today!');
        return;
      }

      if (cmd === '/events') {
        const arg = text!.slice('/events'.length).trim(); // optional: "today" / "tomorrow" / date
        let from = today, to = today;
        if (!arg || arg === 'today') {
          to = today;
        } else if (arg === 'tomorrow') {
          const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 1);
          from = to = d.toISOString().slice(0, 10);
        } else if (arg === 'week') {
          const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 6);
          to = d.toISOString().slice(0, 10);
        } else {
          // try to interpret as a date
          const d = new Date(arg);
          if (!isNaN(d.getTime())) { from = to = d.toISOString().slice(0, 10); }
          else {
            // default: next 7 days
            const d2 = new Date(today + 'T00:00:00'); d2.setDate(d2.getDate() + 6);
            to = d2.toISOString().slice(0, 10);
          }
        }
        if (!arg || arg === 'week') {
          const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 6);
          to = d.toISOString().slice(0, 10);
        }
        const events = await getEvents(userId, from, to);
        if (events.length === 0) {
          const label = from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
          await sendMessage(chatId, `📅 No events for ${label}.`);
        } else {
          let lastDate = '';
          const lines: string[] = ['📅 Upcoming events:'];
          for (const e of events) {
            const ds = String(e.date).slice(0, 10);
            if (ds !== lastDate) { lines.push(`\n${fmtDate(ds)}`); lastDate = ds; }
            const time = e.start_time ? ` ${fmt12(String(e.start_time).slice(0, 5))}${e.end_time ? `–${fmt12(String(e.end_time).slice(0, 5))}` : ''}` : '';
            lines.push(`• ${e.title}${time}${e.description ? ` — ${e.description}` : ''}`);
          }
          await sendMessage(chatId, lines.join('\n'));
        }
        return;
      }

      if (cmd === '/event') {
        const arg = text!.slice('/event'.length).trim();
        if (!arg) {
          await sendMessage(chatId, 'Usage: /event <title> [on YYYY-MM-DD] [at HH:MM]\nExample: /event Dentist on 2026-04-30 at 14:00');
          return;
        }
        // Quick parse: "Title on DATE at TIME"
        let title = arg, eventDate = today, startTime: string | null = null;
        const onMatch = arg.match(/^(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})(.*)$/i);
        if (onMatch) {
          title = onMatch[1].trim();
          eventDate = onMatch[2];
          const atMatch = onMatch[3].match(/at\s+(\d{1,2}:\d{2})/i);
          if (atMatch) startTime = atMatch[1].padStart(5, '0');
        } else {
          const atMatch = arg.match(/^(.+?)\s+at\s+(\d{1,2}:\d{2})(.*)$/i);
          if (atMatch) { title = atMatch[1].trim(); startTime = atMatch[2].padStart(5, '0'); }
        }
        const { rows: ins } = await pool.query(
          `INSERT INTO calendar_events (user_id, title, date, start_time) VALUES ($1,$2,$3,$4) RETURNING TO_CHAR(date,'YYYY-MM-DD') AS date`,
          [userId, title, eventDate, startTime],
        );
        const storedDate2 = ins[0]?.date ?? eventDate;
        const timeStr = startTime ? ` at ${fmt12(startTime)}` : '';
        await sendMessage(chatId, `✅ Event added: "${title}" on ${fmtDate(storedDate2)}${timeStr}\n(stored date: ${storedDate2})`);
        return;
      }

      if (['/morning', '/afternoon', '/evening', '/night'].includes(cmd)) {
        const slot = cmd.slice(1);
        const meds = await getPendingMeds(userId, slot, today);
        if (meds.length === 0) {
          await sendMessage(chatId, `${SLOT_LABELS[slot]}: ✅ All done!`);
        } else {
          const lines = meds.map(m => `• ${m.name}${m.dose ? ` — ${m.dose}` : ''}`).join('\n');
          await sendMessage(chatId, `${SLOT_LABELS[slot]} medications pending:\n${lines}`);
        }
        return;
      }

      // Unknown command — fall through to wellbeing parser
    }

    // ── Resolve input text ──
    let inputText = text ?? '';
    if (voice) {
      if (!GROQ_KEY()) {
        await sendMessage(chatId, 'Voice transcription is not configured on this server.');
        return;
      }
      inputText = await transcribeVoice(voice.file_id);
      if (!inputText.trim()) {
        await sendMessage(chatId, "Sorry, I couldn't transcribe that voice message. Please try again.");
        return;
      }
    }
    if (!inputText.trim()) return;

    // ── Check for calendar intent first (more specific than todos) ──
    const calIntent = await parseCalendarIntent(inputText, localDate());
    if (calIntent?.action === 'add' && calIntent.title && calIntent.date) {
      const { rows: inserted } = await pool.query(
        `INSERT INTO calendar_events (user_id, title, date, start_time, end_time, description)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING TO_CHAR(date,'YYYY-MM-DD') AS date`,
        [userId, calIntent.title, calIntent.date, calIntent.startTime ?? null, calIntent.endTime ?? null, calIntent.description ?? null],
      );
      const storedDate = inserted[0]?.date ?? calIntent.date;
      const timeStr = calIntent.startTime ? ` at ${fmt12(calIntent.startTime)}` : '';
      await sendMessage(chatId, `✅ Event added: "${calIntent.title}" on ${fmtDate(storedDate)}${timeStr}\n(stored date: ${storedDate})`);
      return;
    }
    if (calIntent?.action === 'list') {
      const today2 = localDate();
      const d7 = new Date(today2 + 'T00:00:00'); d7.setDate(d7.getDate() + 6);
      const from = calIntent.rangeStart ?? today2;
      const to   = calIntent.rangeEnd   ?? d7.toISOString().slice(0, 10);
      const events = await getEvents(userId, from, to);
      if (events.length === 0) {
        await sendMessage(chatId, `📅 No events for ${fmtDate(from)}${from !== to ? ` – ${fmtDate(to)}` : ''}.`);
      } else {
        let lastDate = '';
        const lines: string[] = ['📅 Events:'];
        for (const e of events) {
          const ds = String(e.date).slice(0, 10);
          if (ds !== lastDate) { lines.push(`\n${fmtDate(ds)}`); lastDate = ds; }
          const time = e.start_time ? ` ${fmt12(String(e.start_time).slice(0, 5))}` : '';
          lines.push(`• ${e.title}${time}`);
        }
        await sendMessage(chatId, lines.join('\n'));
      }
      return;
    }

    // ── Check for todo intent ──
    const todoIntent = await parseTodoIntent(inputText);
    if (todoIntent?.action === 'add' && todoIntent.title) {
      await pool.query(`INSERT INTO todos (user_id, title) VALUES ($1, $2)`, [userId, todoIntent.title]);
      await sendMessage(chatId, `✅ Added to-do: "${todoIntent.title}"`);
      return;
    }
    if (todoIntent?.action === 'done' && todoIntent.title) {
      const { rows } = await pool.query(
        `SELECT id, title FROM todos WHERE user_id = $1 AND done = false ORDER BY created_at DESC`,
        [userId],
      );
      const match = rows.find((r: any) =>
        r.title.toLowerCase().includes(todoIntent.title!.toLowerCase()) ||
        todoIntent.title!.toLowerCase().includes(r.title.toLowerCase())
      );
      if (match) {
        await pool.query(`UPDATE todos SET done = true, updated_at = now() WHERE id = $1`, [match.id]);
        await sendMessage(chatId, `✅ Marked done: "${match.title}"`);
      } else {
        await sendMessage(chatId, `Couldn't find a matching to-do for "${todoIntent.title}". Use /todos to see the list.`);
      }
      return;
    }

    // ── Parse and insert wellbeing ──
    const parsed = await parseWellbeing(inputText);

    const id   = crypto.randomUUID();
    const date = localDate();
    const time = localTime();

    await pool.query(
      `INSERT INTO wellbeing_entries
         (id, user_id, date, time, heart_rate, systolic_bp, diastolic_bp, spo2, overall_feel, symptoms, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id, userId, date, time,
        parsed.heartRate   ?? null,
        parsed.systolicBP  ?? null,
        parsed.diastolicBP ?? null,
        parsed.spo2        ?? null,
        parsed.overallFeel ?? null,
        JSON.stringify(parsed.symptoms ?? []),
        parsed.notes       ?? null,
      ],
    );

    // ── Confirmation reply ──
    const parts: string[] = ['✅ Logged!'];
    if (parsed.overallFeel != null)                           parts.push(`Feel: ${parsed.overallFeel}/10`);
    if (parsed.heartRate)                                     parts.push(`HR: ${parsed.heartRate} bpm`);
    if (parsed.systolicBP && parsed.diastolicBP)              parts.push(`BP: ${parsed.systolicBP}/${parsed.diastolicBP} mmHg`);
    if (parsed.spo2)                                          parts.push(`SpO₂: ${parsed.spo2}%`);
    if (parsed.symptoms?.length) {
      parts.push(`Symptoms: ${parsed.symptoms.map((s: any) => `${s.name} (${s.intensity}/10${s.duration ? `, ${s.duration}` : ''})`).join(', ')}`);
    }
    if (parsed.notes)                                         parts.push(`Notes: ${parsed.notes}`);
    await sendMessage(chatId, parts.join('\n'));

  } catch (err) {
    console.error('Telegram webhook error:', err);
    try { await sendMessage(chatId, 'Something went wrong processing your message. Please try again.'); } catch {}
  }
});

// ── POST /api/telegram/link — generate one-time code ──────────────────────────
router.post('/link', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await pool.query('DELETE FROM telegram_link_codes WHERE user_id = $1', [req.userId]);
    await pool.query(
      'INSERT INTO telegram_link_codes (code, user_id, expires_at) VALUES ($1, $2, $3)',
      [code, req.userId, expiresAt],
    );
    res.json({ code, botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '', expiresAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/telegram/link — disconnect ─────────────────────────────────────
router.delete('/link', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM telegram_connections WHERE user_id = $1', [req.userId]);
    await pool.query('DELETE FROM telegram_link_codes WHERE user_id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/telegram/status ───────────────────────────────────────────────────
router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT connected_at FROM telegram_connections WHERE user_id = $1',
      [req.userId],
    );
    if (rows.length === 0) {
      res.json({ connected: false });
    } else {
      res.json({ connected: true, connectedAt: rows[0].connected_at });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
