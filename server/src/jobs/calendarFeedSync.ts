import cron from 'node-cron';
import { pool } from '../db';
import { parseICS } from '../lib/parseICS';

const TZ = process.env.REMINDER_TIMEZONE ?? 'UTC';

export async function syncUserFeed(userId: string, feedUrl: string): Promise<void> {
  const url = feedUrl.replace(/^webcal:\/\//i, 'https://').replace(/^http:\/\//i, 'https://');

  const resp = await fetch(url, { headers: { 'User-Agent': 'OctarineCalendar/1.0' } });
  if (!resp.ok) throw new Error(`Feed returned ${resp.status}`);
  const ics = await resp.text();
  if (!ics.includes('BEGIN:VCALENDAR')) throw new Error('Not a valid ICS feed');

  const events = parseICS(ics);
  const uids: string[] = [];

  for (const ev of events) {
    uids.push(ev.uid);
    await pool.query(
      `INSERT INTO calendar_events (user_id, title, date, start_time, end_time, description, ics_uid, ics_feed_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, ics_uid) WHERE ics_uid IS NOT NULL
       DO UPDATE SET title=$2, date=$3, start_time=$4, end_time=$5, description=$6, updated_at=now()`,
      [userId, ev.title, ev.date, ev.startTime ?? null, ev.endTime ?? null, ev.description ?? null, ev.uid, feedUrl],
    );
  }

  // Remove events that disappeared from the feed
  if (uids.length > 0) {
    await pool.query(
      `DELETE FROM calendar_events WHERE user_id=$1 AND ics_feed_url=$2 AND NOT (ics_uid = ANY($3))`,
      [userId, feedUrl, uids],
    );
  } else {
    await pool.query(
      `DELETE FROM calendar_events WHERE user_id=$1 AND ics_feed_url=$2`,
      [userId, feedUrl],
    );
  }

  await pool.query(`UPDATE users SET ics_last_synced_at=now() WHERE id=$1`, [userId]);
}

async function syncAllFeeds() {
  try {
    const { rows } = await pool.query(
      `SELECT id, ics_feed_url FROM users WHERE ics_feed_url IS NOT NULL AND ics_feed_url != ''`,
    );
    for (const row of rows) {
      try {
        await syncUserFeed(row.id, row.ics_feed_url);
        console.log(`[calFeedSync] synced user ${row.id}`);
      } catch (err) {
        console.error(`[calFeedSync] failed for user ${row.id}:`, err);
      }
    }
  } catch (err) {
    console.error('[calFeedSync] syncAllFeeds error:', err);
  }
}

export function startCalendarFeedSync() {
  cron.schedule('0 6 * * *', syncAllFeeds, { timezone: TZ });
  console.log(`[calFeedSync] daily sync scheduled at 06:00 ${TZ}`);
}
