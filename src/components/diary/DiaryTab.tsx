import { useState, useCallback, useRef, useEffect } from 'react';
import type { DiaryEntry } from '../../types';

const STORAGE_KEY = 'srt_diary';
const ACCENT = '#e879f9';
const ACCENT_DIM = 'rgba(232,121,249,0.10)';
const ACCENT_BORDER = 'rgba(232,121,249,0.35)';

const PROMPTS = [
  { id: 'feeling',    q: 'How are you feeling right now?' },
  { id: 'body',       q: 'How does your body feel today?' },
  { id: 'expectation',q: 'What are you expecting from today?' },
  { id: 'grateful',   q: 'What are you grateful for today?' },
  { id: 'focus',      q: "What's one thing you want to focus on?" },
  { id: 'yesterday',  q: 'How did yesterday go?' },
  { id: 'mind',       q: "What's on your mind that you'd like to let go of?" },
];

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = localDateStr();
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  if (dateStr === today) return `Today — ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
  if (dateStr === yesterday) return `Yesterday — ${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function loadAll(): Record<string, DiaryEntry> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
}

function saveAll(entries: Record<string, DiaryEntry>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function computeStreak(entries: Record<string, DiaryEntry>): number {
  let streak = 0;
  const d = new Date();
  // if today has no entry, start checking from yesterday
  if (!entries[localDateStr(d)]) d.setDate(d.getDate() - 1);
  while (true) {
    if (!entries[localDateStr(d)]) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function DiaryTab() {
  const [date, setDate] = useState(localDateStr());
  const [all, setAll] = useState<Record<string, DiaryEntry>>(loadAll);
  const [saved, setSaved] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const entry = all[date] ?? { date, freeText: '', prompts: {}, updatedAt: '' };

  function persist(updated: DiaryEntry) {
    const next = { ...all, [updated.date]: updated };
    setAll(next);
    saveAll(next);
    setSaved(true);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => setSaved(false), 1800);
  }

  function setFreeText(text: string) {
    persist({ ...entry, freeText: text, updatedAt: new Date().toISOString() });
  }

  function setPromptAnswer(id: string, value: string) {
    persist({ ...entry, prompts: { ...entry.prompts, [id]: value }, updatedAt: new Date().toISOString() });
  }

  useEffect(() => () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); }, []);

  function shiftDate(delta: number) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    if (d > new Date()) return;
    setDate(localDateStr(d));
  }

  const totalEntries = Object.keys(all).length;
  const streak = computeStreak(all);
  const thisMonth = Object.keys(all).filter(d => d.startsWith(localDateStr().slice(0, 7))).length;
  const hasContent = entry.freeText.trim() || Object.values(entry.prompts).some(v => v.trim());
  const answeredPrompts = PROMPTS.filter(p => entry.prompts[p.id]?.trim()).length;

  const textareaStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-alt)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '12px 14px', color: 'var(--text)', fontSize: '0.9375rem',
    fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.7,
    transition: 'border-color 0.15s',
  };

  return (
    <div className="diary-theme" style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 800 }}>

      {/* ── Overview strip ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex-between" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, background: ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text)' }}>
              Diary
            </span>
          </div>
          {saved && (
            <span style={{ fontSize: '0.68rem', color: ACCENT, fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>
              SAVED
            </span>
          )}
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Total Entries', value: String(totalEntries), color: 'var(--text-secondary)' },
            { label: 'Streak',        value: `${streak}d`,         color: streak > 0 ? ACCENT : 'var(--text-muted)' },
            { label: 'This Month',    value: String(thisMonth),     color: 'var(--text-secondary)' },
          ].map((m, i, arr) => (
            <div key={m.label} style={{
              flex: 1, minWidth: 0, padding: '14px 16px',
              borderRight: i === arr.length - 1 ? 'none' : '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {m.label}
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: m.color, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Date nav ── */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
        <button
          onClick={() => shiftDate(-1)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.1rem', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit', borderRadius: 4, transition: 'color 0.12s' }}
          onMouseEnter={e => (e.currentTarget.style.color = ACCENT)}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.2px' }}>
            {formatDisplayDate(date)}
          </span>
          {hasContent && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, flexShrink: 0, display: 'inline-block' }} />
          )}
        </div>
        <button
          onClick={() => shiftDate(1)}
          disabled={date >= localDateStr()}
          style={{ background: 'none', border: 'none', color: date >= localDateStr() ? 'var(--text-muted)' : 'var(--text-muted)', fontSize: '1.1rem', cursor: date >= localDateStr() ? 'default' : 'pointer', padding: '4px 8px', fontFamily: 'inherit', borderRadius: 4, opacity: date >= localDateStr() ? 0.3 : 1, transition: 'color 0.12s' }}
          onMouseEnter={e => { if (date < localDateStr()) e.currentTarget.style.color = ACCENT; }}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >›</button>
      </div>

      {/* ── Free text ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, background: ACCENT, flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text)' }}>
            Entry
          </span>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <textarea
            value={entry.freeText}
            onChange={e => setFreeText(e.target.value)}
            placeholder="Write anything — what happened, how you felt, what you noticed…"
            rows={6}
            style={textareaStyle}
            onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
        </div>
      </div>

      {/* ── Reflection prompts ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <button
          onClick={() => setExpandedPrompts(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', borderBottom: expandedPrompts ? '1px solid var(--border)' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, background: ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text)' }}>
              Reflection Prompts
            </span>
            {answeredPrompts > 0 && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: ACCENT, background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}`, borderRadius: 4, padding: '1px 7px', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
                {answeredPrompts}/{PROMPTS.length}
              </span>
            )}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', transform: expandedPrompts ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
        </button>

        {expandedPrompts && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {PROMPTS.map((p, i) => (
              <div key={p.id} style={{
                padding: '14px 20px',
                borderBottom: i === PROMPTS.length - 1 ? 'none' : '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: entry.prompts[p.id]?.trim() ? ACCENT : 'var(--border-hi)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.1px' }}>
                    {p.q}
                  </span>
                </div>
                <textarea
                  value={entry.prompts[p.id] ?? ''}
                  onChange={e => setPromptAnswer(p.id, e.target.value)}
                  placeholder="Type your answer…"
                  rows={2}
                  style={{ ...textareaStyle, fontSize: '0.875rem' }}
                  onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
