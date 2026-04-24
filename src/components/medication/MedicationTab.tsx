import React, { useState, useCallback } from 'react';
import type { Medication } from '../../types';
import {
  getMedications, getMedLogs, getMedLogsForDate,
  deleteMedication, saveMedication,
} from '../../storage';
import MedicationForm from './MedicationForm';
import DailyMedLog from './DailyMedLog';
import { IconPlus, IconList, IconLayers, IconLightbulb, IconSparkle } from '../Icons';
import BulkMedInputModal from './BulkMedInputModal';

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}


export default function MedicationTab() {
  const [meds, setMeds] = useState<Medication[]>(() => getMedications());
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editMed, setEditMed] = useState<Medication | undefined>();

  const reload = useCallback(() => setMeds(getMedications()), []);

  function openNew() { setEditMed(undefined); setShowForm(true); }
  function openEdit(med: Medication) { setEditMed(med); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditMed(undefined); }
  function handleSaved() { reload(); closeForm(); }

  function handleDelete(id: string) {
    if (window.confirm('Delete this medication?')) {
      deleteMedication(id);
      reload();
    }
  }

  function handleToggleActive(med: Medication) {
    saveMedication({ ...med, active: !med.active });
    reload();
  }

  function endDate(med: Medication): string | null {
    if (!med.startDate || !med.durationDays) return null;
    const d = new Date(med.startDate + 'T00:00:00');
    d.setDate(d.getDate() + med.durationDays - 1);
    return d.toISOString().split('T')[0];
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const allLogs = getMedLogs();
  const today = localDateStr();
  const todayLogs = getMedLogsForDate(today);

  function takenDaysCount(medId: string) {
    return new Set(allLogs.filter(l => l.medicationId === medId && l.taken).map(l => l.date)).size;
  }

  const completedCount = meds.filter(m => !!m.durationDays && takenDaysCount(m.id) >= m.durationDays).length;
  const activeCount = meds.filter(m => m.active).length;

  // Today's doses
  const visibleMeds = meds.filter(m => m.active && (!m.startDate || m.startDate <= today));
  const totalDosesToday = visibleMeds.reduce((n, m) => n + m.timesOfDay.length, 0);
  const takenDosesToday = visibleMeds.reduce(
    (n, m) => n + m.timesOfDay.filter(t =>
      todayLogs.some(l => l.medicationId === m.id && l.timeOfDay === t && l.taken)
    ).length, 0,
  );
  const skippedDosesToday = visibleMeds.reduce(
    (n, m) => n + m.timesOfDay.filter(t =>
      todayLogs.some(l => l.medicationId === m.id && l.timeOfDay === t && l.skipped)
    ).length, 0,
  );
  const dosesPct = totalDosesToday > 0 ? Math.round((takenDosesToday / totalDosesToday) * 100) : 0;

  // Weekly adherence — last 7 completed days (today excluded), per-day schedule aware
  const past7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (i + 1)); return localDateStr(d);
  });
  let weeklyTaken = 0, weeklyTotal = 0;
  for (const day of past7Days) {
    const dayLogs = allLogs.filter(l => l.date === day);
    for (const med of meds) {
      if (med.startDate && med.startDate > day) continue;
      if (med.durationDays) {
        const takenByDay = new Set(
          allLogs.filter(l => l.medicationId === med.id && l.taken && l.date <= day).map(l => l.date)
        ).size;
        if (takenByDay >= med.durationDays) continue;
      } else {
        if (!med.active) continue;
      }
      weeklyTotal += med.timesOfDay.length;
      weeklyTaken += med.timesOfDay.filter(t =>
        dayLogs.some(l => l.medicationId === med.id && l.timeOfDay === t && l.taken)
      ).length;
    }
  }
  const weeklyAdherence = weeklyTotal > 0 ? Math.min(100, Math.round((weeklyTaken / weeklyTotal) * 100)) : 0;

  // Avg daily doses — 7 completed days ending yesterday (excludes today)
  const yesterday   = localDateStr((() => { const d = new Date(); d.setDate(d.getDate() - 1);  return d; })());
  const last7Start  = localDateStr((() => { const d = new Date(); d.setDate(d.getDate() - 7);  return d; })());
  const prev7Start  = localDateStr((() => { const d = new Date(); d.setDate(d.getDate() - 14); return d; })());
  const last7Taken  = allLogs.filter(l => l.taken && l.date >= last7Start && l.date <= yesterday).length;
  const prev7Taken  = allLogs.filter(l => l.taken && l.date >= prev7Start && l.date < last7Start).length;
  const avg7        = last7Taken / 7;
  const avg7Prev    = prev7Taken / 7;
  const avg7Display = avg7.toFixed(1);
  const avgDelta    = avg7 - avg7Prev;
  const hasPrevData = prev7Taken > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Overview strip ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
        <div className="flex-between" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, background: '#0ea5e9', flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text)' }}>
              Medications
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
          {[
            {
              label: 'Doses Today',
              value: totalDosesToday > 0 ? `${takenDosesToday}/${totalDosesToday}` : '—',
              sub: totalDosesToday === 0 ? 'none scheduled'
                : takenDosesToday === totalDosesToday ? 'all done!'
                : `${totalDosesToday - takenDosesToday - skippedDosesToday} remaining · ${skippedDosesToday} skipped`,
            },
            {
              label: 'Weekly Adherence',
              value: `${weeklyAdherence}%`,
              sub: 'consistency is key',
            },
            {
              label: 'Avg Daily (7d)',
              value: avg7Display,
              sub: !hasPrevData ? 'no prior data'
                : avgDelta === 0 ? 'same as prev. week'
                : `${avgDelta > 0 ? '+' : ''}${avgDelta.toFixed(1)} vs prev. week`,
            },
          ].map((m, i, arr) => (
            <div key={m.label} style={{
              flex: 1, minWidth: 0, padding: '14px 18px',
              borderRight: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {m.label}
              </span>
              <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0ea5e9', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                {m.value}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                {m.sub}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="med-main-layout">

        {/* Left: Medication Log */}
        <div>
          <DailyMedLog medications={meds} onMedicationCompleted={reload} />
        </div>

        {/* Right: Sidebar */}
        <div className="med-sidebar">

          <div style={{
            background: 'var(--surface)', borderRadius: 4, padding: 20,
            border: '2px solid rgba(14,165,233,0.4)',
            borderTop: '3px solid #0ea5e9',
          }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text)', margin: '0 0 16px' }}>
              Prescriptions
            </p>

            {/* Divided stat row */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', marginBottom: 16 }}>
              <div style={{ flex: 1, padding: '14px 12px', textAlign: 'center', borderRight: '1px solid var(--border)' }}>
                <span style={{ display: 'block', fontSize: '2rem', fontWeight: 700, color: '#0ea5e9', lineHeight: 1, letterSpacing: '-1px', fontFamily: "'JetBrains Mono', monospace" }}>{activeCount}</span>
                <span style={{ display: 'block', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginTop: 5 }}>Active</span>
              </div>
              <div style={{ flex: 1, padding: '14px 12px', textAlign: 'center' }}>
                <span style={{ display: 'block', fontSize: '2rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1, letterSpacing: '-1px', fontFamily: "'JetBrains Mono', monospace" }}>{completedCount}</span>
                <span style={{ display: 'block', fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginTop: 5 }}>Completed</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={openNew} style={{
                width: '100%', background: '#0ea5e9', color: 'var(--bg)',
                fontWeight: 700, padding: 11, borderRadius: 4, border: 'none',
                fontFamily: 'inherit', fontSize: '0.78rem', letterSpacing: '0.08em',
                textTransform: 'uppercase', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'opacity 0.12s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <IconPlus size={16} /> Add Medication
              </button>
              <button onClick={() => setShowList(true)} style={{
                width: '100%', background: 'transparent', color: 'var(--text)',
                fontWeight: 600, padding: 11, borderRadius: 4, border: '1px solid var(--border-mid)',
                fontFamily: 'inherit', fontSize: '0.78rem', letterSpacing: '0.08em',
                textTransform: 'uppercase', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'background 0.12s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <IconList size={15} /> View Full List
              </button>
              {meds.length > 0 && (
                <button onClick={() => setShowBulk(true)} style={{
                  width: '100%', background: 'transparent', color: 'var(--text-muted)',
                  fontWeight: 600, padding: 11, borderRadius: 4, border: '1px solid var(--border)',
                  fontFamily: 'inherit', fontSize: '0.78rem', letterSpacing: '0.08em',
                  textTransform: 'uppercase', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'background 0.12s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <IconLayers size={13} /> Bulk Input
                </button>
              )}
            </div>
          </div>

          <div className="med-tip-card">
            <IconLightbulb size={28} color="var(--accent)" />
            <h4 className="med-tip-title">Did you know?</h4>
            <p className="med-tip-body">
              Consistency improves the efficacy of your treatment plan by up to 40%. Try setting reminders.
            </p>
          </div>

        </div>
      </div>

      {/* ── Full list modal ── */}
      {showList && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setShowList(false); }}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <p className="modal-title">My Medications</p>
              <button className="btn btn-ghost" onClick={() => setShowList(false)}>✕</button>
            </div>
            <div className="modal-body">
              {meds.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                  No medications added yet.
                </p>
              ) : (
                <div className="med-list">
                  {meds.map(med => (
                    <div key={med.id} className={`med-card${med.active ? '' : ' inactive'}`}>
                      <div style={{ flex: 1 }}>
                        <p className="med-card-name">{med.name}</p>
                        <div className="med-card-meta">
                          {med.dose && <span className="meta-tag">{med.dose}</span>}
                          {med.timesOfDay.length > 0 && (
                            <span className="meta-tag">
                              {med.timesOfDay.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' · ')}
                            </span>
                          )}
                          {med.startDate && (
                            <span className="meta-tag">
                              {med.startDate}
                              {endDate(med) ? ` → ${endDate(med)}` : ''}
                              {med.durationDays ? ` (${med.durationDays} days)` : ''}
                            </span>
                          )}
                          {med.purpose && <span className="meta-tag">{med.purpose}</span>}
                          {med.prescribingDoctor && (
                            <span className="meta-tag">Dr. {med.prescribingDoctor}</span>
                          )}
                          <span
                            className="meta-tag"
                            style={{
                              cursor: 'pointer',
                              background: med.active ? 'var(--success-bg)' : 'var(--surface-alt)',
                              borderColor: med.active ? 'var(--success)' : 'var(--border)',
                              color: med.active ? 'var(--success)' : 'var(--text-muted)',
                            }}
                            onClick={() => handleToggleActive(med)}
                            title="Click to toggle active status"
                          >
                            {med.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                      <div className="med-card-actions">
                        <button className="btn btn-ghost" onClick={() => { openEdit(med); setShowList(false); }}>Edit</button>
                        <button
                          className="btn btn-ghost"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleDelete(med.id)}
                        >Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk log modal ── */}
      {showBulk && (
        <BulkMedInputModal medications={meds} onClose={() => { setShowBulk(false); reload(); }} />
      )}

      {/* ── Add / edit modal ── */}
      {showForm && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal">
            <div className="modal-header">
              <p className="modal-title">{editMed ? 'Edit Medication' : 'Add Medication'}</p>
              <button className="btn btn-ghost" onClick={closeForm}>✕</button>
            </div>
            <MedicationForm onSaved={handleSaved} onCancel={closeForm} initial={editMed} />
          </div>
        </div>
      )}

    </div>
  );
}
