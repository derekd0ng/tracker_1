import cron from 'node-cron';
import { pool } from '../db';

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? '';
const TZ        = process.env.REMINDER_TIMEZONE ?? 'UTC';

async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
}

function todayInTZ(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

function nowTimeInTZ(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

// Daily digest: all outstanding todos (due today, overdue, or no due date)
async function sendTodoDigest() {
  try {
    const today = todayInTZ();
    const { rows: connections } = await pool.query<{ user_id: string; chat_id: number }>(
      'SELECT user_id, chat_id FROM telegram_connections',
    );

    for (const { user_id, chat_id } of connections) {
      const { rows } = await pool.query<{ title: string; due_date: string | null }>(
        `SELECT title, TO_CHAR(due_date,'YYYY-MM-DD') AS due_date
         FROM todos
         WHERE user_id = $1 AND done = false
           AND (due_date IS NULL OR due_date <= $2)
         ORDER BY due_date ASC NULLS LAST, created_at ASC`,
        [user_id, today],
      );

      if (rows.length === 0) continue;

      const lines = rows.map(t => {
        if (!t.due_date)          return `• ${t.title}`;
        if (t.due_date === today)  return `• ${t.title} — <b>today</b>`;
        return `• ${t.title} — <b>overdue</b> (${t.due_date})`;
      });

      await sendTelegramMessage(chat_id, `📋 Outstanding to-dos:\n${lines.join('\n')}`);
    }
  } catch (err) {
    console.error('[todoReminders] digest error:', err);
  }
}

// Per-todo reminders: fires every minute, sends todos whose reminder_time matches now
async function sendTodoReminders() {
  try {
    const today   = todayInTZ();
    const nowTime = nowTimeInTZ();

    const { rows: connections } = await pool.query<{ user_id: string; chat_id: number }>(
      'SELECT user_id, chat_id FROM telegram_connections',
    );

    for (const { user_id, chat_id } of connections) {
      const { rows } = await pool.query<{ title: string }>(
        `SELECT title FROM todos
         WHERE user_id = $1 AND done = false
           AND TO_CHAR(reminder_time,'HH24:MI') = $2
           AND (due_date IS NULL OR due_date = $3)`,
        [user_id, nowTime, today],
      );

      if (rows.length === 0) continue;

      const lines = rows.map(t => `• ${t.title}`).join('\n');
      await sendTelegramMessage(chat_id, `⏰ Reminder:\n${lines}`);
    }
  } catch (err) {
    console.error('[todoReminders] per-todo error:', err);
  }
}

export function startTodoReminders() {
  cron.schedule('0 14 * * *', sendTodoDigest,    { timezone: TZ });
  cron.schedule('0 18 * * *', sendTodoDigest,    { timezone: TZ });
  cron.schedule('* * * * *',  sendTodoReminders, { timezone: TZ });
  console.log(`[todoReminders] scheduled (TZ: ${TZ})`);
}
