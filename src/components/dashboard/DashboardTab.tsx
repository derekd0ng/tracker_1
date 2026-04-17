import { useState, useRef } from 'react';
import { api } from '../../api';
import WellbeingSnapshot from '../wellbeing/WellbeingSnapshot';
import type { Medication, TimeOfDay, Habit, HabitLog } from '../../types';
import { TIMES_OF_DAY } from '../../types';
import {
  getWellbeingEntries,
  getMedications,
  getMedLogsForDate,
  getMedLogs,
  toggleMedLog,
  getHabits,
  getHabitLogs,
  getHabitLogsForDate,
  setHabitLog,
} from '../../storage';

// ── Helpers ────────────────────────────────────────────────────────────────

function localDateStr(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function currentTimeSlot(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 8 && h < 13) return 'morning';
  if (h >= 13 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}

function greetingPrefix(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
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
  if (!isHabitDone(habit, todayLog?.value)) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (true) {
    const dateStr = localDateStr(d);
    const log = allLogs.find(l => l.habitId === habit.id && l.date === dateStr);
    if (!isHabitDone(habit, log?.value)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}


function isMedVisible(med: Medication, today: string): boolean {
  return med.active && (!med.startDate || med.startDate <= today);
}
function takenDaysCount(medId: string, allMedLogs: ReturnType<typeof getMedLogs>): number {
  return new Set(allMedLogs.filter(l => l.medicationId === medId && l.taken).map(l => l.date)).size;
}
function isCompleted(med: Medication, allMedLogs: ReturnType<typeof getMedLogs>): boolean {
  return !!med.durationDays && takenDaysCount(med.id, allMedLogs) >= med.durationDays;
}

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night',
};

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}


// ── Component ──────────────────────────────────────────────────────────────

import type { TabId } from '../../types';

interface Props {
  onNavigate: (tab: TabId) => void;
  user?: { id: string; email: string; name?: string | null } | null;
  onUserUpdate?: (user: { id: string; email: string; name?: string | null }) => void;
}

// Arrow-right icon for nav buttons
function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const NAV_BTN_BASE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '10px 12px', borderRadius: 8, border: 'none',
  cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s',
};

