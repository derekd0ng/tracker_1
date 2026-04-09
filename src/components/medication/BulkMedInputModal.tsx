import { useState, useEffect } from 'react';
import type { Medication, TimeOfDay } from '../../types';
import { TIMES_OF_DAY } from '../../types';
import { getMedLogs, bulkSetMedLogs } from '../../storage';

interface Props {
  medications: Medication[];
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TIME_ICON_SRC: Record<TimeOfDay, string> = {
  morning: '/icon-morning.png',
  afternoon: '/icon-afternoon.png',
  evening: '/icon-evening.png',
  night: '/icon-night.png',
};
const TIME_SHORT: Record<TimeOfDay, string> = {
  morning: 'Morn', afternoon: 'Aft', evening: 'Eve', night: 'Night',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function BulkMedInputModal({ medications, onClose }: Props) {
  const now = new Date();
  const [medId, setMedId] = useState(medications[0]?.id ?? '');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  // key: "date|timeOfDay"
  const [values, setValues] = useState<Record<string, boolean>>({});

  const med = medications.find(m => m.id === medId);
  const slots = med ? TIMES_OF_DAY.filter(t => med.timesOfDay.includes(t)) : [];

  useEffect(() => {
    if (!med) return;
    const allLogs = getMedLogs();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const next: Record<string, boolean> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = localDateStr(year, month, d);
      for (const t of med.timesOfDay) {
        const log = allLogs.find(
          l => l.date === dateStr && l.medicationId === med.id && l.timeOfDay === t,
        );
        if (log?.taken) next[`${dateStr}|${t}`] = true;
      }
    }
    setValues(next);
  }, [medId, year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  }

  function toggle(dateStr: string, t: TimeOfDay) {
    const key = `${dateStr}|${t}`;
    setValues(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleRow(dateStr: string, taken: boolean) {
    setValues(prev => {
      const next = { ...prev };
      for (const t of slots) next[`${dateStr}|${t}`] = taken;
      return next;
    });
  }

  function handleMedKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    day: number,
    slotIdx: number,
  ) {
    const totalCols = slots.length + 1; // +1 for the "All" column
    let dayDelta = 0;
    let slotDelta = 0;

    if (e.key === 'ArrowDown' || e.key === 'Enter') dayDelta = 1;
    else if (e.key === 'ArrowUp') dayDelta = -1;
    else if (e.key === 'ArrowRight') slotDelta = 1;
    else if (e.key === 'ArrowLeft') slotDelta = -1;
    else return;

    // Enter: toggle current checkbox before moving down
    if (e.key === 'Enter') {
      const dateStr = localDateStr(year, month, day);
      if (slotIdx < slots.length) {
        toggle(dateStr, slots[slotIdx]);
      } else {
        const allTaken = slots.every(t => !!values[`${dateStr}|${t}`]);
        toggleRow(dateStr, !allTaken);
      }
    }

    e.preventDefault();

    const nextDay = day + dayDelta;
    const nextSlot = slotIdx + slotDelta;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (nextDay < 1 || nextDay > daysInMonth) return;
    if (nextSlot < 0 || nextSlot >= totalCols) return;

    const nextDate = localDateStr(year, month, nextDay);
    (document.querySelector(`[data-date="${nextDate}"][data-slot="${nextSlot}"]`) as HTMLElement | null)?.focus();
  }

  function handleSave() {
    if (!med) return;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const entries: Array<{ date: string; medicationId: string; timeOfDay: TimeOfDay; taken: boolean }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = localDateStr(year, month, d);
      for (const t of TIMES_OF_DAY) {
        entries.push({
          date: dateStr,
          medicationId: med.id,
          timeOfDay: t,
          taken: !!values[`${dateStr}|${t}`],
        });
      }
    }
    bulkSetMedLogs(entries);
    onClose();
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal bulk-modal">
        <div className="modal-header">
          <p className="modal-title">Bulk Medication Log</p>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Medication</label>
            <select
              className="form-input"
              value={medId}
              onChange={e => setMedId(e.target.value)}
            >
              {medications.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.dose ? ` · ${m.dose}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="bulk-month-nav">
            <button className="day-nav-btn" onClick={() => shiftMonth(-1)}>‹</button>
            <span className="bulk-month-label">{MONTHS[month]} {year}</span>
            <button className="day-nav-btn" onClick={() => shiftMonth(1)}>›</button>
          </div>

          {med && slots.length === 0 && (
            <p className="text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>
              This medication has no times of day set. Edit it to assign a schedule.
            </p>
          )}

          {med && slots.length > 0 && (
            <div className="bulk-med-scroll">
              <table className="bulk-med-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {slots.map(t => (
                      <th key={t}>
                        <img src={TIME_ICON_SRC[t]} alt={t} style={{ width: 24, height: 24, objectFit: 'contain', display: 'block', margin: '0 auto 2px' }} />
                        {TIME_SHORT[t]}
                      </th>
                    ))}
                    <th>All</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                    const dateStr = localDateStr(year, month, d);
                    const dow = new Date(year, month, d).getDay();
                    const allTaken = slots.every(t => !!values[`${dateStr}|${t}`]);
                    return (
                      <tr key={dateStr}>
                        <td>
                          <span className="bulk-med-date">{d}</span>
                          <span className="bulk-med-dow">{DAY_NAMES[dow]}</span>
                        </td>
                        {slots.map((t, si) => (
                          <td key={t}>
                            <input
                              data-date={dateStr}
                              data-slot={si}
                              type="checkbox"
                              className="bulk-med-checkbox"
                              checked={!!values[`${dateStr}|${t}`]}
                              onChange={() => toggle(dateStr, t)}
                              onKeyDown={e => handleMedKeyDown(e, d, si)}
                            />
                          </td>
                        ))}
                        <td>
                          <input
                            data-date={dateStr}
                            data-slot={slots.length}
                            type="checkbox"
                            className="bulk-med-checkbox"
                            checked={allTaken}
                            onChange={() => toggleRow(dateStr, !allTaken)}
                            onKeyDown={e => handleMedKeyDown(e, d, slots.length)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
