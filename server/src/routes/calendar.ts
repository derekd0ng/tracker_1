import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function rowToEvent(r: any) {
  return {
    id:          r.id,
    title:       r.title,
    date:        String(r.date).slice(0, 10),
    startTime:   r.start_time ? String(r.start_time).slice(0, 5) : undefined,
    endTime:     r.end_time   ? String(r.end_time).slice(0, 5)   : undefined,
    description: r.description ?? undefined,
    color:       r.color ?? undefined,
  };
}

// GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { from = '2000-01-01', to = '2100-12-31' } = req.query as Record<string, string>;
    const { rows } = await pool.query(
      `SELECT * FROM calendar_events
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
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
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
       WHERE id=$7 AND user_id=$8 RETURNING *`,
      [title, date, startTime ?? null, endTime ?? null, description ?? null, color ?? null, req.params.id, req.userId],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' }) as any;
    res.json(rowToEvent(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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
