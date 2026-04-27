import { useState, useEffect, useRef } from 'react';
import type { CalendarEvent } from '../../types';
import { api } from '../../api';

const ACCENT   = '#c084fc';
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const EVENT_COLORS = [
  { label: 'Purple',  val: '#c084fc' },
  { label: 'Teal',    val: '#22d3ee' },
  { label: 'Emerald', val: '#34d399' },
  { label: 'Blue',    val: '#60a5fa' },
  { label: 'Amber',   val: '#f59e0b' },
  { label: 'Red',     val: '#f87171' },
];

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysInMonth(y: number, m: number) { return new Date(y, m+1, 0).getDate(); }

// Monday-first: Mon=0 … Sun=6
function firstDow(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }

function fmt12(hhmm: string) {
  const [h, mm] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(mm).padStart(2,'0')} ${h < 12 ? 'am' : 'pm'}`;
}

// ── ICS parser ──────────────────────────────────────────────────────────────

function unfoldICS(raw: string): string {
  // ICS lines can be folded with \r\n followed by a space or tab
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function getICSField(block: string, key: string): string | null {
  // Matches KEY: or KEY;param=...: at the start of a line
  const m = block.match(new RegExp(`^${key}(?:;[^:]*)?:(.*)`, 'm'));
  return m ? m[1].trim() : null;
}

function parseICSDate(raw: string | null): { date: string; time?: string } | null {
  if (!raw) return null;
  // Strip timezone suffix Z or any trailing chars after seconds
  const clean = raw.replace(/Z$/, '').split('T');
  const datePart = clean[0];
  const timePart = clean[1];
  if (datePart.length !== 8) return null;
  const date = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`;
  const year = parseInt(datePart.slice(0,4));
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  const time = timePart ? `${timePart.slice(0,2)}:${timePart.slice(2,4)}` : undefined;
  return { date, time };
}

function unescape(s: string): string {
  return s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseICS(text: string): CalendarEvent[] {
  const unfolded = unfoldICS(text);
  const events: CalendarEvent[] = [];
  const blocks = unfolded.split(/BEGIN:VEVENT/i);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const summary = getICSField(block, 'SUMMARY');
    if (!summary) continue;

    const dtstart = getICSField(block, 'DTSTART');
    const dtend   = getICSField(block, 'DTEND');
    const desc    = getICSField(block, 'DESCRIPTION');
    const loc     = getICSField(block, 'LOCATION');

    const start = parseICSDate(dtstart);
    if (!start) continue;
    const end = parseICSDate(dtend);

    const description = [desc, loc].filter((x): x is string => x !== null).map(unescape).join(' · ') || undefined;

    events.push({
      id:          crypto.randomUUID(),
      title:       unescape(summary),
      date:        start.date,
      startTime:   start.time,
      endTime:     end?.time,
      description,
    });
  }
  return events;
}

// ── ICS import preview modal ─────────────────────────────────────────────────

