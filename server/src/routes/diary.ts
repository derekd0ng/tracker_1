import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function rowToEntry(r: any) {
  return {
    date:      String(r.date).slice(0, 10),
    freeText:  r.free_text,
    prompts:   r.prompts ?? {},
    updatedAt: r.updated_at,
  };
}

// GET /api/diary
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM diary_entries WHERE user_id = $1 ORDER BY date DESC',
      [req.userId],
    );
    res.json(rows.map(rowToEntry));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/diary/:date  (upsert)
router.put('/:date', async (req: AuthRequest, res) => {
  try {
    const { date } = req.params;
    const { freeText = '', prompts = {} } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO diary_entries (user_id, date, free_text, prompts, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id, date) DO UPDATE
         SET free_text  = EXCLUDED.free_text,
             prompts    = EXCLUDED.prompts,
             updated_at = now()
       RETURNING *`,
      [req.userId, date, freeText, JSON.stringify(prompts)],
    );
    res.json(rowToEntry(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/diary/:date
router.delete('/:date', async (req: AuthRequest, res) => {
  try {
    await pool.query(
      'DELETE FROM diary_entries WHERE user_id = $1 AND date = $2',
      [req.userId, req.params.date],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
