import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { syncUserFeed } from '../jobs/calendarFeedSync';

const router = Router();
router.use(requireAuth);

const SELECT_COLS = `
  id, title, color, description,
  TO_CHAR(date, 'YYYY-MM-DD')       AS date,
  TO_CHAR(start_time, 'HH24:MI')    AS start_time,
  TO_CHAR(end_time,   'HH24:MI')    AS end_time
`;

function rowToEvent(r: any) {
  return {
    id:          r.id,
    title:       r.title,
    date:        r.date as string,
    startTime:   r.start_time ?? undefined,
    endTime:     r.end_time   ?? undefined,
    description: r.description ?? undefined,
    color:       r.color ?? undefined,
  };
}

// GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { from = '2000-01-01', to = '2100-12-31' } = req.query as Record<string, string>;
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS} FROM calendar_events
       WHERE user_id = $1 AND date >= $2 AND date <= $3
       ORDER BY date, start_time NULLS LAST`,
      [req.userId, from, to],
    );
    res.json(rows.map(rowToEvent));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/calendar
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { title, date, startTime, endTime, description, color } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'title and date required' }) as any;
    const { rows } = await pool.query(
      `INSERT INTO calendar_events (user_id, title, date, start_time, end_time, description, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${SELECT_COLS}`,
      [req.userId, title, date, startTime ?? null, endTime ?? null, description ?? null, color ?? null],
    );
    res.json(rowToEvent(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/calendar/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { title, date, startTime, endTime, description, color } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'title and date required' }) as any;
    const { rows } = await pool.query(
      `UPDATE calendar_events
       SET title=$1, date=$2, start_time=$3, end_time=$4, description=$5, color=$6, updated_at=now()
       WHERE id=$7 AND user_id=$8
       RETURNING ${SELECT_COLS}`,
      [title, date, startTime ?? null, endTime ?? null, description ?? null, color ?? null, req.params.id, req.userId],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' }) as any;
    res.json(rowToEvent(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/calendar/feed
router.get('/feed', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ics_feed_url AS url, ics_last_synced_at AS last_synced FROM users WHERE id=$1`,
      [req.userId],
    );
    const row = rows[0] ?? {};
    res.json({ url: row.url ?? null, lastSynced: row.last_synced ?? null });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/calendar/feed — save URL and trigger immediate sync
router.put('/feed', async (req: AuthRequest, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url) return res.status(400).json({ error: 'url required' }) as any;
    await pool.query(`UPDATE users SET ics_feed_url=$1 WHERE id=$2`, [url, req.userId]);
    await syncUserFeed(req.userId!, url);
    const { rows } = await pool.query(`SELECT ics_last_synced_at AS last_synced FROM users WHERE id=$1`, [req.userId]);
    res.json({ ok: true, lastSynced: rows[0]?.last_synced ?? null });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err?.message ?? 'Sync failed' });
  }
});

// DELETE /api/calendar/feed — disconnect and remove all feed events
router.delete('/feed', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(`SELECT ics_feed_url FROM users WHERE id=$1`, [req.userId]);
    const feedUrl = rows[0]?.ics_feed_url;
    if (feedUrl) {
      await pool.query(`DELETE FROM calendar_events WHERE user_id=$1 AND ics_feed_url=$2`, [req.userId, feedUrl]);
    }
    await pool.query(`UPDATE users SET ics_feed_url=NULL, ics_last_synced_at=NULL WHERE id=$1`, [req.userId]);
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/calendar/feed/sync — manual sync now
router.post('/feed/sync', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(`SELECT ics_feed_url FROM users WHERE id=$1`, [req.userId]);
    const feedUrl = rows[0]?.ics_feed_url;
    if (!feedUrl) return res.status(400).json({ error: 'No feed configured' }) as any;
    await syncUserFeed(req.userId!, feedUrl);
    const { rows: r2 } = await pool.query(`SELECT ics_last_synced_at AS last_synced FROM users WHERE id=$1`, [req.userId]);
    res.json({ ok: true, lastSynced: r2[0]?.last_synced ?? null });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err?.message ?? 'Sync failed' });
  }
});

// POST /api/calendar/fetch-ics  — proxy-fetch an ICS URL (bypasses browser CORS)
router.post('/fetch-ics', async (req: AuthRequest, res) => {
  try {
    let { url } = req.body as { url?: string };
    if (!url) return res.status(400).json({ error: 'url required' }) as any;
    // webcal:// is just https:// with a different scheme
    url = url.replace(/^webcal:\/\//i, 'https://').replace(/^http:\/\//i, 'https://');
    const upstream = await fetch(url, { headers: { 'User-Agent': 'OctarineCalendar/1.0' } });
    if (!upstream.ok) return res.status(400).json({ error: `Upstream returned ${upstream.status}` }) as any;
    const ics = await upstream.text();
    if (!ics.includes('BEGIN:VCALENDAR')) return res.status(400).json({ error: 'URL does not appear to be a valid ICS feed' }) as any;
    res.json({ ics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ICS URL' });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM calendar_events WHERE id=$1 AND user_id=$2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
