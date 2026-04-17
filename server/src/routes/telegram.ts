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

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function localTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

    // ── Parse and insert ──
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