function ICSImportModal({ events, onImport, onClose }: {
  events: CalendarEvent[];
  onImport: (events: CalendarEvent[]) => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function doImport() {
    setLoading(true);
    await onImport(events);
    setDone(true);
    setLoading(false);
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div style={{ width:'100%', maxWidth:480, background:'#111', borderTop:`3px solid ${ACCENT}`, border:`1px solid #2a2a2a`, borderTopColor:ACCENT, borderRadius:4, padding:'24px 24px 20px', boxShadow:'0 16px 48px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column', gap:16, maxHeight:'80vh' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:'0.12em', color:ACCENT }}>
            /import ics — {events.length} event{events.length !== 1 ? 's' : ''} found
          </span>
          {!loading && <button onClick={onClose} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:18 }}>✕</button>}
        </div>

        {/* Event list */}
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:6, flex:1 }}>
          {events.map(ev => (
            <div key={ev.id} style={{ padding:'9px 12px', background:'#0d0d0d', border:'1px solid #2a2a2a', borderLeft:`3px solid ${ACCENT}`, borderRadius:3 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#e2e2e2', fontFamily:'Space Grotesk,sans-serif' }}>{ev.title}</div>
              <div style={{ fontSize:11, color:'#666', fontFamily:"'JetBrains Mono',monospace", marginTop:2 }}>
                {ev.date}{ev.startTime ? ` · ${fmt12(ev.startTime)}` : ''}{ev.endTime ? ` – ${fmt12(ev.endTime)}` : ''}
              </div>
              {ev.description && <div style={{ fontSize:11, color:'#555', marginTop:2, fontFamily:'Space Grotesk,sans-serif' }}>{ev.description}</div>}
            </div>
          ))}
        </div>

        {done ? (
          <div style={{ textAlign:'center', fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#34d399' }}>
            ✓ {events.length} event{events.length !== 1 ? 's' : ''} imported
          </div>
        ) : (
          <button onClick={doImport} disabled={loading} style={{
            padding:'11px 0', background:ACCENT, border:'none', borderRadius:4,
            color:'#080808', fontSize:12, fontWeight:700, fontFamily:"'JetBrains Mono',monospace",
            letterSpacing:'0.08em', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? `Importing…` : `Import ${events.length} event${events.length !== 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Event form modal ────────────────────────────────────────────────────────

interface FormProps {
  initial?: CalendarEvent;
  defaultDate: string;
  onSave: (e: CalendarEvent) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function EventForm({ initial, defaultDate, onSave, onDelete, onClose }: FormProps) {
  const [title, setTitle]       = useState(initial?.title ?? '');
  const [date, setDate]         = useState(initial?.date ?? defaultDate);
  const [startTime, setStart]   = useState(initial?.startTime ?? '');
  const [endTime, setEnd]       = useState(initial?.endTime ?? '');
  const [desc, setDesc]         = useState(initial?.description ?? '');
  const [color, setColor]       = useState(initial?.color ?? ACCENT);
  const [loading, setLoading]   = useState(false);
  const [confirmDel, setConfirm]= useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const payload = { title: title.trim(), date, startTime: startTime || undefined, endTime: endTime || undefined, description: desc.trim() || undefined, color };
      const saved: CalendarEvent = initial
        ? await api.put(`/api/calendar/${initial.id}`, payload)
        : await api.post('/api/calendar', payload);
      onSave(saved);
    } finally { setLoading(false); }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 11px', background: '#0d0d0d',
    border: '1px solid #2a2a2a', borderRadius: 4, color: '#e2e2e2',
    fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', outline: 'none',
    boxSizing: 'border-box', transition: 'border-color 0.15s',
  };
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: '#555', fontFamily: "'JetBrains Mono', monospace", display: 'block', marginBottom: 5,
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width:'100%', maxWidth:420, background:'#111', borderTop:`3px solid ${color}`, border:`1px solid #2a2a2a`, borderTopColor:color, borderRadius:4, padding:'24px 24px 20px', boxShadow:'0 16px 48px rgba(0,0,0,0.7)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, letterSpacing:'0.12em', color:ACCENT }}>
            {initial ? '/edit event' : '/new event'}
          </span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#555', cursor:'pointer', fontSize:18, lineHeight:1 }}>✕</button>
        </div>

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={lbl}>Title *</label>
            <input ref={titleRef} style={inp} value={title} onChange={e => setTitle(e.target.value)} required
              onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = '#2a2a2a')} />
          </div>

          <div>
            <label style={lbl}>Date *</label>
            <input style={inp} type="date" value={date} min="2000-01-01" max="2100-12-31"
              onChange={e => setDate(e.target.value)} required
              onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = '#2a2a2a')} />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={lbl}>Start time</label>
              <input style={inp} type="time" value={startTime} onChange={e => setStart(e.target.value)}
                onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = '#2a2a2a')} />
            </div>
            <div>
              <label style={lbl}>End time</label>
              <input style={inp} type="time" value={endTime} onChange={e => setEnd(e.target.value)}
                onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = '#2a2a2a')} />
            </div>
          </div>

          <div>
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, resize:'vertical' }} rows={2} value={desc} onChange={e => setDesc(e.target.value)}
              onFocus={e => (e.target.style.borderColor = color)} onBlur={e => (e.target.style.borderColor = '#2a2a2a')} />
          </div>

          <div>
            <label style={lbl}>Colour</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {EVENT_COLORS.map(c => (
                <button key={c.val} type="button" onClick={() => setColor(c.val)} style={{
                  width:24, height:24, borderRadius:4, background:c.val, border:`2px solid ${color === c.val ? '#fff' : 'transparent'}`,
                  cursor:'pointer', transition:'border-color 0.12s',
                }} title={c.label} />
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            {initial && (
              confirmDel
                ? <>
                    <button type="button" onClick={onDelete} style={{ flex:1, padding:'9px 0', background:'#f87171', border:'none', borderRadius:4, color:'#080808', fontSize:12, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", cursor:'pointer', letterSpacing:'0.08em' }}>
                      Confirm delete
                    </button>
                    <button type="button" onClick={() => setConfirm(false)} style={{ padding:'9px 14px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:4, color:'#888', fontSize:12, fontFamily:"'JetBrains Mono',monospace", cursor:'pointer' }}>
                      Cancel
                    </button>
                  </>
                : <button type="button" onClick={() => setConfirm(true)} style={{ padding:'9px 14px', background:'transparent', border:'1px solid #2a2a2a', borderRadius:4, color:'#f87171', fontSize:12, fontFamily:"'JetBrains Mono',monospace", cursor:'pointer' }}>
                    Delete
                  </button>
            )}
            <button type="submit" disabled={loading || !title.trim()} style={{
              flex:1, padding:'9px 0', background:color, border:'none', borderRadius:4,
              color:'#080808', fontSize:12, fontWeight:700, fontFamily:"'JetBrains Mono',monospace",
              cursor: loading || !title.trim() ? 'default' : 'pointer',
              opacity: loading || !title.trim() ? 0.6 : 1, letterSpacing:'0.08em',
            }}>
              {loading ? 'Saving…' : initial ? 'Save changes' : 'Add event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CalendarTab ─────────────────────────────────────────────────────────────

export default function CalendarTab() {
  const today = localDateStr();
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [events, setEvents]           = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [loading, setLoading]           = useState(true);
  const [icsEvents, setIcsEvents]       = useState<CalendarEvent[] | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [icsUrl, setIcsUrl]             = useState('');
  const [icsUrlLoading, setIcsUrlLoading] = useState(false);
  const [icsUrlError, setIcsUrlError]   = useState('');
  const icsRef = useRef<HTMLInputElement>(null);

  async function fetchEvents() {
    setLoading(true);
    try {
      const data: CalendarEvent[] = await api.get('/api/calendar');
      setEvents(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  // Fetch on mount and whenever the page regains visibility
  useEffect(() => {
    fetchEvents();
    function onVisible() { if (document.visibilityState === 'visible') fetchEvents(); }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  function prevMonth() {
    if (month === 0) { if (year <= MIN_YEAR) return; setYear(y => y-1); setMonth(11); }
    else setMonth(m => m-1);
  }
  function nextMonth() {
    if (month === 11) { if (year >= MAX_YEAR) return; setYear(y => y+1); setMonth(0); }
    else setMonth(m => m+1);
  }

  function eventsOn(date: string) { return events.filter(e => e.date === date); }

  function handleICSFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseICS(reader.result as string);
      setIcsEvents(parsed.length ? parsed : []);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function fetchICSUrl() {
    if (!icsUrl.trim()) return;
    setIcsUrlLoading(true);
    setIcsUrlError('');
    try {
      const { ics } = await api.post<{ ics: string }>('/api/calendar/fetch-ics', { url: icsUrl.trim() });
      const parsed = parseICS(ics);
      setIcsEvents(parsed);
      setShowUrlInput(false);
      setIcsUrl('');
    } catch (err: any) {
      setIcsUrlError(err?.message ?? 'Failed to fetch ICS URL');
    } finally {
      setIcsUrlLoading(false);
    }
  }

  async function importICSEvents(toImport: CalendarEvent[]) {
    const imported: CalendarEvent[] = [];
    for (const ev of toImport) {
      try {
        const saved: CalendarEvent = await api.post('/api/calendar', {
          title: ev.title, date: ev.date,
          startTime: ev.startTime, endTime: ev.endTime,
          description: ev.description,
        });
        imported.push(saved);
      } catch (err) { console.error('import event failed:', err); }
    }
    setEvents(prev => {
      const ids = new Set(prev.map(e => e.id));
      return [...prev, ...imported.filter(e => !ids.has(e.id))];
    });
  }

  function openNew(date: string) { setSelectedDate(date); setEditingEvent(undefined); setShowForm(true); }
  function openEdit(ev: CalendarEvent) { setEditingEvent(ev); setShowForm(true); }

  function handleSaved(ev: CalendarEvent) {
    setEvents(prev => {
      const without = prev.filter(e => e.id !== ev.id);
      return [...without, ev].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    });
    setShowForm(false);
  }

  async function handleDelete() {
    if (!editingEvent) return;
    await api.delete(`/api/calendar/${editingEvent.id}`);
    setEvents(prev => prev.filter(e => e.id !== editingEvent.id));
    setShowForm(false);
    setEditingEvent(undefined);
  }

  // Build calendar grid
  const dim   = daysInMonth(year, month);
  const start = firstDow(year, month); // 0=Mon
  const cells: (number | null)[] = [
    ...Array(start).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedEvents = selectedDate ? eventsOn(selectedDate) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:900 }}>

      {/* ── Header ── */}
      <div className="card" style={{ padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={prevMonth} disabled={year <= MIN_YEAR && month === 0}
          style={{ background:'none', border:'none', color: year <= MIN_YEAR && month === 0 ? '#333' : '#aaa', fontSize:'1.2rem', cursor: year <= MIN_YEAR && month === 0 ? 'default' : 'pointer', padding:'4px 10px', borderRadius:4 }}
          onMouseEnter={e => { if (!(year <= MIN_YEAR && month === 0)) e.currentTarget.style.color = ACCENT; }}
          onMouseLeave={e => (e.currentTarget.style.color = year <= MIN_YEAR && month === 0 ? '#333' : '#aaa')}
        >‹</button>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:'1.1rem', fontWeight:700, color:'#e2e2e2', letterSpacing:'-0.02em', fontFamily:'Space Grotesk,sans-serif' }}>
            {MONTHS[month]} {year}
          </span>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSelectedDate(today); }}
            style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, letterSpacing:'0.08em', padding:'3px 8px', background:'transparent', border:`1px solid #2a2a2a`, borderRadius:3, color:'#555', cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#555'; }}
          >TODAY</button>
          <button onClick={fetchEvents} title="Refresh"
            style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", padding:'3px 7px', background:'transparent', border:`1px solid #2a2a2a`, borderRadius:3, color:'#555', cursor:'pointer', lineHeight:1 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#555'; }}
          >↻</button>
          <button onClick={() => icsRef.current?.click()} title="Import .ics file"
            style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, letterSpacing:'0.06em', padding:'3px 8px', background:'transparent', border:`1px solid #2a2a2a`, borderRadius:3, color:'#555', cursor:'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#555'; }}
          >↑ ICS</button>
          <button onClick={() => { setShowUrlInput(v => !v); setIcsUrlError(''); }} title="Import from ICS URL"
            style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, letterSpacing:'0.06em', padding:'3px 8px', background: showUrlInput ? ACCENT : 'transparent', border:`1px solid ${showUrlInput ? ACCENT : '#2a2a2a'}`, borderRadius:3, color: showUrlInput ? '#080808' : '#555', cursor:'pointer' }}
          >↑ URL</button>
          <input ref={icsRef} type="file" accept=".ics,text/calendar" style={{ display:'none' }} onChange={handleICSFile} />
        </div>

        <button onClick={nextMonth} disabled={year >= MAX_YEAR && month === 11}
          style={{ background:'none', border:'none', color: year >= MAX_YEAR && month === 11 ? '#333' : '#aaa', fontSize:'1.2rem', cursor: year >= MAX_YEAR && month === 11 ? 'default' : 'pointer', padding:'4px 10px', borderRadius:4 }}
          onMouseEnter={e => { if (!(year >= MAX_YEAR && month === 11)) e.currentTarget.style.color = ACCENT; }}
          onMouseLeave={e => (e.currentTarget.style.color = year >= MAX_YEAR && month === 11 ? '#333' : '#aaa')}
        >›</button>
      </div>

      {/* ── ICS URL input bar ── */}
      {showUrlInput && (
        <div className="card" style={{ padding:'12px 16px', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <input
            value={icsUrl}
            onChange={e => setIcsUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchICSUrl()}
            placeholder="Paste webcal:// or https:// ICS link…"
            autoFocus
            style={{ flex:1, minWidth:200, padding:'8px 11px', background:'#0d0d0d', border:`1px solid #2a2a2a`, borderRadius:4, color:'#e2e2e2', fontSize:13, fontFamily:'Space Grotesk,sans-serif', outline:'none' }}
            onFocus={e => (e.target.style.borderColor = ACCENT)}
            onBlur={e => (e.target.style.borderColor = '#2a2a2a')}
          />
          <button onClick={fetchICSUrl} disabled={icsUrlLoading || !icsUrl.trim()} style={{
            padding:'8px 14px', background:ACCENT, border:'none', borderRadius:4,
            color:'#080808', fontSize:12, fontWeight:700, fontFamily:"'JetBrains Mono',monospace",
            cursor: icsUrlLoading || !icsUrl.trim() ? 'default' : 'pointer',
            opacity: icsUrlLoading || !icsUrl.trim() ? 0.6 : 1,
          }}>
            {icsUrlLoading ? 'Fetching…' : 'Fetch'}
          </button>
          {icsUrlError && <span style={{ width:'100%', fontSize:11, color:'#f87171', fontFamily:"'JetBrains Mono',monospace" }}>✕ {icsUrlError}</span>}
        </div>
      )}

      <div style={{ display:'flex', gap:16, alignItems:'flex-start' }}>

        {/* ── Calendar grid ── */}
        <div className="card" style={{ flex:1, padding:0, overflow:'hidden' }}>
          {/* Day-of-week headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid var(--border)' }}>
            {DOW.map(d => (
              <div key={d} style={{ padding:'8px 0', textAlign:'center', fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {cells.map((day, i) => {
              if (!day) return <div key={`e${i}`} style={{ minHeight:80, borderRight: (i+1)%7===0 ? 'none' : '1px solid var(--border)', borderBottom:'1px solid var(--border)' }} />;
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayEvents = eventsOn(dateStr);
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const isOtherMonth = false;

              return (
                <div key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  style={{
                    minHeight:80, padding:'6px 8px',
                    borderRight: (i+1)%7===0 ? 'none' : '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'rgba(192,132,252,0.08)' : 'transparent',
                    cursor:'pointer', transition:'background 0.12s',
                    display:'flex', flexDirection:'column', gap:2,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{
                    fontSize:12, fontWeight: isToday ? 700 : 400,
                    color: isToday ? '#080808' : '#e2e2e2',
                    fontFamily:"'JetBrains Mono',monospace", lineHeight:1,
                    background: isToday ? ACCENT : 'transparent',
                    borderRadius:3, padding: isToday ? '2px 5px' : '2px 0',
                    alignSelf:'flex-start',
                  }}>{day}</span>

                  {dayEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} style={{
                      fontSize:10, padding:'2px 5px', borderRadius:3,
                      background: (ev.color ?? ACCENT) + '22',
                      borderLeft:`2px solid ${ev.color ?? ACCENT}`,
                      color: ev.color ?? ACCENT,
                      fontFamily:'Space Grotesk,sans-serif', fontWeight:600,
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                    }}>
                      {ev.startTime ? `${fmt12(ev.startTime)} ` : ''}{ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <span style={{ fontSize:9, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>
                      +{dayEvents.length - 2} more
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Day detail panel ── */}
        {selectedDate && (
          <div style={{ width:260, flexShrink:0 }}>
            <div className="card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'0.1em', color:'#555', fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase' }}>
                    {new Date(selectedDate+'T00:00:00').toLocaleDateString('en-US', { weekday:'short' })}
                  </div>
                  <div style={{ fontSize:20, fontWeight:700, color:'#e2e2e2', fontFamily:"'JetBrains Mono',monospace", lineHeight:1.2 }}>
                    {new Date(selectedDate+'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}
                  </div>
                </div>
                <button onClick={() => openNew(selectedDate)} style={{
                  width:30, height:30, background:`rgba(192,132,252,0.12)`, border:`1px solid ${ACCENT}`,
                  borderRadius:4, color:ACCENT, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1,
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = ACCENT, e.currentTarget.style.color = '#080808')}
                  onMouseLeave={e => (e.currentTarget.style.background = `rgba(192,132,252,0.12)`, e.currentTarget.style.color = ACCENT)}
                >+</button>
              </div>

              {selectedEvents.length === 0 ? (
                <div style={{ padding:'16px', fontSize:12, color:'#555', fontFamily:"'JetBrains Mono',monospace", textAlign:'center' }}>
                  No events
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column' }}>
                  {selectedEvents.map((ev, i) => (
                    <div key={ev.id}
                      onClick={() => openEdit(ev)}
                      style={{
                        padding:'12px 16px', cursor:'pointer',
                        borderBottom: i < selectedEvents.length-1 ? '1px solid var(--border)' : 'none',
                        borderLeft:`3px solid ${ev.color ?? ACCENT}`,
                        transition:'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontSize:13, fontWeight:600, color:'#e2e2e2', fontFamily:'Space Grotesk,sans-serif', marginBottom:2 }}>
                        {ev.title}
                      </div>
                      {(ev.startTime || ev.endTime) && (
                        <div style={{ fontSize:11, color:'#666', fontFamily:"'JetBrains Mono',monospace" }}>
                          {ev.startTime ? fmt12(ev.startTime) : ''}{ev.endTime ? ` – ${fmt12(ev.endTime)}` : ''}
                        </div>
                      )}
                      {ev.description && (
                        <div style={{ fontSize:12, color:'#888', fontFamily:'Space Grotesk,sans-serif', marginTop:4, lineHeight:1.4 }}>
                          {ev.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {icsEvents !== null && (
        <ICSImportModal
          events={icsEvents}
          onImport={importICSEvents}
          onClose={() => setIcsEvents(null)}
        />
      )}

      {showForm && (
        <EventForm
          initial={editingEvent}
          defaultDate={selectedDate ?? today}
          onSave={handleSaved}
          onDelete={editingEvent ? handleDelete : undefined}
          onClose={() => { setShowForm(false); setEditingEvent(undefined); }}
        />
      )}
    </div>
  );
}
