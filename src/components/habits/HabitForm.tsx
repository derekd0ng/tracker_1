import { useState } from 'react';
import type { Habit, HabitType, HabitFrequency } from '../../types';
import { saveHabit } from '../../storage';

interface Props {
  onSaved: () => void;
  onCancel: () => void;
  initial?: Habit;
}

const ICON_OPTIONS = ['🏃', '🚶', '🏋️', '💤', '💧', '🥗', '📚', '🧘', '🎯', '🧠', '❤️', '🌿', '💊', '☀️', '🛁'];

export const SUGGESTIONS: Array<{
  name: string; icon: string; type: HabitType; description: string;
  frequency?: HabitFrequency; unit?: string; target?: number; weeklyTarget?: number;
}> = [
  { name: 'Steps',          icon: '🚶', type: 'numeric',  unit: 'steps',   target: 8000,  description: 'Walking 8,000+ steps daily improves cardiovascular health and supports brain recovery through steady blood flow.' },
  { name: 'Water',          icon: '💧', type: 'numeric',  unit: 'glasses', target: 8,     description: 'Staying hydrated reduces fatigue and brain fog. Aim for 8 glasses — more on active days.' },
  { name: 'Sleep',          icon: '💤', type: 'numeric',  unit: 'hours',   target: 8,     description: 'Deep sleep is when your brain consolidates memory and repairs tissue. Consistent 7–9 hours is the single biggest recovery lever.' },
  { name: 'Gym',            icon: '🏋️', type: 'boolean', frequency: 'weekly', weeklyTarget: 3, description: 'Resistance training 3× per week raises BDNF and reduces inflammation — critical for long-term neurological recovery.' },
  { name: 'Running',        icon: '🏃', type: 'boolean', frequency: 'weekly', weeklyTarget: 3, description: 'Aerobic exercise boosts mood, reduces anxiety, and supports vascular health. Three sessions a week is a solid starting point.' },
  { name: 'Meditation',     icon: '🧘', type: 'boolean', description: 'Even 5 minutes of mindfulness per day measurably reduces cortisol and helps regulate the nervous system after illness or injury.' },
  { name: 'Reading',        icon: '📚', type: 'boolean', description: 'Reading before bed replaces blue-light screen exposure and supports deeper, more restorative sleep cycles.' },
  { name: 'Vitamins',       icon: '💊', type: 'boolean', description: 'A consistent supplement routine ensures you\'re not missing micronutrients that recovery depends on — D3, B12, and magnesium are common gaps.' },
  { name: 'Sunlight',       icon: '☀️', type: 'boolean', description: 'Morning sunlight exposure sets your circadian rhythm, boosts serotonin, and improves sleep quality at night.' },
  { name: 'Healthy Eating', icon: '🥗', type: 'boolean', description: 'Whole foods reduce systemic inflammation and give your body the building blocks it needs for tissue and nerve repair.' },
  { name: 'Brain Training', icon: '🧠', type: 'boolean', description: 'Daily cognitive challenges — puzzles, learning, or memory games — support neuroplasticity and keep your mind sharp during recovery.' },
  { name: 'Gratitude',      icon: '❤️', type: 'boolean', description: 'Writing down three things you\'re grateful for each day shifts your nervous system toward calm and has been shown to improve long-term wellbeing.' },
  { name: 'Supplements',    icon: '🌿', type: 'boolean', description: 'Herbal and natural supplements like ashwagandha, omega-3s, or turmeric can complement your recovery plan when taken consistently.' },
  { name: 'Goal Review',    icon: '🎯', type: 'boolean', description: 'A daily 5-minute review of your recovery goals keeps you oriented and helps you notice progress that\'s easy to miss day-to-day.' },
  { name: 'Cold Shower',    icon: '🛁', type: 'boolean', description: 'Cold exposure reduces inflammation, speeds muscle recovery, and trains your autonomic nervous system to handle stress more efficiently.' },
];

