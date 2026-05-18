import { Router } from 'express';
import { pool } from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function rowToLab(r: any) {
  return {
    id:         r.id,
    metricName: r.metric_name,
    date:       r.date,
    value:      r.value    !== null && r.value    !== undefined ? parseFloat(r.value)    : null,
    unit:       r.unit     ?? null,
    refLow:     r.ref_low  !== null && r.ref_low  !== undefined ? parseFloat(r.ref_low)  : null,
    refHigh:    r.ref_high !== null && r.ref_high !== undefined ? parseFloat(r.ref_high) : null,
    refText:    r.ref_text ?? null,
    labType:    r.lab_type ?? 'other',
  };
}

const SEL = `id, metric_name, TO_CHAR(date,'YYYY-MM-DD') AS date,
             value, unit, ref_low, ref_high, ref_text, lab_type`;

// GET /api/labs
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${SEL} FROM lab_results WHERE user_id = $1 ORDER BY date DESC, metric_name`,
      [req.userId],
    );
    res.json(rows.map(rowToLab));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/labs  — bulk insert array
router.post('/', async (req: AuthRequest, res) => {
  try {
    const items: any[] = req.body;
    if (!Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'Expected non-empty array' }) as any;

    const inserted = [];
    for (const item of items) {
      const { rows } = await pool.query(
        `INSERT INTO lab_results (user_id, metric_name, date, value, unit, ref_low, ref_high, ref_text, lab_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${SEL}`,
        [
          req.userId,
          item.metricName,
          item.date,
          item.value   ?? null,
          item.unit    ?? null,
          item.refLow  ?? null,
          item.refHigh ?? null,
          item.refText ?? null,
          item.labType ?? 'other',
        ],
      );
      inserted.push(rowToLab(rows[0]));
    }
    res.json(inserted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/labs/merge — rename metric names within a specific lab type
router.post('/merge', async (req: AuthRequest, res) => {
  try {
    const { from, to, labType }: { from: string[]; to: string; labType?: string } = req.body;
    if (!Array.isArray(from) || !from.length || !to)
      return res.status(400).json({ error: 'from (array) and to (string) required' }) as any;

    if (labType) {
      await pool.query(
        `UPDATE lab_results SET metric_name = $1
         WHERE user_id = $2 AND metric_name = ANY($3) AND lab_type = $4`,
        [to, req.userId, from, labType],
      );
    } else {
      await pool.query(
        `UPDATE lab_results SET metric_name = $1 WHERE user_id = $2 AND metric_name = ANY($3)`,
        [to, req.userId, from],
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/labs/:id
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    const { metricName, date, value, unit, refLow, refHigh, refText, labType } = req.body;
    const { rows } = await pool.query(
      `UPDATE lab_results SET
         metric_name = COALESCE($1, metric_name),
         date        = COALESCE($2::date, date),
         value       = $3,
         unit        = $4,
         ref_low     = $5,
         ref_high    = $6,
         ref_text    = $7,
         lab_type    = COALESCE($8, lab_type)
       WHERE id = $9 AND user_id = $10
       RETURNING ${SEL}`,
      [
        metricName ?? null, date ?? null,
        value   !== undefined ? value   : null,
        unit    !== undefined ? unit    : null,
        refLow  !== undefined ? refLow  : null,
        refHigh !== undefined ? refHigh : null,
        refText !== undefined ? refText : null,
        labType ?? null,
        req.params.id, req.userId,
      ],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' }) as any;
    res.json(rowToLab(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/labs  — clear all results for this user
router.delete('/', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM lab_results WHERE user_id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/labs/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM lab_results WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
