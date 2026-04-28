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
  const [reminderInput, setReminderInput] = useState('');
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
      reminderTime: reminderInput || undefined,
    };
    setTodos(prev => [optimistic, ...prev]);
    setInput('');
    setDueInput('');
    setReminderInput('');
    inputRef.current?.focus();
    try {
      const saved = await api.post<TodoItem>('/api/todos', {
        id: optimistic.id,
        title: optimistic.title,
        done: false,
        dueDate: optimistic.dueDate ?? null,
        reminderTime: optimistic.reminderTime ?? null,
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

  async function patch(id: string, update: Partial<TodoItem>) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, ...update } : t));
    try {
      const saved = await api.patch<TodoItem>(`/api/todos/${id}`, update);
      setTodos(prev => prev.map(t => t.id === id ? saved : t));
    } catch (err) {
      console.error('patch todo:', err);
      load();
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
        <input
          type="time"
          value={reminderInput}
          onChange={e => setReminderInput(e.target.value)}
          title="Reminder time"
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
                  <TodoRow key={t.id} item={t} onToggle={toggle} onRemove={remove} onPatch={patch} isLast={i === pending.length - 1} />
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
                <TodoRow key={t.id} item={t} onToggle={toggle} onRemove={remove} onPatch={patch} isLast={i === done.length - 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TodoRow({ item, onToggle, onRemove, onPatch, isLast }: {
  item: TodoItem; onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onPatch: (id: string, patch: Partial<TodoItem>) => void;
  isLast: boolean;
}) {
  const overdue = isOverdue(item);
  const [editingTitle, setEditingTitle]       = useState(false);
  const [titleDraft, setTitleDraft]           = useState(item.title);
  const [editingDue, setEditingDue]           = useState(false);
  const [dueDraft, setDueDraft]               = useState(item.dueDate ?? '');
  const [editingReminder, setEditingReminder] = useState(false);
  const [reminderDraft, setReminderDraft]     = useState(item.reminderTime ?? '');

  function commitTitle() {
    setEditingTitle(false);
    const val = titleDraft.trim();
    if (!val || val === item.title) { setTitleDraft(item.title); return; }
    onPatch(item.id, { title: val });
  }

  function commitDue() {
    setEditingDue(false);
    const val = dueDraft || undefined;
    if (val === item.dueDate) return;
    onPatch(item.id, { dueDate: val ?? null as any });
  }

  function commitReminder() {
    setEditingReminder(false);
    const val = reminderDraft || undefined;
    if (val === item.reminderTime) return;
    onPatch(item.id, { reminderTime: val ?? null as any });
  }

  const inp: React.CSSProperties = {
    background: 'var(--surface-alt)', border: `1px solid ${ACCENT}`,
    borderRadius: 4, padding: '2px 6px', color: 'var(--text)',
    fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
    colorScheme: 'dark', flexShrink: 0,
  };

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

      {/* Title — click to edit inline */}
      {!item.done && editingTitle ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(item.title); setEditingTitle(false); } }}
          style={{ ...inp, flex: 1, minWidth: 0, fontSize: '0.9375rem' }}
        />
      ) : (
        <span
          onClick={() => { if (!item.done) { setTitleDraft(item.title); setEditingTitle(true); } }}
          style={{
            flex: 1, fontSize: '0.9375rem', color: item.done ? 'var(--text-muted)' : 'var(--text)',
            textDecoration: item.done ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            cursor: item.done ? 'default' : 'text',
          }}
        >
          {item.title}
        </span>
      )}

      {/* Due date — click to edit inline */}
      {!item.done && editingDue ? (
        <input
          type="date"
          autoFocus
          value={dueDraft}
          onChange={e => setDueDraft(e.target.value)}
          onBlur={commitDue}
          onKeyDown={e => { if (e.key === 'Enter') commitDue(); if (e.key === 'Escape') { setDueDraft(item.dueDate ?? ''); setEditingDue(false); } }}
          style={{ ...inp, width: 130 }}
        />
      ) : item.dueDate ? (
        <span
          onClick={() => { if (!item.done) { setDueDraft(item.dueDate ?? ''); setEditingDue(true); } }}
          style={{
            fontSize: '0.7rem', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
            padding: '2px 7px', borderRadius: 4, cursor: item.done ? 'default' : 'pointer', flexShrink: 0,
            color: overdue ? 'var(--danger)' : 'var(--text-muted)',
            background: overdue ? 'rgba(248,113,113,0.1)' : 'var(--surface-alt)',
            border: overdue ? '1px solid rgba(248,113,113,0.25)' : '1px solid var(--border)',
          }}
          title="Click to edit due date"
        >
          {overdue ? '⚠ ' : ''}{formatDue(item.dueDate)}
          <span onClick={e => { e.stopPropagation(); onPatch(item.id, { dueDate: null as any }); }} style={{ marginLeft: 4, opacity: 0.5 }} title="Remove due date">×</span>
        </span>
      ) : !item.done ? (
        <span
          onClick={() => { setDueDraft(''); setEditingDue(true); }}
          style={{ fontSize: '0.65rem', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, flexShrink: 0, opacity: 0.4 }}
          title="Set due date"
        >📅</span>
      ) : null}
      {/* Reminder time — click to edit, × to clear */}
      {!item.done && (
        editingReminder ? (
          <input
            type="time"
            value={reminderDraft}
            autoFocus
            onChange={e => setReminderDraft(e.target.value)}
            onBlur={commitReminder}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') commitReminder(); }}
            style={{
              background: 'var(--surface-alt)', border: `1px solid ${ACCENT}`,
              borderRadius: 4, padding: '2px 6px', color: 'var(--text)',
              fontSize: '0.75rem', fontFamily: 'inherit', outline: 'none',
              colorScheme: 'dark', width: 90, flexShrink: 0,
            }}
          />
        ) : item.reminderTime ? (
          <span
            onClick={() => { setReminderDraft(item.reminderTime ?? ''); setEditingReminder(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: '0.7rem', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
              padding: '2px 7px', borderRadius: 4, cursor: 'pointer', flexShrink: 0,
              color: ACCENT, background: 'rgba(129,140,248,0.08)', border: `1px solid rgba(129,140,248,0.25)`,
            }}
            title="Click to edit reminder time"
          >
            ⏰ {item.reminderTime}
            <span
              onClick={e => { e.stopPropagation(); onPatch(item.id, { reminderTime: null as any }); }}
              style={{ marginLeft: 2, opacity: 0.6, lineHeight: 1 }}
              title="Remove reminder"
            >×</span>
          </span>
        ) : (
          <span
            onClick={() => { setReminderDraft(''); setEditingReminder(true); }}
            style={{
              fontSize: '0.65rem', color: 'var(--text-muted)', cursor: 'pointer',
              padding: '2px 6px', borderRadius: 4, flexShrink: 0, opacity: 0.4,
            }}
            title="Set reminder time"
          >⏰</span>
        )
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
