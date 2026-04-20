import cron from 'node-cron';
import { pool } from '../db';

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? '';
const TZ        = process.env.REMINDER_TIMEZONE ?? 'UTC';

const SLOT_LABELS: Record<string, string> = {
  morning:   '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening:   '🌆 Evening',
  night:     '🌙 Night',
};

async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

function todayInTZ(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

async function sendReminder(timeOfDay: string) {
  try {
    const today = todayInTZ();

    // All Telegram-connected users
    const { rows: connections } = await pool.query<{ user_id: string; chat_id: number }>(
      'SELECT user_id, chat_id FROM telegram_connections',
    );

    for (const { user_id, chat_id } of connections) {
      // Active meds scheduled for this slot, not yet done for today
      const { rows: meds } = await pool.query<{ name: string; dose: string | null }>(
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
        [user_id, timeOfDay, today],
      );

      if (meds.length === 0) continue;

      const label = SLOT_LABELS[timeOfDay] ?? timeOfDay;
      const lines = meds.map(m => `• ${m.name}${m.dose ? ` — ${m.dose}` : ''}`).join('\n');
      await sendTelegramMessage(chat_id, `${label} medications due:\n${lines}`);
    }
  } catch (err) {
    console.error(`Medication reminder error (${timeOfDay}):`, err);
  }
}

export function startMedicationReminders() {
  cron.schedule('0  9 * * *', () => sendReminder('morning'),   { timezone: TZ });
  cron.schedule('0 13 * * *', () => sendReminder('afternoon'), { timezone: TZ });
  cron.schedule('0 17 * * *', () => sendReminder('evening'),   { timezone: TZ });
  cron.schedule('0 21 * * *', () => sendReminder('night'),     { timezone: TZ });
  console.log(`Medication reminders scheduled (TZ: ${TZ})`);
}
