import { useState, useCallback, useMemo } from 'react';
import type { Habit, HabitLog, HabitType, HabitFrequency } from '../../types';
import { getHabits, deleteHabit, getHabitLogs, saveHabit } from '../../storage';
import DailyHabitLog from './DailyHabitLog';
import HabitForm, { SUGGESTIONS } from './HabitForm';
import BulkHabitInputModal from './BulkHabitInputModal';

const ICON_OPTIONS = ['🏃', '🚶', '🏋️', '💤', '💧', '🥗', '📚', '🧘', '🎯', '🧠', '❤️', '🌿', '💊', '☀️', '🛁'];

// ── Helpers ────────────────────────────────────────────────────────────────

function isHabitDone(habit: Habit, value: number | undefined): boolean {
  if (value == null) return false;
  if (habit.type === 'boolean') return value > 0;
  if (habit.target != null) return value >= habit.target;
  return value > 0;
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function computeCurrentStreak(habit: Habit, allLogs: HabitLog[]): number {
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


// ── Component ──────────────────────────────────────────────────────────────

export default function HabitsTab() {
  const [habits, setHabits]   = useState<Habit[]>(() => getHabits());
  const [allLogs, setAllLogs] = useState<HabitLog[]>(() => getHabitLogs());
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editHabit,   setEditHabit]   = useState<Habit | undefined>();
  const [formInitial, setFormInitial] = useState<Habit | undefined>();

  const reload = useCallback(() => {
    setHabits(getHabits());
    setAllLogs(getHabitLogs());
  }, []);

  function openNew() { setEditHabit(undefined); setFormInitial(undefined); setShowForm(true); }
  function openEdit(h: Habit) { setEditHabit(h); setFormInitial(h); setShowForm(true); }
  function openSuggestion(s: typeof SUGGESTIONS[0]) {
    setEditHabit(undefined);
    setFormInitial({
      id: '', name: s.name, icon: s.icon, type: s.type,
      frequency: s.frequency ?? 'daily',
      unit: s.unit, target: s.target, weeklyTarget: s.weeklyTarget,
    } as Habit);
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditHabit(undefined); setFormInitial(undefined); }
  function handleSaved() { reload(); closeForm(); }
  function handleDelete(id: string) {
    if (window.confirm('Delete this habit?')) { deleteHabit(id); reload(); }
  }

  // ── Stats ──────────────────────────────────────────────────────────────

  const today = localDateStr();
  const todayDone = habits.filter(h => {
    const log = allLogs.find(l => l.habitId === h.id && l.date === today);
    return isHabitDone(h, log?.value);
  }).length;

  const bestStreak = habits.length > 0
    ? Math.max(...habits.map(h => computeCurrentStreak(h, allLogs)))
    : 0;

  const monthlyPct = useMemo(() => {
    if (habits.length === 0) return 0;
    let done = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = localDateStr(d);
      habits.forEach(h => {
        const log = allLogs.find(l => l.habitId === h.id && l.date === ds);
        if (isHabitDone(h, log?.value)) done++;
      });
    }
    return Math.round((done / (habits.length * 30)) * 100);
  }, [habits, allLogs]);

  const monthlyStats = useMemo(() => {
    const stepsHabit = habits.find(h => /step|walk/i.test(h.name));
    const waterHabit = habits.find(h => /water/i.test(h.name));

    let totalSteps = 0;
    let waterDays = 0;

    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = localDateStr(d);
      if (stepsHabit) {
        const log = allLogs.find(l => l.habitId === stepsHabit.id && l.date === ds);
        if (log?.value) totalSteps += log.value;
      }
      if (waterHabit) {
        const log = allLogs.find(l => l.habitId === waterHabit.id && l.date === ds);
        if (isHabitDone(waterHabit, log?.value)) waterDays++;
      }
    }

    return {
      distanceKm: stepsHabit ? +(totalSteps / 1000).toFixed(1) : null,
      waterLiters: waterHabit ? +(waterDays * 1.5).toFixed(1) : null,
    };
  }, [habits, allLogs]);

  const hasConsistentBadge  = habits.some(h => computeCurrentStreak(h, allLogs) >= 7);
  const hasHealthyWeekBadge = habits.length > 0 && (() => {
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = localDateStr(d);
      if (!habits.every(h => isHabitDone(h, allLogs.find(l => l.habitId === h.id && l.date === ds)?.value))) return false;
    }
    return true;
  })();

  // ── Empty state ────────────────────────────────────────────────────────────

  const [esName,        setEsName]        = useState('');
  const [esType,        setEsType]        = useState<HabitType>('boolean');
  const [esFrequency,   setEsFrequency]   = useState<HabitFrequency>('daily');
  const [esIcon,        setEsIcon]        = useState('');
  const [esUnit,        setEsUnit]        = useState('');
  const [esTarget,      setEsTarget]      = useState('');
  const [esWeeklyTarget,setEsWeeklyTarget]= useState('');

  function esFillFromSuggestion(s: typeof SUGGESTIONS[0]) {
    setEsName(s.name);
    setEsIcon(s.icon);
    setEsType(s.type);
    setEsFrequency(s.frequency ?? 'daily');
    setEsUnit(s.unit ?? '');
    setEsTarget(s.target?.toString() ?? '');
    setEsWeeklyTarget(s.weeklyTarget?.toString() ?? '');
  }

  function esHandleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!esName.trim()) return;
    const habit: Habit = {
      id: `habit_${Date.now()}`,
      name: esName.trim(),
      type: esType,
      frequency: esFrequency,
      icon: esIcon || undefined,
      unit: esUnit.trim() || undefined,
      target: esTarget !== '' ? parseFloat(esTarget.replace(',', '.')) : undefined,
      weeklyTarget: esFrequency === 'weekly' && esWeeklyTarget !== '' ? parseInt(esWeeklyTarget) : undefined,
    };
    saveHabit(habit);
    reload();
  }

  if (habits.length === 0) {
    return (
      <div className="hab-theme" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

        {/* ── Blue form card ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #1a2f52 100%)',
          border: '1px solid rgba(59,130,246,0.35)',
          borderRadius: 24,
          padding: 32,
        }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', margin: 0 }}>
              Add your first habit
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', marginTop: 6, fontSize: '0.9rem' }}>
              Build a consistent routine to support your recovery.
            </p>
          </div>

          <form onSubmit={esHandleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-field">
              <label>Name</label>
              <input
                autoFocus
                value={esName}
                onChange={e => setEsName(e.target.value)}
                placeholder="e.g. Steps, Gym, Sleep"
                required
              />
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>Frequency</label>
                <select value={esFrequency} onChange={e => setEsFrequency(e.target.value as HabitFrequency)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="form-field">
                <label>Type</label>
                <select value={esType} onChange={e => setEsType(e.target.value as HabitType)}>
                  <option value="boolean">Done / Not done</option>
                  <option value="numeric">Numeric (with a value)</option>
                </select>
              </div>
            </div>

            {esFrequency === 'weekly' && (
              <div className="form-field">
                <label>Times per week</label>
                <input
                  type="number" min="1" max="7"
                  value={esWeeklyTarget}
                  onChange={e => setEsWeeklyTarget(e.target.value)}
                  placeholder="e.g. 3"
                />
              </div>
            )}

            {esType === 'numeric' && (
              <div className="form-grid">
                <div className="form-field">
                  <label>Unit</label>
                  <input value={esUnit} onChange={e => setEsUnit(e.target.value)} placeholder="steps, glasses, hours…" />
                </div>
                <div className="form-field">
                  <label>{esFrequency === 'weekly' ? 'Per-session target' : 'Daily target'}</label>
                  <input type="text" inputMode="decimal" value={esTarget} onChange={e => setEsTarget(e.target.value)} placeholder="e.g. 8000" />
                </div>
              </div>
            )}

            {esType === 'boolean' && (
              <div className="form-grid">
                <div className="form-field">
                  <label>Unit (optional)</label>
                  <input value={esUnit} onChange={e => setEsUnit(e.target.value)} placeholder="min, reps, km…" />
                </div>
                <div className="form-field">
                  <label>Target (optional)</label>
                  <input type="text" inputMode="decimal" value={esTarget} onChange={e => setEsTarget(e.target.value)} placeholder="e.g. 30" />
                </div>
              </div>
            )}

            <div className="form-field">
              <label>Icon (optional)</label>
              <div className="icon-picker">
                {ICON_OPTIONS.map(em => (
                  <button
                    key={em} type="button"
                    className={`icon-option${esIcon === em ? ' selected' : ''}`}
                    onClick={() => setEsIcon(esIcon === em ? '' : em)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 8, height: 44, fontSize: '0.95rem' }}
            >
              Add Habit
            </button>
          </form>
        </div>

        {/* ── Suggestions — identical to normal layout ── */}
        <section>
          <div style={{ marginBottom: 20 }}>
            <h3 className="habit-section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              Suggested for You
              <img src="/icon-ai.svg" alt="AI" style={{ width: 22, height: 22 }} />
            </h3>
          </div>
          <div className="habit-suggestion-grid">
            {SUGGESTIONS.map(s => (
              <div key={s.name} className="habit-suggestion-card">
                <div className="habit-suggestion-icon">{s.icon}</div>
                <h4 className="habit-suggestion-name">{s.name}</h4>
                <p className="habit-suggestion-desc">{s.description}</p>
                <button className="habit-suggestion-add-btn" onClick={() => openSuggestion(s)}>
                  + Add Habit
                </button>
              </div>
            ))}
          </div>
        </section>

      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

      {/* ── Section 1: Stats ── */}
      <div className="habit-stats-grid">

        <div className="habit-stat-card">
          <div className="habit-stat-header">
            <span className="habit-stat-label">Current Best Streak</span>
            <span className="habit-stat-icon">🔥</span>
          </div>
          <div className="habit-stat-value-row">
            <span className="habit-stat-value">{bestStreak}</span>
            <span className="habit-stat-unit">days</span>
          </div>
        </div>

        <div className="habit-stat-card">
          <div className="habit-stat-header">
            <span className="habit-stat-label">Monthly Completion</span>
            <span className="habit-stat-icon">📈</span>
          </div>
          <div className="habit-stat-value-row" style={{ marginBottom: 12 }}>
            <span className="habit-stat-value">{habits.length > 0 ? `${monthlyPct}%` : '—'}</span>
          </div>
          <div className="habit-progress-track">
            <div className="habit-progress-fill" style={{ width: `${monthlyPct}%` }} />
          </div>
        </div>

        <div className="habit-stat-card">
          <div className="habit-stat-header">
            <span className="habit-stat-label">Distance Walked</span>
            <span className="habit-stat-icon">🚶</span>
          </div>
          <div className="habit-stat-value-row">
            <span className="habit-stat-value">
              {monthlyStats.distanceKm !== null ? monthlyStats.distanceKm : '—'}
            </span>
            {monthlyStats.distanceKm !== null && <span className="habit-stat-unit">km</span>}
          </div>
          <div className="habit-mgmt-meta-label" style={{ marginTop: 4 }}>last 30 days</div>
        </div>

        <div className="habit-stat-card">
          <div className="habit-stat-header">
            <span className="habit-stat-label">Water Drank</span>
            <span className="habit-stat-icon">💧</span>
          </div>
          <div className="habit-stat-value-row">
            <span className="habit-stat-value">
              {monthlyStats.waterLiters !== null ? monthlyStats.waterLiters : '—'}
            </span>
            {monthlyStats.waterLiters !== null && <span className="habit-stat-unit">L</span>}
          </div>
          <div className="habit-mgmt-meta-label" style={{ marginTop: 4 }}>last 30 days</div>
        </div>

      </div>

      {/* ── Section 2: 2-column layout ── */}
      <div className="med-main-layout">

        {/* Left: Today's Progress */}
        <div>
          <DailyHabitLog habits={habits} />
        </div>

        {/* Right: Sidebar */}
        <div className="med-sidebar">
          <div className="prescriptions-card">
            <h3 className="prescriptions-title">My Habits</h3>
            <div className="prescriptions-stats-grid">
              <div className="prescriptions-stat">
                <span className="prescriptions-stat-val">{habits.length}</span>
                <span className="prescriptions-stat-lbl">Total</span>
              </div>
              <div className="prescriptions-stat">
                <span className="prescriptions-stat-val">{todayDone}</span>
                <span className="prescriptions-stat-lbl">Done Today</span>
              </div>
            </div>
            <button className="prescriptions-btn-primary" onClick={openNew}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 15H11V11H15V9H11V5H9V9H5V11H9V15V15M10 20C8.61667 20 7.31667 19.7375 6.1 19.2125C4.88333 18.6875 3.825 17.975 2.925 17.075C2.025 16.175 1.3125 15.1167 0.7875 13.9C0.2625 12.6833 0 11.3833 0 10C0 8.61667 0.2625 7.31667 0.7875 6.1C1.3125 4.88333 2.025 3.825 2.925 2.925C3.825 2.025 4.88333 1.3125 6.1 0.7875C7.31667 0.2625 8.61667 0 10 0C11.3833 0 12.6833 0.2625 13.9 0.7875C15.1167 1.3125 16.175 2.025 17.075 2.925C17.975 3.825 18.6875 4.88333 19.2125 6.1C19.7375 7.31667 20 8.61667 20 10C20 11.3833 19.7375 12.6833 19.2125 13.9C18.6875 15.1167 17.975 16.175 17.075 17.075C16.175 17.975 15.1167 18.6875 13.9 19.2125C12.6833 19.7375 11.3833 20 10 20V20M10 18C12.2333 18 14.125 17.225 15.675 15.675C17.225 14.125 18 12.2333 18 10C18 7.76667 17.225 5.875 15.675 4.325C14.125 2.775 12.2333 2 10 2C7.76667 2 5.875 2.775 4.325 4.325C2.775 5.875 2 7.76667 2 10C2 12.2333 2.775 14.125 4.325 15.675C5.875 17.225 7.76667 18 10 18V18" fill="#3B82F6"/>
              </svg>
              Add Habit
            </button>
            <button className="prescriptions-btn-secondary" onClick={() => setShowList(true)}>
              <img src="/icon-list.png" alt="" style={{ width: 15, height: 15, objectFit: 'contain' }} />
              View Full List
            </button>
            {habits.length > 0 && (
              <button className="prescriptions-btn-ghost" onClick={() => setShowBulk(true)}>
                <img src="/icon-bulk.png" alt="" style={{ width: 13, height: 13, objectFit: 'contain' }} />
                Bulk Input
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── Section 3: Suggestions ── */}
      <section>
        <div style={{ marginBottom: 20 }}>
          <h3 className="habit-section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Suggested for You
            <img src="/icon-ai.svg" alt="AI" style={{ width: 22, height: 22 }} />
          </h3>
        </div>
        <div className="habit-suggestion-grid">
          {SUGGESTIONS.map(s => (
            <div key={s.name} className="habit-suggestion-card">
              <div className="habit-suggestion-icon">{s.icon}</div>
              <h4 className="habit-suggestion-name">{s.name}</h4>
              <p className="habit-suggestion-desc">{s.description}</p>
              <button className="habit-suggestion-add-btn" onClick={() => openSuggestion(s)}>
                + Add Habit
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Full list modal ── */}
      {showList && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setShowList(false); }}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <p className="modal-title">My Habits</p>
              <button className="btn btn-ghost" onClick={() => setShowList(false)}>✕</button>
            </div>
            <div className="modal-body">
              {habits.length === 0 ? (
                <p className="text-muted" style={{ textAlign: 'center', padding: '32px 0' }}>
                  No habits added yet.
                </p>
              ) : (
                <div className="habit-mgmt-list">
                  {habits.map(h => (
                    <div key={h.id} className="habit-mgmt-row">
                      <span style={{ fontSize: '1.4rem', marginRight: 16, flexShrink: 0 }}>{h.icon ?? '○'}</span>
                      <div className="habit-mgmt-grid">
                        <div>
                          <div className="habit-mgmt-name">{h.name}</div>
                          <div className="habit-mgmt-type">{h.type === 'boolean' ? 'Done / Not done' : 'Numeric'}</div>
                        </div>
                        <div>
                          <div className="habit-mgmt-meta-label">Target</div>
                          <div className="habit-mgmt-meta-value">
                            {h.frequency === 'weekly'
                              ? h.weeklyTarget != null ? `${h.weeklyTarget}×/week` : '—'
                              : h.target != null ? `${h.target}${h.unit ? ` ${h.unit}` : ''}` : h.unit ?? '—'}
                          </div>
                        </div>
                        <div>
                          <div className="habit-mgmt-meta-label">Best Streak</div>
                          <div className="habit-mgmt-meta-value" style={{ color: 'var(--accent)' }}>
                            {computeMaxStreak(h, allLogs)} days
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn btn-ghost" onClick={() => { setShowList(false); openEdit(h); }}>Edit</button>
                        <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(h.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk input modal ── */}
      {showBulk && <BulkHabitInputModal habits={habits} onClose={() => { setShowBulk(false); reload(); }} />}

      {/* ── Add / Edit modal ── */}
      {showForm && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal">
            <div className="modal-header">
              <p className="modal-title">{editHabit ? 'Edit Habit' : 'Add Habit'}</p>
              <button className="btn btn-ghost" onClick={closeForm}>✕</button>
            </div>
            <HabitForm onSaved={handleSaved} onCancel={closeForm} initial={formInitial} />
          </div>
        </div>
      )}

    </div>
  );
}
