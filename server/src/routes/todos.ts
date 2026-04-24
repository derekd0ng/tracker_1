import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function rowToTodo(r: any) {
  return {
    id:        r.id,
    title:     r.title,
    done:      r.done,
    dueDate:   r.due_date ? String(r.due_date).slice(0, 10) : undefined,
    createdAt: r.created_at,
  };
}

// ── GET /api/todos ────────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId],
    );
    res.json(rows.map(rowToTodo));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/todos ───────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { id, title, done = false, dueDate, createdAt } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' }) as any;
    const { rows } = await pool.query(
      `INSERT INTO todos (id, user_id, title, done, due_date, created_at)
       VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, COALESCE($6, now()))
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, done = EXCLUDED.done, due_date = EXCLUDED.due_date, updated_at = now()
       RETURNING *`,
      [id ?? null, req.userId, title, done, dueDate ?? null, createdAt ?? null],
    );
    res.json(rowToTodo(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/todos/:id ──────────────────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const fields: string[] = [];
    const vals: any[]      = [];
    let idx = 1;
    if (req.body.done     !== undefined) { fields.push(`done = $${idx++}`);     vals.push(req.body.done); }
    if (req.body.title    !== undefined) { fields.push(`title = $${idx++}`);    vals.push(req.body.title); }
    if (req.body.dueDate  !== undefined) { fields.push(`due_date = $${idx++}`); vals.push(req.body.dueDate ?? null); }
    if (fields.length === 0) return res.status(400).json({ error: 'nothing to update' }) as any;
    fields.push(`updated_at = now()`);
    vals.push(req.params.id, req.userId);
    const { rows } = await pool.query(
      `UPDATE todos SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
      vals,
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' }) as any;
    res.json(rowToTodo(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/todos/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM todos WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
