import { IconCheckCircle, IconEmptyCircle, IconSparkle } from '../Icons';
import { useState, useRef, useEffect } from 'react';
import type { Habit, HabitLog } from '../../types';
import { getHabitLogs, getHabitLogsForDate, setHabitLog } from '../../storage';
import HabitInfoModal from './HabitInfoModal';

interface Props {
  habits: Habit[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayDate() { return localDateStr(new Date()); }

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

function isHabitDone(habit: Habit, value: number | undefined): boolean {
  if (value == null) return false;
  if (habit.type === 'boolean') return value > 0;
  if (habit.target != null) return value >= habit.target;
  return value > 0;
}

function computeStreak(habit: Habit, allLogs: HabitLog[]): number {
  const d = new Date();
  const todayStr = localDateStr(d);
  const todayLog = allLogs.find(l => l.habitId === habit.id && l.date === todayStr);
  if (!isHabitDone(habit, todayLog?.value)) {
    d.setDate(d.getDate() - 1);
  }
  let streak = 0;
  while (true) {
    const ds = localDateStr(d);
    const log = allLogs.find(l => l.habitId === habit.id && l.date === ds);
    if (!isHabitDone(habit, log?.value)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// Returns all YYYY-MM-DD strings for the Mon–Sun week containing dateStr
function weekDatesFor(dateStr: string): string[] {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return localDateStr(day);
  });
}

function computeWeekCount(habit: Habit, allLogs: HabitLog[], dateStr: string): number {
  return weekDatesFor(dateStr).filter(ds => {
    const log = allLogs.find(l => l.habitId === habit.id && l.date === ds);
    return isHabitDone(habit, log?.value);
  }).length;
}

function computeMaxStreak(habit: Habit, allLogs: HabitLog[]): number {
  const doneDates = allLogs
    .filter(l => l.habitId === habit.id && isHabitDone(habit, l.value))
    .map(l => l.date)
    .sort();
  if (doneDates.length === 0) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < doneDates.length; i++) {
    const prev = new Date(doneDates[i-1] + 'T00:00:00');
    const next = new Date(doneDates[i]   + 'T00:00:00');
    const diff = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > max) max = cur;
  }
  return max;
}

export default function DailyHabitLog({ habits }: Props) {
  const [date, setDate]       = useState(todayDate);
  const [logs, setLogs]       = useState(() => getHabitLogsForDate(todayDate()));
  const [allLogs, setAllLogs] = useState(() => getHabitLogs());
  // tracks which numeric habits are in "edit" mode (badge clicked to reveal input)
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [infoHabit, setInfoHabit] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    function handleOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showPicker]);

  function openPicker() {
    const d = new Date(date + 'T00:00:00');
    setPickerYear(d.getFullYear());
    setPickerMonth(d.getMonth());
    setShowPicker(true);
  }

  function shiftPickerMonth(delta: number) {
    let m = pickerMonth + delta;
    let y = pickerYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setPickerMonth(m);
    setPickerYear(y);
  }

  function selectPickerDate(day: number) {
    const d = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    changeDate(d);
    setShowPicker(false);
  }

  function changeDate(newDate: string) {
    setDate(newDate);
    setLogs(getHabitLogsForDate(newDate));
    setEditingIds(new Set());
  }

  function shiftDate(days: number) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    changeDate(localDateStr(d));
  }

  function getLogValue(habitId: string): number | undefined {
    return logs.find(l => l.habitId === habitId)?.value;
  }

  function handleBoolean(habit: Habit) {
    const current = getLogValue(habit.id) ?? 0;
    setHabitLog(date, habit.id, current > 0 ? 0 : 1);
    setLogs(getHabitLogsForDate(date));
    setAllLogs(getHabitLogs());
  }

  function handleNumericCommit(habit: Habit, raw: string) {
    const val = raw === '' ? 0 : Math.max(0, parseFloat(raw.replace(',', '.')));
    if (isNaN(val)) return;
    setHabitLog(date, habit.id, val);
    setLogs(getHabitLogsForDate(date));
    setAllLogs(getHabitLogs());
    // hide input again after committing
    setEditingIds(prev => { const s = new Set(prev); s.delete(habit.id); return s; });
  }

  function startEditingNumeric(habitId: string) {
    setEditingIds(prev => new Set(prev).add(habitId));
  }

  const dailyHabits = habits.filter(h => (h.frequency ?? 'daily') === 'daily');
  const weeklyHabits = habits.filter(h => h.frequency === 'weekly');

  function sortByDone(list: Habit[]) {
    return [...list].sort((a, b) => {
      const aDone = isHabitDone(a, getLogValue(a.id)) ? 1 : 0;
      const bDone = isHabitDone(b, getLogValue(b.id)) ? 1 : 0;
      return aDone - bDone;
    });
  }

  function renderHabitRow(h: Habit, isWeekly = false) {
    const value = getLogValue(h.id);
    const done = isHabitDone(h, value);
    const streak = computeStreak(h, allLogs);
    const weekCount = isWeekly ? computeWeekCount(h, allLogs, date) : 0;
    const isEditing = editingIds.has(h.id);

    return (
      <div key={h.id} className={`habit-log-row${done ? ' habit-log-row--done' : ''}`}>
        {/* Icon */}
        <div className="habit-log-icon">{h.icon ?? '○'}</div>

        {/* Name + AI button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span className="habit-mgmt-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {h.name}
          </span>
          <button className="med-info-btn" style={{ flexShrink: 0 }} onClick={() => setInfoHabit(h.name)}>
            <IconSparkle size={12} color="#a78bfa" />
          </button>
        </div>

        {/* Target */}
        <div className="habit-log-target">
          <div className="habit-mgmt-meta-label">Target</div>
          <div className="habit-mgmt-meta-value">
            {isWeekly
              ? h.weeklyTarget != null ? `${h.weeklyTarget}×/week` : '—'
              : h.target != null
                ? `${h.target}${h.unit ? ` ${h.unit}` : ''}`
                : h.unit ?? '—'}
          </div>
        </div>

        {/* Streak (daily) or week count (weekly) */}
        {isWeekly ? (
          <div className="habit-log-streak">
            <div className="habit-mgmt-meta-label">This week</div>
            <div className="habit-mgmt-meta-value" style={{ color: weekCount > 0 ? 'var(--accent)' : undefined }}>
              {weekCount}{h.weeklyTarget != null ? `/${h.weeklyTarget}` : ''} done
            </div>
          </div>
        ) : (
          <div className="habit-log-streak">
            <div className="habit-mgmt-meta-label">Streak</div>
            <div className="habit-mgmt-meta-value" style={{ color: streak > 0 ? '#f59e0b' : undefined }}>
              {streak > 0 ? `🔥 ${streak} day${streak !== 1 ? 's' : ''}` : '—'}
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {h.type === 'boolean' ? (
          <img
            src={undefined}
            alt={done ? 'done' : 'not done'}
            style={{ width: 40, height: 40, cursor: 'pointer', flexShrink: 0, display: 'block' }}
            onClick={() => handleBoolean(h)}
          />
        ) : isEditing ? (
          <div className="habit-numeric-wrap" style={{ width: '100%' }}>
            <input
              type="text"
              inputMode="decimal"
              defaultValue={value ?? ''}
              autoFocus
              className="habit-number-input"
              style={{ width: '100%' }}
              onBlur={e => handleNumericCommit(h, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleNumericCommit(h, e.currentTarget.value);
                if (e.key === 'Escape') setEditingIds(prev => { const s = new Set(prev); s.delete(h.id); return s; });
              }}
            />
          </div>
        ) : done ? (
          <img
            src={undefined}
            alt="done"
            style={{ width: 40, height: 40, cursor: 'pointer', flexShrink: 0, display: 'block' }}
            onClick={() => startEditingNumeric(h.id)}
          />
        ) : (
          <button
            onClick={() => startEditingNumeric(h.id)}
            style={{
              background: 'transparent',
              border: '1.5px solid rgba(59,130,246,0.3)',
              borderRadius: 12,
              padding: 0,
              height: 40,
              boxSizing: 'border-box',
              color: 'var(--text)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {value != null ? value : '—'}
          </button>
        )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header: title + date nav */}
      <div className="med-log-header" style={{ marginBottom: 20 }}>
        <h2 className="habit-section-title">Today's Progress</h2>
        <div className="med-date-nav" ref={pickerRef}>
          <button className="med-date-btn" onClick={() => shiftDate(-1)}>‹</button>
          <button className="med-date-label" onClick={openPicker}>
            {formatDisplayDate(date)}
          </button>
          <button className="med-date-btn" onClick={() => shiftDate(1)}>›</button>
          {showPicker && (() => {
            const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
            const firstDow = new Date(pickerYear, pickerMonth, 1).getDay();
            const today = todayDate();
            const cells: (number | null)[] = [];
            for (let i = 0; i < firstDow; i++) cells.push(null);
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            while (cells.length % 7 !== 0) cells.push(null);
            return (
              <div className="date-picker-dropdown">
                <div className="date-picker-header">
                  <button className="date-picker-nav" onClick={() => shiftPickerMonth(-1)}>‹</button>
                  <span className="date-picker-month-label">{MONTHS[pickerMonth]} {pickerYear}</span>
                  <button className="date-picker-nav" onClick={() => shiftPickerMonth(1)}>›</button>
                </div>
                <div className="date-picker-grid">
                  {DAY_LETTERS.map(l => (
                    <span key={l} className="date-picker-dow">{l}</span>
                  ))}
                  {cells.map((day, i) => {
                    if (day === null) return <span key={`e${i}`} />;
                    const cellDate = `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isToday = cellDate === today;
                    const isSelected = cellDate === date;
                    return (
                      <button
                        key={cellDate}
                        className={`date-picker-cell${isSelected ? ' selected' : isToday ? ' today' : ''}`}
                        onClick={() => selectPickerDate(day)}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="date-picker-today-btn"
                  onClick={() => { changeDate(today); setShowPicker(false); }}
                >
                  Today
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* List */}
      {habits.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <p className="text-muted">No habits yet. Add one using the sidebar →</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Daily Habits section ── */}
          {dailyHabits.length > 0 && (
            <div className="med-section" style={{ padding: 0 }}>
              <div className="med-section-header" style={{ cursor: 'default' }}>
                <div className="med-section-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#3B82F6"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <h3 className="med-section-title">Daily Habits</h3>
                <span className="med-section-badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                  {dailyHabits.filter(h => isHabitDone(h, getLogValue(h.id))).length}/{dailyHabits.length} done
                </span>
              </div>
              <div className="med-section-items" style={{ padding: '0 12px 12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sortByDone(dailyHabits).map(h => renderHabitRow(h))}
                </div>
              </div>
            </div>
          )}

          {/* ── Weekly Habits section ── */}
          {weeklyHabits.length > 0 && (
            <div className="med-section" style={{ padding: 0 }}>
              <div className="med-section-header" style={{ cursor: 'default' }}>
                <div className="med-section-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#3B82F6" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
                <h3 className="med-section-title">Weekly Habits</h3>
                <span className="med-section-badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                  {weeklyHabits.filter(h => isHabitDone(h, getLogValue(h.id))).length}/{weeklyHabits.length} done
                </span>
              </div>
              <div className="med-section-items" style={{ padding: '0 12px 12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sortByDone(weeklyHabits).map(h => renderHabitRow(h, true))}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {infoHabit && (
        <HabitInfoModal habitName={infoHabit} onClose={() => setInfoHabit(null)} />
      )}
    </div>
  );
}