export default function DashboardTab({ onNavigate, user, onUserUpdate }: Props) {
  const today = localDateStr();
  const currentSlot = currentTimeSlot();

  // ── Name editing ──
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]     = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  function startNameEdit() {
    setNameInput(user?.name ?? '');
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  async function commitName() {
    setEditingName(false);
    const trimmed = nameInput.trim();
    try {
      const data = await api.patch('/api/auth/me', { name: trimmed || null });
      onUserUpdate?.(data.user);
    } catch (e) {
      console.error('update name:', e);
    }
  }

  function handleNameKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  commitName();
    if (e.key === 'Escape') setEditingName(false);
  }

  // ── Wellbeing ──
  const allWellbeing = getWellbeingEntries().sort(
    (a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time),
  );
  const latestEntry = allWellbeing[0] ?? null;

  // ── Medications ──
  const allMeds = getMedications();
  const allMedLogs = getMedLogs();
  const [todayMedLogs, setTodayMedLogs] = useState(() => getMedLogsForDate(today));

  function handleToggleMed(medId: string, slot: TimeOfDay) {
    toggleMedLog(today, medId, slot);
    setTodayMedLogs(getMedLogsForDate(today));
  }
  const visibleMeds = allMeds.filter(m => isMedVisible(m, today) && !isCompleted(m, allMedLogs));
  const totalDosesToday = visibleMeds.reduce((n, m) => n + m.timesOfDay.length, 0);
  const takenDosesToday = visibleMeds.reduce((n, m) => n + m.timesOfDay.filter(t => {
    if (todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === t && l.taken)) return true;
    const moveLog = todayMedLogs.find(l => l.medicationId === m.id && l.timeOfDay === t && l.movedTo != null);
    return moveLog != null && todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === moveLog.movedTo && l.taken);
  }).length, 0);
  const skippedDosesToday = visibleMeds.reduce((n, m) => n + m.timesOfDay.filter(t => {
    if (todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === t && l.skipped)) return true;
    const moveLog = todayMedLogs.find(l => l.medicationId === m.id && l.timeOfDay === t && l.movedTo != null);
    return moveLog != null && todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === moveLog.movedTo && l.skipped);
  }).length, 0);

  // Next pending med label
  const nextPendingLabel = (() => {
    for (const slot of TIMES_OF_DAY) {
      const pending = visibleMeds.filter(m =>
        m.timesOfDay.includes(slot) &&
        !todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === slot && (l.taken || l.skipped))
      );
      if (pending.length > 0) return `Next: ${pending[0].name} (${TIME_LABELS[slot]})`;
    }
    return totalDosesToday > 0 ? 'All decided for today' : 'Nothing scheduled';
  })();

  // ── Move-aware helpers ──
  function isMovedFromSlot(medId: string, slot: TimeOfDay): boolean {
    return todayMedLogs.some(l => l.medicationId === medId && l.timeOfDay === slot && l.movedTo != null);
  }
  function movedInToSlot(slot: TimeOfDay): Medication[] {
    return visibleMeds.filter(m =>
      !m.timesOfDay.includes(slot) &&
      todayMedLogs.some(l => l.medicationId === m.id && l.movedTo === slot)
    );
  }
  function isMedHandledInSlot(med: Medication, slot: TimeOfDay): boolean {
    return todayMedLogs.some(l =>
      l.medicationId === med.id && l.timeOfDay === slot && (l.taken || l.skipped || l.movedTo != null)
    );
  }

  // ── Slot helpers (for active/overdue styling) ──
  const SLOT_START_HOUR: Record<TimeOfDay, number> = { morning: 8, afternoon: 13, evening: 17, night: 20 };
  const currentHour = new Date().getHours();

  const visibleSlots = TIMES_OF_DAY.filter(t =>
    visibleMeds.some(m => m.timesOfDay.includes(t)) ||
    visibleMeds.some(m => todayMedLogs.some(l => l.medicationId === m.id && l.movedTo === t))
  );

  // Only slots whose start hour has been reached count as started
  const startedSlots = visibleSlots.filter(t => currentHour >= SLOT_START_HOUR[t]);

  const pendingStartedSlots = startedSlots.filter(t => {
    const normalPending = visibleMeds.filter(m => m.timesOfDay.includes(t)).some(m => !isMedHandledInSlot(m, t));
    const movedInPending = movedInToSlot(t).some(m =>
      !todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === t && (l.taken || l.skipped))
    );
    return normalPending || movedInPending;
  });

  const activeSlot = (() => {
    if (pendingStartedSlots.length === 0) return null;
    if (pendingStartedSlots.includes(currentSlot)) return currentSlot;
    return [...TIMES_OF_DAY].reverse().find(t => pendingStartedSlots.includes(t)) ?? null;
  })();
  const activeSlotIdx = activeSlot ? TIMES_OF_DAY.indexOf(activeSlot) : -1;
  const overdueSlots  = pendingStartedSlots.filter(t => TIMES_OF_DAY.indexOf(t) < activeSlotIdx);

  const [slotOverrides, setSlotOverrides] = useState<Map<TimeOfDay, boolean>>(new Map());

  // ── Habits ──
  const habits = getHabits();
  const allHabitLogs = getHabitLogs();
  const [todayHabitLogs, setTodayHabitLogs] = useState(() => getHabitLogsForDate(today));
  const [dashEditingIds, setDashEditingIds] = useState<Set<string>>(new Set());

  function handleHabitBoolean(habitId: string, currentValue: number | undefined) {
    setHabitLog(today, habitId, (currentValue ?? 0) > 0 ? 0 : 1);
    setTodayHabitLogs(getHabitLogsForDate(today));
  }

  function handleHabitNumericCommit(habitId: string, raw: string) {
    const val = raw === '' ? 0 : Math.max(0, parseFloat(raw.replace(',', '.')));
    if (isNaN(val)) return;
    setHabitLog(today, habitId, val);
    setTodayHabitLogs(getHabitLogsForDate(today));
    setDashEditingIds(prev => { const s = new Set(prev); s.delete(habitId); return s; });
  }

  function weekDatesFor(dateStr: string): string[] {
    const d = new Date(dateStr + 'T00:00:00');
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return localDateStr(day);
    });
  }

  function computeWeekCount(habit: Habit): number {
    return weekDatesFor(today).filter(ds => {
      const log = allHabitLogs.find(l => l.habitId === habit.id && l.date === ds);
      return isHabitDone(habit, log?.value);
    }).length;
  }

  const dailyHabits = habits.filter(h => (h.frequency ?? 'daily') === 'daily');
  const weeklyHabits = habits.filter(h => h.frequency === 'weekly');
  const [habitSectionsOpen, setHabitSectionsOpen] = useState<{ daily: boolean; weekly: boolean }>({ daily: true, weekly: true });
  function toggleHabitSection(key: 'daily' | 'weekly') {
    setHabitSectionsOpen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function sortByDone(list: Habit[]) {
    return [...list].sort((a, b) => {
      const aDone = isHabitDone(a, todayHabitLogs.find(l => l.habitId === a.id)?.value) ? 1 : 0;
      const bDone = isHabitDone(b, todayHabitLogs.find(l => l.habitId === b.id)?.value) ? 1 : 0;
      return aDone - bDone;
    });
  }

  const habitsDoneToday = habits.filter(h =>
    isHabitDone(h, todayHabitLogs.find(l => l.habitId === h.id)?.value)
  ).length;
  const topStreak = habits.length > 0
    ? Math.max(...habits.map(h => computeStreak(h, allHabitLogs)))
    : 0;

  // ── Overall progress pct ──
  const overallDone = takenDosesToday + habitsDoneToday + (latestEntry ? ((latestEntry.overallFeel ?? 0) >= 5 ? 1 : 0) : 0);
  const overallTotal = totalDosesToday + habits.length + (allWellbeing.length > 0 ? 1 : 0);
  const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Greeting ── */}
      <section>
        <h2 className="dash-greeting">
          {greetingPrefix()},{' '}
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleNameKey}
              placeholder="Your name"
              maxLength={60}
              style={{
                background: 'transparent', border: 'none',
                borderBottom: '2px solid #22D3EE',
                color: 'inherit', font: 'inherit',
                fontSize: 'inherit', fontWeight: 'inherit',
                outline: 'none', padding: '0 2px',
                width: Math.max((nameInput.length || 6) + 2, 8) + 'ch',
              }}
            />
          ) : (
            <>
              {user?.name || 'User'}.
              <button
                onClick={startNameEdit}
                title="Edit name"
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: user?.name ? 'rgba(255,255,255,0.25)' : '#22D3EE',
                  display: 'inline-flex', alignItems: 'center',
                  transition: 'color 0.15s',
                  position: 'relative', top: -6, marginLeft: 6,
                  verticalAlign: 'middle',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#22D3EE')}
                onMouseLeave={e => (e.currentTarget.style.color = user?.name ? 'rgba(255,255,255,0.25)' : '#22D3EE')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}
        </h2>
        {overallTotal > 0 && (
          <p className="dash-greeting-sub">
            You've completed{' '}
            <span style={{ color: '#ffffff', fontWeight: 700 }}>{overallPct}%</span>
            {' '}of your daily recovery goals.
          </p>
        )}
      </section>


      {/* ── Well-being snapshot ── */}
      <div className="wb-theme">
        <WellbeingSnapshot navButton={
          <button onClick={() => onNavigate('wellbeing')} style={{ ...NAV_BTN_BASE, background: '#10B981', color: '#000' }}>
            <ArrowRight />
          </button>
        } />
      </div>

      {/* ── Bottom 2-column: Medications | Habits ── */}
      <div className="dash-bottom-grid">

        {/* Medications */}
        <div style={{ background: '#131b2e', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', padding: 20 }}>
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <p className="section-title" style={{ marginBottom: 0 }}>Medications</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {totalDosesToday > 0 && (
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#22D3EE' }}>
                  {takenDosesToday}/{totalDosesToday} taken
                </span>
              )}
              <button onClick={() => onNavigate('medication')} style={{ ...NAV_BTN_BASE, background: '#22D3EE', color: '#000' }}>
                <ArrowRight />
              </button>
            </div>
          </div>
          {visibleMeds.length === 0 ? (
            <p className="text-muted" style={{ padding: '8px 0' }}>No active medications.</p>
          ) : (
            <div className="med-sections">
              {visibleSlots.map(slot => {
                // Meds that should appear in this slot (excluding moved-away, including moved-in)
                const slotMedsAll = [
                  ...visibleMeds.filter(m => m.timesOfDay.includes(slot) && !isMovedFromSlot(m.id, slot)),
                  ...movedInToSlot(slot),
                ];

                const taken = slotMedsAll.filter(m =>
                  todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === slot && l.taken)
                ).length;
                const skipped = slotMedsAll.filter(m =>
                  todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === slot && l.skipped)
                ).length;
                const allDone   = taken + skipped === slotMedsAll.length;
                const isActive  = slot === activeSlot;
                const isOverdue = overdueSlots.includes(slot);

                // Pending first, then taken/skipped
                const slotMeds = [...slotMedsAll].sort((a, b) => {
                  const aPending = !todayMedLogs.some(l => l.medicationId === a.id && l.timeOfDay === slot && (l.taken || l.skipped));
                  const bPending = !todayMedLogs.some(l => l.medicationId === b.id && l.timeOfDay === slot && (l.taken || l.skipped));
                  return aPending === bPending ? 0 : aPending ? -1 : 1;
                });

                const expanded = slotOverrides.has(slot)
                  ? slotOverrides.get(slot)!
                  : isActive;

                function toggleSlot() {
                  setSlotOverrides(prev => new Map(prev).set(slot, !expanded));
                }

                const pending = slotMeds.filter(m =>
                  !todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === slot && (l.taken || l.skipped))
                );

                const badgeClass = allDone ? 'done' : pending.length > 0 ? 'pending' : 'upcoming';

                return (
                  <div key={slot} className={`med-section${allDone ? ' done' : ''}${isActive ? ' active-slot' : isOverdue ? ' overdue-slot' : ''}`}>
                    <div
                      className="med-section-header"
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={toggleSlot}
                    >
                      <div className={`med-section-icon ${slot}`}>
                        <img src={`/icon-${slot}.png`} alt="" className="med-section-icon-img" />
                      </div>
                      <span className="med-section-title">{TIME_LABELS[slot]}</span>
                      <span className={`med-section-badge ${badgeClass}`}>
                        {allDone ? `✓ ${taken}/${slotMeds.length}` : `${taken}/${slotMeds.length}`}
                        {skipped > 0 && ` · ${skipped} skipped`}
                      </span>
                    </div>
                    {expanded && (
                      <div className="dash-med-pending">
                        {slotMeds.map(m => {
                          const isTaken   = todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === slot && l.taken);
                          const isSkipped = todayMedLogs.some(l => l.medicationId === m.id && l.timeOfDay === slot && l.skipped);
                          return (
                            <span
                              key={m.id}
                              className="dash-med-pending-name"
                              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                              onClick={() => handleToggleMed(m.id, slot)}
                            >
                              <img
                                src={isTaken ? '/icon-dash-checked.svg' : isSkipped ? '/icon-dash-skipped.svg' : '/icon-dash-unchecked.svg'}
                                alt=""
                                width="20"
                                height="20"
                                style={{ flexShrink: 0 }}
                              />
                              {m.name}{m.dose ? ` · ${m.dose}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Habits & Streaks */}
        <div className="hab-theme" style={{ background: '#131b2e', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', padding: 20 }}>
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <p className="section-title" style={{ marginBottom: 0 }}>Habits & Streaks</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {habits.length > 0 && (
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#3B82F6' }}>
                  {habitsDoneToday}/{habits.length} done
                </span>
              )}
              <button onClick={() => onNavigate('habits')} style={{ ...NAV_BTN_BASE, background: '#3B82F6', color: '#000' }}>
                <ArrowRight />
              </button>
            </div>
          </div>
          {habits.length === 0 ? (
            <p className="text-muted" style={{ padding: '8px 0' }}>No habits yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {dailyHabits.length > 0 && (
                <div className="med-section" style={{ padding: 0 }}>
                  <div className="med-section-header" style={{ cursor: 'pointer' }} onClick={() => toggleHabitSection('daily')}>
                    <div className="med-section-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="5" fill="#3B82F6"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    <h3 className="med-section-title">Daily Habits</h3>
                    <span className="med-section-badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                      {dailyHabits.filter(h => isHabitDone(h, todayHabitLogs.find(l => l.habitId === h.id)?.value)).length}/{dailyHabits.length} done
                    </span>
                  </div>
                  {habitSectionsOpen.daily && <div className="med-section-items" style={{ padding: '0 12px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {sortByDone(dailyHabits).map(habit => {
                        const value = todayHabitLogs.find(l => l.habitId === habit.id)?.value;
                        const doneToday = isHabitDone(habit, value);
                        const isEditing = dashEditingIds.has(habit.id);
                        const streak = computeStreak(habit, allHabitLogs);
                        return (
                          <div key={habit.id} className={`habit-log-row${doneToday ? ' habit-log-row--done' : ''}`} style={{ gridTemplateColumns: '46px 1fr 1fr 80px' }}>
                            <div className="habit-log-icon">{habit.icon ?? '○'}</div>
                            <span className="habit-mgmt-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
                            <div>
                              <div className="habit-mgmt-meta-value" style={{ color: streak > 0 ? '#f59e0b' : undefined }}>
                                {streak > 0 ? `🔥 ${streak} day${streak !== 1 ? 's' : ''}` : '—'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              {habit.type === 'boolean' ? (
                                <img
                                  src={doneToday ? '/icon-habit-checked.svg' : '/icon-unchecked.svg'}
                                  alt={doneToday ? 'done' : 'not done'}
                                  style={{ width: 40, height: 40, cursor: 'pointer', flexShrink: 0, display: 'block' }}
                                  onClick={() => handleHabitBoolean(habit.id, value)}
                                />
                              ) : isEditing ? (
                                <div style={{ width: '100%' }}>
                                  <input
                                    type="text" inputMode="decimal"
                                    defaultValue={value ?? ''} autoFocus
                                    className="habit-number-input" style={{ width: '100%' }}
                                    onBlur={e => handleHabitNumericCommit(habit.id, e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleHabitNumericCommit(habit.id, (e.target as HTMLInputElement).value);
                                      if (e.key === 'Escape') setDashEditingIds(prev => { const s = new Set(prev); s.delete(habit.id); return s; });
                                    }}
                                  />
                                </div>
                              ) : doneToday ? (
                                <img
                                  src="/icon-habit-checked.svg" alt="done"
                                  style={{ width: 40, height: 40, cursor: 'pointer', flexShrink: 0, display: 'block' }}
                                  onClick={() => setDashEditingIds(prev => new Set(prev).add(habit.id))}
                                />
                              ) : (
                                <button
                                  onClick={() => setDashEditingIds(prev => new Set(prev).add(habit.id))}
                                  style={{ background: 'transparent', border: '1.5px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: 0, height: 40, boxSizing: 'border-box', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'center' }}
                                >
                                  {value != null ? value : '—'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>}
                </div>
              )}

              {weeklyHabits.length > 0 && (
                <div className="med-section" style={{ padding: 0 }}>
                  <div className="med-section-header" style={{ cursor: 'pointer' }} onClick={() => toggleHabitSection('weekly')}>
                    <div className="med-section-icon" style={{ background: 'rgba(59,130,246,0.12)' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#3B82F6" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    <h3 className="med-section-title">Weekly Habits</h3>
                    <span className="med-section-badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                      {weeklyHabits.filter(h => isHabitDone(h, todayHabitLogs.find(l => l.habitId === h.id)?.value)).length}/{weeklyHabits.length} done
                    </span>
                  </div>
                  {habitSectionsOpen.weekly && <div className="med-section-items" style={{ padding: '0 12px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {sortByDone(weeklyHabits).map(habit => {
                        const value = todayHabitLogs.find(l => l.habitId === habit.id)?.value;
                        const doneToday = isHabitDone(habit, value);
                        const isEditing = dashEditingIds.has(habit.id);
                        const weekCount = computeWeekCount(habit);
                        return (
                          <div key={habit.id} className={`habit-log-row${doneToday ? ' habit-log-row--done' : ''}`} style={{ gridTemplateColumns: '46px 1fr 1fr 80px' }}>
                            <div className="habit-log-icon">{habit.icon ?? '○'}</div>
                            <span className="habit-mgmt-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.name}</span>
                            <div>
                              <div className="habit-mgmt-meta-label">This week</div>
                              <div className="habit-mgmt-meta-value" style={{ color: weekCount > 0 ? 'var(--accent)' : undefined }}>
                                {weekCount}{habit.weeklyTarget != null ? `/${habit.weeklyTarget}` : ''} done
                              </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              {habit.type === 'boolean' ? (
                                <img
                                  src={doneToday ? '/icon-habit-checked.svg' : '/icon-unchecked.svg'}
                                  alt={doneToday ? 'done' : 'not done'}
                                  style={{ width: 40, height: 40, cursor: 'pointer', flexShrink: 0, display: 'block' }}
                                  onClick={() => handleHabitBoolean(habit.id, value)}
                                />
                              ) : isEditing ? (
                                <div style={{ width: '100%' }}>
                                  <input
                                    type="text" inputMode="decimal"
                                    defaultValue={value ?? ''} autoFocus
                                    className="habit-number-input" style={{ width: '100%' }}
                                    onBlur={e => handleHabitNumericCommit(habit.id, e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleHabitNumericCommit(habit.id, (e.target as HTMLInputElement).value);
                                      if (e.key === 'Escape') setDashEditingIds(prev => { const s = new Set(prev); s.delete(habit.id); return s; });
                                    }}
                                  />
                                </div>
                              ) : doneToday ? (
                                <img
                                  src="/icon-habit-checked.svg" alt="done"
                                  style={{ width: 40, height: 40, cursor: 'pointer', flexShrink: 0, display: 'block' }}
                                  onClick={() => setDashEditingIds(prev => new Set(prev).add(habit.id))}
                                />
                              ) : (
                                <button
                                  onClick={() => setDashEditingIds(prev => new Set(prev).add(habit.id))}
                                  style={{ background: 'transparent', border: '1.5px solid rgba(59,130,246,0.3)', borderRadius: 12, padding: 0, height: 40, boxSizing: 'border-box', color: 'var(--text)', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'center' }}
                                >
                                  {value != null ? value : '—'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>}
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