// Shuffle once at module load so order varies each session
for (let i = SUGGESTIONS.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [SUGGESTIONS[i], SUGGESTIONS[j]] = [SUGGESTIONS[j], SUGGESTIONS[i]];
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function HabitForm({ onSaved, onCancel, initial }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<HabitType>(initial?.type ?? 'boolean');
  const [frequency, setFrequency] = useState<HabitFrequency>(initial?.frequency ?? 'daily');
  const [icon, setIcon] = useState(initial?.icon ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [target, setTarget] = useState(initial?.target?.toString() ?? '');
  const [weeklyTarget, setWeeklyTarget] = useState(initial?.weeklyTarget?.toString() ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? (initial?.id ? '' : todayStr()));
  const [suggIdx, setSuggIdx] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const habit: Habit = {
      id: initial?.id ?? `habit_${Date.now()}`,
      name: name.trim(),
      type,
      frequency,
      icon: icon || undefined,
      unit: unit.trim() || undefined,
      target: target !== '' ? parseFloat(target.replace(',', '.')) : undefined,
      weeklyTarget: frequency === 'weekly' && weeklyTarget !== '' ? parseInt(weeklyTarget) : undefined,
      startDate: startDate || undefined,
    };
    saveHabit(habit);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Name */}
        <div className="form-field">
          <label>Name</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Steps, Gym, Sleep"
            required
          />
        </div>

        {/* Frequency + Type */}
        <div className="form-grid">
          <div className="form-field">
            <label>Frequency</label>
            <select value={frequency} onChange={e => setFrequency(e.target.value as HabitFrequency)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div className="form-field">
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value as HabitType)}>
              <option value="boolean">Done / Not done</option>
              <option value="numeric">Numeric (with a value)</option>
            </select>
          </div>
        </div>

        {/* Weekly target */}
        {frequency === 'weekly' && (
          <div className="form-field">
            <label>Times per week</label>
            <input
              type="number"
              min="1"
              max="7"
              value={weeklyTarget}
              onChange={e => setWeeklyTarget(e.target.value)}
              placeholder="e.g. 3"
            />
          </div>
        )}

        {/* Numeric fields */}
        {type === 'numeric' && (
          <div className="form-grid">
            <div className="form-field">
              <label>Unit</label>
              <input
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="steps, glasses, hours…"
              />
            </div>
            <div className="form-field">
              <label>{frequency === 'weekly' ? 'Per-session target' : 'Daily target'}</label>
              <input
                type="text"
                inputMode="decimal"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="e.g. 1,5 or 10000"
              />
            </div>
          </div>
        )}

        {/* Optional target for boolean habits */}
        {type === 'boolean' && (
          <div className="form-grid">
            <div className="form-field">
              <label>Unit (optional)</label>
              <input
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="min, reps, km…"
              />
            </div>
            <div className="form-field">
              <label>Target (optional)</label>
              <input
                type="text"
                inputMode="decimal"
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>
          </div>
        )}

        {/* Icon picker */}
        <div className="form-field">
          <label>Icon (optional)</label>
          <div className="icon-picker">
            {ICON_OPTIONS.map(em => (
              <button
                key={em}
                type="button"
                className={`icon-option${icon === em ? ' selected' : ''}`}
                onClick={() => setIcon(icon === em ? '' : em)}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        {/* Start date */}
        <div className="form-field">
          <label>Tracking start date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            max={todayStr()}
          />
        </div>

        {/* Suggestions carousel */}
        {!initial && (() => {
          const s = SUGGESTIONS[suggIdx];
          return (
            <div className="form-field">
              <label>Suggestions</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSuggIdx(i => (i - 1 + SUGGESTIONS.length) % SUGGESTIONS.length)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, width: 36, height: 36, flexShrink: 0, cursor: 'pointer', color: '#3B82F6', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >‹</button>
                <div className="hab-theme habit-suggestion-card" style={{ flex: 1, margin: 0, minHeight: 280 }}>
                  <div className="habit-suggestion-icon">{s.icon}</div>
                  <h4 className="habit-suggestion-name">{s.name}</h4>
                  <p className="habit-suggestion-desc">{s.description}</p>
                  <button
                    type="button"
                    className="habit-suggestion-add-btn"
                    onClick={() => {
                      setName(s.name);
                      setIcon(s.icon);
                      setType(s.type);
                      setFrequency(s.frequency ?? 'daily');
                      setUnit(s.unit ?? '');
                      setTarget(s.target?.toString() ?? '');
                      setWeeklyTarget(s.weeklyTarget?.toString() ?? '');
                    }}
                  >+ Use this</button>
                </div>
                <button
                  type="button"
                  onClick={() => setSuggIdx(i => (i + 1) % SUGGESTIONS.length)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, width: 36, height: 36, flexShrink: 0, cursor: 'pointer', color: '#3B82F6', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >›</button>
              </div>
            </div>
          );
        })()}

      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">
          {initial ? 'Save' : 'Add Habit'}
        </button>
      </div>
    </form>
  );
}
