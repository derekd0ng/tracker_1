import { useState, useRef, useEffect, useCallback } from 'react';
import type { TodoItem } from '../../types';
import { IconCheckSquare, IconEmptySquare, IconX, IconPlus } from '../Icons';
import { api } from '../../api';

const ACCENT = '#818cf8';
const ACCENT_DIM = 'rgba(129, 140, 248, 0.12)';
const ACCENT_BORDER = 'rgba(129, 140, 248, 0.35)';

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDue(dateStr: string): string {
  const today = localDateStr();
  const tomorrow = localDateStr(new Date(Date.now() + 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(item: TodoItem): boolean {
  return !item.done && !!item.dueDate && item.dueDate < localDateStr();
}

export default function TodoTab() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [dueInput, setDueInput] = useState('');
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<TodoItem[]>('/api/todos');

      // One-time migration: push any todos still in localStorage that aren't in the server yet
      const LEGACY_KEY = 'srt_todos';
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        try {
          const legacy: TodoItem[] = JSON.parse(legacyRaw);
          const serverIds = new Set(data.map((t: TodoItem) => t.id));
          const toMigrate = legacy.filter(t => !serverIds.has(t.id));
          if (toMigrate.length > 0) {
            await Promise.all(toMigrate.map(t =>
              api.post('/api/todos', {
                id: t.id, title: t.title, done: t.done,
                dueDate: t.dueDate ?? null, createdAt: t.createdAt,
              }).catch(() => {})
            ));
            // Reload after migration
            const fresh = await api.get<TodoItem[]>('/api/todos');
            setTodos(fresh);
            localStorage.removeItem(LEGACY_KEY);
            return;
          }
        } catch { /* ignore */ }
        localStorage.removeItem(LEGACY_KEY);
      }

      setTodos(data);
    } catch (err) {
      console.error('load todos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTodo() {
    const title = input.trim();
    if (!title) return;
    const optimistic: TodoItem = {
      id: crypto.randomUUID(),
      title,
      done: false,
      createdAt: new Date().toISOString(),
      dueDate: dueInput || undefined,
    };
    setTodos(prev => [optimistic, ...prev]);
    setInput('');
    setDueInput('');
    inputRef.current?.focus();
    try {
      const saved = await api.post<TodoItem>('/api/todos', {
        id: optimistic.id,
        title: optimistic.title,
        done: false,
        dueDate: optimistic.dueDate ?? null,
        createdAt: optimistic.createdAt,
      });
      setTodos(prev => prev.map(t => t.id === optimistic.id ? saved : t));
    } catch (err) {
      console.error('add todo:', err);
      setTodos(prev => prev.filter(t => t.id !== optimistic.id));
    }
  }

  async function toggle(id: string) {
    const item = todos.find(t => t.id === id);
    if (!item) return;
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    try {
      await api.patch(`/api/todos/${id}`, { done: !item.done });
    } catch (err) {
      console.error('toggle todo:', err);
      setTodos(prev => prev.map(t => t.id === id ? { ...t, done: item.done } : t));
    }
  }

  async function remove(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    try {
      await api.delete(`/api/todos/${id}`);
    } catch (err) {
      console.error('delete todo:', err);
      load();
    }
  }

  const pending = todos.filter(t => !t.done);
  const done    = todos.filter(t => t.done);
  const overdue = pending.filter(isOverdue);
  const today = localDateStr();
  const dueToday = pending.filter(t => t.dueDate === today);

  return (
    <div className="todo-theme" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Overview strip ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="flex-between" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 10, height: 10, background: ACCENT, flexShrink: 0 }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text)' }}>
              To-Do
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Total',     value: String(todos.length),   color: 'var(--text-secondary)' },
            { label: 'Pending',   value: String(pending.length), color: ACCENT },
            { label: 'Due Today', value: String(dueToday.length), color: pending.length > 0 ? ACCENT : 'var(--text-muted)' },
            { label: 'Overdue',   value: String(overdue.length), color: overdue.length > 0 ? 'var(--danger)' : 'var(--text-muted)' },
            { label: 'Done',      value: String(done.length),    color: 'var(--success)' },
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

      {/* ── Quick add ── */}
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
          placeholder="Add a task…"
          style={{
            flex: 1, background: 'var(--surface-alt)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '9px 12px', color: 'var(--text)',
            fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <input
          type="date"
          value={dueInput}
          onChange={e => setDueInput(e.target.value)}
          style={{
            background: 'var(--surface-alt)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '9px 10px', color: 'var(--text-secondary)',
            fontSize: '0.8125rem', fontFamily: 'inherit', outline: 'none',
            colorScheme: 'dark',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = ACCENT)}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <button
          onClick={addTodo}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 4, border: `1px solid ${ACCENT_BORDER}`,
            background: ACCENT_DIM, color: ACCENT,
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', flexShrink: 0, transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,63,94,0.20)')}
          onMouseLeave={e => (e.currentTarget.style.background = ACCENT_DIM)}
        >
          <IconPlus size={16} color={ACCENT} /> Add
        </button>
      </div>

      {/* ── Task lists ── */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Loading…
        </div>
      ) : pending.length === 0 && done.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No tasks yet — add one above.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Pending · {pending.length}
                </span>
              </div>
              <div>
                {pending.map((t, i) => (
                  <TodoRow key={t.id} item={t} onToggle={toggle} onRemove={remove} isLast={i === pending.length - 1} />
                ))}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setShowDone(v => !v)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: showDone ? '1px solid var(--border)' : 'none',
                }}
              >
                <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Done · {done.length}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', transform: showDone ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>›</span>
              </button>
              {showDone && done.map((t, i) => (
                <TodoRow key={t.id} item={t} onToggle={toggle} onRemove={remove} isLast={i === done.length - 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TodoRow({ item, onToggle, onRemove, isLast }: {
  item: TodoItem; onToggle: (id: string) => void;
  onRemove: (id: string) => void; isLast: boolean;
}) {
  const overdue = isOverdue(item);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      background: 'transparent', transition: 'background 0.1s',
      opacity: item.done ? 0.45 : 1,
    }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ cursor: 'pointer', display: 'flex', flexShrink: 0 }} onClick={() => onToggle(item.id)}>
        {item.done
          ? <IconCheckSquare size={20} color={ACCENT} />
          : <IconEmptySquare size={20} color="var(--border-hi)" />}
      </span>
      <span style={{
        flex: 1, fontSize: '0.9375rem', color: item.done ? 'var(--text-muted)' : 'var(--text)',
        textDecoration: item.done ? 'line-through' : 'none',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {item.title}
      </span>
      {item.dueDate && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
          padding: '2px 7px', borderRadius: 4,
          color: overdue ? 'var(--danger)' : 'var(--text-muted)',
          background: overdue ? 'rgba(248,113,113,0.1)' : 'var(--surface-alt)',
          border: overdue ? '1px solid rgba(248,113,113,0.25)' : '1px solid var(--border)',
          flexShrink: 0,
        }}>
          {overdue ? '⚠ ' : ''}{formatDue(item.dueDate)}
        </span>
      )}
      <button
        onClick={() => onRemove(item.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', padding: 4, borderRadius: 4, flexShrink: 0,
          transition: 'color 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <IconX size={14} />
      </button>
    </div>
  );
}
