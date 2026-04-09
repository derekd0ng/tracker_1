import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToMed(r: any) {
  return {
    id:                  r.id,
    name:                r.name,
    dose:                r.dose ?? undefined,
    startDate:           r.start_date ?? undefined,
    durationDays:        r.duration_days ?? undefined,
    timesOfDay:          r.times_of_day ?? [],
    purpose:             r.purpose ?? undefined,
    prescribingDoctor:   r.prescribing_doctor ?? undefined,
    notes:               r.notes ?? undefined,
    active:              r.active,
  };
}

function rowToLog(r: any) {
  return {
    medicationId: r.medication_id,
    date:         r.date,
    timeOfDay:    r.time_of_day,
    taken:        r.taken,
    takenAt:      r.taken_at ?? undefined,
    skipped:      r.skipped ?? false,
    changedAt:    r.changed_at ? Number(r.changed_at) : undefined,
  };
}

// ── GET /api/medications ──────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM medications WHERE user_id = $1 ORDER BY created_at',
      [req.userId],
    );
    res.json(rows.map(rowToMed));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/medications/:id — upsert ────────────────────────────────────────
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, dose, startDate, durationDays, timesOfDay, purpose, prescribingDoctor, notes, active } = req.body;

    await pool.query(
      `INSERT INTO medications
         (id, user_id, name, dose, start_date, duration_days, times_of_day, purpose, prescribing_doctor, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, dose = EXCLUDED.dose, start_date = EXCLUDED.start_date,
         duration_days = EXCLUDED.duration_days, times_of_day = EXCLUDED.times_of_day,
         purpose = EXCLUDED.purpose, prescribing_doctor = EXCLUDED.prescribing_doctor,
         notes = EXCLUDED.notes, active = EXCLUDED.active`,
      [id, req.userId, name, dose ?? null, startDate ?? null, durationDays ?? null,
       timesOfDay ?? [], purpose ?? null, prescribingDoctor ?? null, notes ?? null, active ?? true],
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/medications/:id ───────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM medications WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/medications/logs?date= ──────────────────────────────────────────
router.get('/logs', async (req: AuthRequest, res) => {
  try {
    const { date } = req.query;
    const params: any[] = [req.userId];
    let sql = 'SELECT * FROM medication_logs WHERE user_id = $1';
    if (date) { sql += ' AND date = $2'; params.push(date); }
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(rowToLog));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/medications/logs/toggle ────────────────────────────────────────
router.post('/logs/toggle', async (req: AuthRequest, res) => {
  try {
    const { date, medicationId, timeOfDay } = req.body;

    const { rows } = await pool.query(
      'SELECT taken FROM medication_logs WHERE user_id = $1 AND medication_id = $2 AND date = $3 AND time_of_day = $4',
      [req.userId, medicationId, date, timeOfDay],
    );
    const nowTaken = rows.length === 0 || !rows[0].taken;
    const now = new Date();
    const takenAt = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    await pool.query(
      `INSERT INTO medication_logs (user_id, medication_id, date, time_of_day, taken, taken_at, skipped, changed_at)
       VALUES ($1,$2,$3,$4,$5,$6,false,$7)
       ON CONFLICT (medication_id, date, time_of_day) DO UPDATE SET
         taken = EXCLUDED.taken, taken_at = EXCLUDED.taken_at, skipped = false, changed_at = EXCLUDED.changed_at`,
      [req.userId, medicationId, date, timeOfDay, nowTaken, nowTaken ? takenAt : null, Date.now()],
    );

    res.json({ ok: true, taken: nowTaken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/medications/logs/skip ──────────────────────────────────────────
router.post('/logs/skip', async (req: AuthRequest, res) => {
  try {
    const { date, medicationId, timeOfDay } = req.body;
    await pool.query(
      `INSERT INTO medication_logs (user_id, medication_id, date, time_of_day, taken, skipped, changed_at)
       VALUES ($1,$2,$3,$4,false,true,$5)
       ON CONFLICT (medication_id, date, time_of_day) DO UPDATE SET
         taken = false, skipped = true, taken_at = null, changed_at = EXCLUDED.changed_at`,
      [req.userId, medicationId, date, timeOfDay, Date.now()],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/medications/logs/clear ─────────────────────────────────────────
router.post('/logs/clear', async (req: AuthRequest, res) => {
  try {
    const { date, medicationId, timeOfDay } = req.body;
    await pool.query(
      'DELETE FROM medication_logs WHERE user_id = $1 AND medication_id = $2 AND date = $3 AND time_of_day = $4',
      [req.userId, medicationId, date, timeOfDay],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/medications/logs/bulk ──────────────────────────────────────────
router.post('/logs/bulk', async (req: AuthRequest, res) => {
  try {
    const entries: Array<{ date: string; medicationId: string; timeOfDay: string; taken: boolean }> = req.body.entries;
    for (const { date, medicationId, timeOfDay, taken } of entries) {
      if (taken) {
        await pool.query(
          `INSERT INTO medication_logs (user_id, medication_id, date, time_of_day, taken)
           VALUES ($1,$2,$3,$4,true)
           ON CONFLICT (medication_id, date, time_of_day) DO UPDATE SET taken = true, skipped = false`,
          [req.userId, medicationId, date, timeOfDay],
        );
      } else {
        await pool.query(
          'DELETE FROM medication_logs WHERE user_id = $1 AND medication_id = $2 AND date = $3 AND time_of_day = $4',
          [req.userId, medicationId, date, timeOfDay],
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/medications/import — bulk import from backup ───────────────────
router.post('/import', async (req: AuthRequest, res) => {
  try {
    const { medications, medLogs } = req.body;
    for (const m of medications ?? []) {
      await pool.query(
        `INSERT INTO medications
           (id, user_id, name, dose, start_date, duration_days, times_of_day, purpose, prescribing_doctor, notes, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [m.id, req.userId, m.name, m.dose ?? null, m.startDate ?? null, m.durationDays ?? null,
         m.timesOfDay ?? [], m.purpose ?? null, m.prescribingDoctor ?? null, m.notes ?? null, m.active ?? true],
      );
    }
    for (const l of medLogs ?? []) {
      await pool.query(
        `INSERT INTO medication_logs (user_id, medication_id, date, time_of_day, taken, taken_at, skipped, changed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (medication_id, date, time_of_day) DO NOTHING`,
        [req.userId, l.medicationId, l.date, l.timeOfDay, l.taken, l.takenAt ?? null, l.skipped ?? false, l.changedAt ?? null],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
