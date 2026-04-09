import { useState, useEffect } from 'react';
import type { Habit } from '../../types';
import { getHabitLogs, bulkSetHabitLogs } from '../../storage';

interface Props {
  habits: Habit[];
  onClose: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export default function BulkHabitInputModal({ habits, onClose }: Props) {
  const now = new Date();
  const [habitId, setHabitId] = useState(habits[0]?.id ?? '');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [values, setValues] = useState<Record<string, string>>({});

  const habit = habits.find(h => h.id === habitId);

  useEffect(() => {
    if (!habit) return;
    const allLogs = getHabitLogs();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const next: Record<string, string> = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const log = allLogs.find(l => l.date === dateStr && l.habitId === habit.id);
      if (log != null) {
        next[dateStr] = habit.type === 'boolean' ? (log.value > 0 ? '1' : '0') : String(log.value);
      }
    }
    setValues(next);
  }, [habitId, year, month]);

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m);
    setYear(y);
  }

  function toggleDay(dateStr: string) {
    setValues(prev => ({ ...prev, [dateStr]: prev[dateStr] === '1' ? '0' : '1' }));
  }

  function setNumeric(dateStr: string, val: string) {
    setValues(prev => ({ ...prev, [dateStr]: val }));
  }

  function focusDay(day: number) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (day < 1 || day > daysInMonth) return;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    (document.querySelector(`[data-date="${dateStr}"]`) as HTMLElement | null)?.focus();
  }

  function handleCalKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>,
    day: number,
    isBoolean: boolean,
  ) {
    const delta =
      e.key === 'ArrowRight' || e.key === 'Enter' ? 1
      : e.key === 'ArrowLeft' ? -1
      : e.key === 'ArrowDown' ? 7
      : e.key === 'ArrowUp' ? -7
      : 0;
    if (!delta) return;
    e.preventDefault();
    // Boolean Enter: toggle current cell before moving
    if (e.key === 'Enter' && isBoolean) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      toggleDay(dateStr);
    }
    focusDay(day + delta);
  }

  function handleSave() {
    if (!habit) return;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const entries: Array<{ date: string; habitId: string; value: number | null }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const raw = values[dateStr];
      if (raw == null || raw === '') {
        entries.push({ date: dateStr, habitId: habit.id, value: null });
      } else if (habit.type === 'boolean') {
        entries.push({ date: dateStr, habitId: habit.id, value: raw === '1' ? 1 : 0 });
      } else {
        const num = parseFloat(raw.replace(',', '.'));
        entries.push({ date: dateStr, habitId: habit.id, value: isNaN(num) ? null : num });
      }
    }
    bulkSetHabitLogs(entries);
    onClose();
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal bulk-modal">
        <div className="modal-header">
          <p className="modal-title">Bulk Habit Input</p>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Habit</label>
            <select
              className="form-input"
              value={habitId}
              onChange={e => setHabitId(e.target.value)}
            >
              {habits.map(h => (
                <option key={h.id} value={h.id}>
                  {h.icon ? `${h.icon} ` : ''}{h.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bulk-month-nav">
            <button className="day-nav-btn" onClick={() => shiftMonth(-1)}>‹</button>
            <span className="bulk-month-label">{MONTHS[month]} {year}</span>
            <button className="day-nav-btn" onClick={() => shiftMonth(1)}>›</button>
          </div>

          {habit && (
            <>
              <div className="bulk-calendar">
                {DAY_HEADERS.map(d => (
                  <div key={d} className="bulk-cal-header">{d}</div>
                ))}
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e${i}`} />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const val = values[dateStr];
                  const isFilled = habit.type === 'boolean' ? val === '1' : (val != null && val !== '' && val !== '0');
                  return (
                    <div key={dateStr} className={`bulk-cal-cell${isFilled ? ' filled' : ''}`}>
                      <span className="bulk-cal-day">{day}</span>
                      {habit.type === 'boolean' ? (
                        <button
                          data-date={dateStr}
                          className={`bulk-cal-check${val === '1' ? ' active' : ''}`}
                          onClick={() => toggleDay(dateStr)}
                          onKeyDown={e => handleCalKeyDown(e, day, true)}
                        >
                          {val === '1' ? '✓' : ''}
                        </button>
                      ) : (
                        <input
                          data-date={dateStr}
                          className="bulk-cal-input"
                          type="text"
                          inputMode="decimal"
                          value={val ?? ''}
                          onChange={e => setNumeric(dateStr, e.target.value)}
                          onKeyDown={e => handleCalKeyDown(e, day, false)}
                          placeholder="—"
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {habit.type === 'numeric' && (habit.unit || habit.target != null) && (
                <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 10, textAlign: 'center' }}>
                  {habit.unit ? `Unit: ${habit.unit}` : ''}
                  {habit.unit && habit.target != null ? ' · ' : ''}
                  {habit.target != null ? `Target: ${habit.target}` : ''}
                </p>
              )}
            </>
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
