import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function rowToEntry(r: any) {
  return {
    id:           r.id,
    date:         r.date,
    time:         r.time,
    heartRate:    r.heart_rate ?? undefined,
    systolicBP:   r.systolic_bp ?? undefined,
    diastolicBP:  r.diastolic_bp ?? undefined,
    spo2:         r.spo2 != null ? Number(r.spo2) : undefined,
    overallFeel:  r.overall_feel,
    symptoms:     r.symptoms ?? [],
    notes:        r.notes ?? undefined,
  };
}

// ── GET /api/wellbeing ────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM wellbeing_entries WHERE user_id = $1 ORDER BY date DESC, time DESC',
      [req.userId],
    );
    res.json(rows.map(rowToEntry));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/wellbeing/:id — upsert ──────────────────────────────────────────
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { date, time, heartRate, systolicBP, diastolicBP, spo2, overallFeel, symptoms, notes } = req.body;
    await pool.query(
      `INSERT INTO wellbeing_entries
         (id, user_id, date, time, heart_rate, systolic_bp, diastolic_bp, spo2, overall_feel, symptoms, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date, time = EXCLUDED.time, heart_rate = EXCLUDED.heart_rate,
         systolic_bp = EXCLUDED.systolic_bp, diastolic_bp = EXCLUDED.diastolic_bp,
         spo2 = EXCLUDED.spo2, overall_feel = EXCLUDED.overall_feel,
         symptoms = EXCLUDED.symptoms, notes = EXCLUDED.notes`,
      [id, req.userId, date, time, heartRate ?? null, systolicBP ?? null, diastolicBP ?? null,
       spo2 ?? null, overallFeel, JSON.stringify(symptoms ?? []), notes ?? null],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/wellbeing/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query(
      'DELETE FROM wellbeing_entries WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/wellbeing/import ────────────────────────────────────────────────
router.post('/import', async (req: AuthRequest, res) => {
  try {
    const { wellbeing } = req.body;
    for (const e of wellbeing ?? []) {
      await pool.query(
        `INSERT INTO wellbeing_entries
           (id, user_id, date, time, heart_rate, systolic_bp, diastolic_bp, spo2, overall_feel, symptoms, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, req.userId, e.date, e.time, e.heartRate ?? null, e.systolicBP ?? null, e.diastolicBP ?? null,
         e.spo2 ?? null, e.overallFeel, JSON.stringify(e.symptoms ?? []), e.notes ?? null],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
