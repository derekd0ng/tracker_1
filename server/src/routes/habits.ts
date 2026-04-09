import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToHabit(r: any) {
  return {
    id:           r.id,
    name:         r.name,
    type:         r.type,
    frequency:    r.frequency,
    icon:         r.icon ?? undefined,
    unit:         r.unit ?? undefined,
    target:       r.target != null ? Number(r.target) : undefined,
    weeklyTarget: r.weekly_target ?? undefined,
  };
}

function rowToLog(r: any) {
  return {
    date:    r.date,
    habitId: r.habit_id,
    value:   Number(r.value),
  };
}

// ── GET /api/habits ───────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM habits WHERE user_id = $1 ORDER BY created_at',
      [req.userId],
    );
    res.json(rows.map(rowToHabit));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/habits/:id — upsert ─────────────────────────────────────────────
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, type, frequency, icon, unit, target, weeklyTarget } = req.body;
    await pool.query(
      `INSERT INTO habits (id, user_id, name, type, frequency, icon, unit, target, weekly_target)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, type = EXCLUDED.type, frequency = EXCLUDED.frequency,
         icon = EXCLUDED.icon, unit = EXCLUDED.unit, target = EXCLUDED.target,
         weekly_target = EXCLUDED.weekly_target`,
      [id, req.userId, name, type, frequency ?? 'daily', icon ?? null,
       unit ?? null, target ?? null, weeklyTarget ?? null],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/habits/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM habits WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/habits/logs?date= ────────────────────────────────────────────────
router.get('/logs', async (req: AuthRequest, res) => {
  try {
    const { date } = req.query;
    const params: any[] = [req.userId];
    let sql = 'SELECT * FROM habit_logs WHERE user_id = $1';
    if (date) { sql += ' AND date = $2'; params.push(date); }
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(rowToLog));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/habits/logs — upsert single entry ───────────────────────────────
router.post('/logs', async (req: AuthRequest, res) => {
  try {
    const { date, habitId, value } = req.body;
    await pool.query(
      `INSERT INTO habit_logs (user_id, habit_id, date, value)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (habit_id, date) DO UPDATE SET value = EXCLUDED.value`,
      [req.userId, habitId, date, value],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/habits/logs/bulk ───────────────────────────────────────────────
router.post('/logs/bulk', async (req: AuthRequest, res) => {
  try {
    const entries: Array<{ date: string; habitId: string; value: number | null }> = req.body.entries;
    for (const { date, habitId, value } of entries) {
      if (value === null) {
        await pool.query(
          'DELETE FROM habit_logs WHERE user_id = $1 AND habit_id = $2 AND date = $3',
          [req.userId, habitId, date],
        );
      } else {
        await pool.query(
          `INSERT INTO habit_logs (user_id, habit_id, date, value)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (habit_id, date) DO UPDATE SET value = EXCLUDED.value`,
          [req.userId, habitId, date, value],
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/habits/import ───────────────────────────────────────────────────
router.post('/import', async (req: AuthRequest, res) => {
  try {
    const { habits, habitLogs } = req.body;
    for (const h of habits ?? []) {
      await pool.query(
        `INSERT INTO habits (id, user_id, name, type, frequency, icon, unit, target, weekly_target)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [h.id, req.userId, h.name, h.type, h.frequency ?? 'daily',
         h.icon ?? null, h.unit ?? null, h.target ?? null, h.weeklyTarget ?? null],
      );
    }
    for (const l of habitLogs ?? []) {
      await pool.query(
        `INSERT INTO habit_logs (user_id, habit_id, date, value)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (habit_id, date) DO NOTHING`,
        [req.userId, l.habitId, l.date, l.value],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
