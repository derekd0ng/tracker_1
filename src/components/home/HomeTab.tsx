import { useState, useEffect, useRef } from 'react';
import type { TabId } from '../../types';
import {
  getWellbeingEntries, getMedications, getMedLogs, getMedLogsForDate,
  getHabits, getHabitLogs, getHabitLogsForDate,
} from '../../storage';

interface Props { onNavigate: (tab: TabId) => void }

// ── Accent colors per module — Option B (emerald → orchid arc) ───────────────
const ACCENTS: Record<string, string> = {
  wellbeing:   '#34d399',
  medications: '#22d3ee',
  habits:      '#60a5fa',
  todo:        '#818cf8',
  diary:       '#e879f9',
  calendar:    '#c084fc',
};

// All Option A colors are mid-bright → dark text (#080808) readable on hover fill
const HOVER_TEXT = '#080808';

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '255,255,255';
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+ 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isHabitDone(type: string, target: number|undefined, value: number|undefined): boolean {
  if (value == null) return false;
  if (type === 'boolean') return value > 0;
  if (target != null) return value >= target;
  return value > 0;
}

function computeStreak(habitId: string, allLogs: {habitId:string;date:string;value:number}[]): number {
  const d = new Date();
  const todayLog = allLogs.find(l => l.habitId === habitId && l.date === localDateStr(d));
  if (!todayLog || todayLog.value <= 0) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (true) {
    const log = allLogs.find(l => l.habitId === habitId && l.date === localDateStr(d));
    if (!log || log.value <= 0) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// ── Canvas constants ──────────────────────────────────────────────────────────
const CW = 1440, CH = 660;
const CARD_W = 380, CARD_H = 180;
const NAV = 64;
const HAB_NAV_W = 130, HAB_NAV_H = 76;

// Row Y — 20px margins, 40px gaps between rows
const R1Y = 20, R2Y = 240, R3Y = 460;

// Row X — symmetric around CX=720
const R1_LX = 270, R1_RX = 790;
const R3_LX = 270, R3_RX = 790;
const R2_LX = 20,  R2_RX = 1040;

const NL = 654, NR = 722;
const NY1 = R1Y + (CARD_H - NAV) / 2;   // 78
const NY2 = R2Y + (CARD_H - NAV) / 2;   // 298
const NY3 = R3Y + (CARD_H - NAV) / 2;   // 518

const CENTER_SQ = 180;
const CENTER_X = CW / 2 - CENTER_SQ / 2;             // 630
const CENTER_Y = R2Y + CARD_H / 2 - CENTER_SQ / 2;   // 150+90-90 = 240

interface Module {
  id: TabId | 'calendar';
  label: string;
  shortLabel: string;
  col: string;
  cardX: number; cardY: number;
  navX: number;  navY: number;
  navW?: number; navH?: number;
  side: 'left' | 'right';
  cardInnerEdgeX: number;
  cardCY: number;
}

const MODULES: Module[] = [
  { id:'wellbeing',   label:'WELL-BEING',  shortLabel:'WB',  col:ACCENTS.wellbeing,
    cardX:R1_LX, cardY:R1Y,
    navX:R1_LX+CARD_W-HAB_NAV_W/2, navY:R1Y+CARD_H-HAB_NAV_H/2,
    navW:HAB_NAV_W, navH:HAB_NAV_H, side:'left',
    cardInnerEdgeX:R1_LX+CARD_W, cardCY:R1Y+CARD_H/2 },
  { id:'medication',  label:'MEDICATIONS', shortLabel:'MED', col:ACCENTS.medications,
    cardX:R1_RX, cardY:R1Y, navX:NR, navY:NY1, side:'right',
    cardInnerEdgeX:R1_RX, cardCY:R1Y+CARD_H/2 },
  { id:'habits',      label:'HABITS',      shortLabel:'HABITS', col:ACCENTS.habits,
    cardX:R2_LX, cardY:R2Y,
    navX:R2_LX+CARD_W-HAB_NAV_W/2, navY:R2Y+CARD_H/2-HAB_NAV_H/2,
    navW:HAB_NAV_W, navH:HAB_NAV_H, side:'left',
    cardInnerEdgeX:R2_LX+CARD_W, cardCY:R2Y+CARD_H/2 },
  { id:'todo',        label:'TO-DOS',      shortLabel:'TO-DOS', col:ACCENTS.todo,
    cardX:R2_RX, cardY:R2Y,
    navX:R2_RX-HAB_NAV_W-20, navY:R2Y+CARD_H/2-HAB_NAV_H/2,
    navW:HAB_NAV_W, navH:HAB_NAV_H, side:'right',
    cardInnerEdgeX:R2_RX, cardCY:R2Y+CARD_H/2 },
  { id:'diary',       label:'DIARY',       shortLabel:'LOG', col:ACCENTS.diary,
    cardX:R3_LX, cardY:R3Y, navX:NL, navY:NY3, side:'left',
    cardInnerEdgeX:R3_LX+CARD_W, cardCY:R3Y+CARD_H/2 },
  { id:'calendar',    label:'CALENDAR',    shortLabel:'CAL', col:ACCENTS.calendar,
    cardX:R3_RX, cardY:R3Y, navX:NR, navY:NY3, side:'right',
    cardInnerEdgeX:R3_RX, cardCY:R3Y+CARD_H/2 },
];

// ── BrainCard ─────────────────────────────────────────────────────────────────
function BrainCard({ module, onNavigate, style, children }: {
  module: Module; onNavigate: (id: TabId) => void;
  style: React.CSSProperties; children: (hov: boolean) => React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  const isCalendar = module.id === 'calendar';
  return (
    <div
      onClick={() => !isCalendar && onNavigate(module.id as TabId)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && !isCalendar ? module.col : '#0d0d0d',
        border: `1px solid ${isCalendar ? 'rgba(6,182,212,0.25)' : module.col}`,
        color: hov && !isCalendar ? HOVER_TEXT : '#e2e2e2',
        borderRadius: 4,
        cursor: isCalendar ? 'default' : 'pointer',
        padding: '12px 14px 10px',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.18s',
        ...style,
      }}
    >
      <div style={{
        fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
        color: hov && !isCalendar ? HOVER_TEXT : module.col,
        fontFamily: "'JetBrains Mono', monospace",
        marginBottom: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{module.label}</span>
        {hov && !isCalendar && <span style={{ opacity: 0.5, fontSize: 10 }}>→</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children(hov && !isCalendar)}</div>
    </div>
  );
}

// ── BrainNav ──────────────────────────────────────────────────────────────────
function BrainNav({ module, onNavigate, style }: {
  module: Module; onNavigate: (id: TabId) => void; style: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  const isRect = !!(module.navW && module.navH);
  const isCalendar = module.id === 'calendar';
  const col = module.col;
  return (
    <div
      onClick={() => !isCalendar && onNavigate(module.id as TabId)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && !isCalendar ? col : `rgba(${hexToRgb(col)},0.08)`,
        border: `1px solid ${isCalendar ? 'rgba(6,182,212,0.3)' : col}`,
        borderRadius: 4,
        cursor: isCalendar ? 'default' : 'pointer',
        display: 'flex', flexDirection: isRect ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: isRect ? 8 : 4,
        opacity: isCalendar ? 0.4 : 1,
        transition: 'all 0.15s',
        ...style,
      }}
    >
      <NavIcon id={module.id} size={isRect ? 14 : 16} color={hov && !isCalendar ? HOVER_TEXT : col} />
      <div style={{
        fontSize: isRect ? 10 : 7, fontWeight: 700, letterSpacing: '0.08em',
        color: hov && !isCalendar ? HOVER_TEXT : col,
        fontFamily: "'JetBrains Mono', monospace", textAlign: 'center', lineHeight: 1.1,
      }}>
        {module.shortLabel}
      </div>
    </div>
  );
}

function NavIcon({ id, size, color }: { id: string; size: number; color: string }) {
  const p = { width: size, height: size, stroke: color, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' as const };
  switch (id) {
    case 'wellbeing':   return <svg {...p} viewBox="0 0 16 16"><path d="M8 13S2.5 9.5 2.5 5.5a3.5 3.5 0 0 1 5.5-2.9 3.5 3.5 0 0 1 5.5 2.9C13.5 9.5 8 13 8 13z"/></svg>;
    case 'medication':  return <svg {...p} viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="9" rx="1.5"/><path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><line x1="8" y1="6.5" x2="8" y2="10.5"/><line x1="6" y1="8.5" x2="10" y2="8.5"/></svg>;
    case 'habits':      return <svg {...p} viewBox="0 0 16 16"><polyline points="2,8 6,12 14,4"/></svg>;
    case 'todo':        return <svg {...p} viewBox="0 0 16 16"><line x1="5" y1="4" x2="14" y2="4"/><line x1="5" y1="8" x2="14" y2="8"/><line x1="5" y1="12" x2="14" y2="12"/><polyline points="2,3.5 3,4.5 4,2.5"/><polyline points="2,7.5 3,8.5 4,6.5"/></svg>;
    case 'diary':       return <svg {...p} viewBox="0 0 16 16"><rect x="3" y="1" width="10" height="13" rx="1.5"/><line x1="6" y1="5" x2="10" y2="5"/><line x1="6" y1="8" x2="10" y2="8"/><line x1="6" y1="11" x2="9" y2="11"/></svg>;
    case 'calendar':    return <svg {...p} viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="12" rx="1.5"/><line x1="1.5" y1="6.5" x2="14.5" y2="6.5"/><line x1="5" y1="1" x2="5" y2="4"/><line x1="11" y1="1" x2="11" y2="4"/></svg>;
    default: return null;
  }
}

// ── Mini card contents ────────────────────────────────────────────────────────

function WbMini({ accent, hov }: { accent: string; hov: boolean }) {
  const entries = getWellbeingEntries().sort((a,b) => b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
  const latest = entries[0];
  const latestHR  = entries.find(e => e.heartRate != null);
  const latestSpo = entries.find(e => e.spo2 != null);

  if (!latest) return (
    <div style={{ fontSize: 11, color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>No entries yet</div>
  );

  const metrics = [
    { l:'HR',   v: latestHR?.heartRate,  u:'bpm', c:'#f87171' },
    { l:'SPO₂', v: latestSpo?.spo2,      u:'%',   c:'#34d399' },
    { l:'FEEL', v: latest.overallFeel,   u:'/10', c: accent    },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 7 }}>
      {latest.overallFeel != null && (
        <div style={{ display:'flex', alignItems:'baseline', gap: 5 }}>
          <span style={{ fontSize: 32, fontWeight: 700, color: accent, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{latest.overallFeel}</span>
          <span style={{ fontSize: 11, color: '#555', fontFamily:"'JetBrains Mono',monospace" }}>/10 feel</span>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap: 4 }}>
        {metrics.map(m => (
          <div key={m.l} style={{ background:'#121212', borderRadius: 2, padding:'5px 6px', border:'1px solid #1e1e1e' }}>
            <div style={{ fontSize: 7.5, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>{m.l}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: m.v != null ? m.c : '#333', fontFamily:"'JetBrains Mono',monospace", lineHeight: 1.3 }}>
              {m.v ?? '—'}<span style={{ fontSize: 8, color:'#333' }}>{m.v != null ? m.u : ''}</span>
            </div>
          </div>
        ))}
      </div>
      {latest.symptoms.length > 0 && (
        <div style={{ fontSize: 9.5, color:'#555', fontFamily:"'JetBrains Mono',monospace", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {latest.symptoms.map(s => s.name).join(' · ')}
        </div>
      )}
    </div>
  );
}

function MedMini({ accent, hov }: { accent: string; hov: boolean }) {
  const today = localDateStr();
  const meds = getMedications().filter(m => m.active && (!m.startDate || m.startDate <= today));
  const logs = getMedLogsForDate(today);
  const allLogs = getMedLogs();

  const totalDoses = meds.reduce((n,m) => n + m.timesOfDay.length, 0);
  const takenDoses = meds.reduce((n,m) => n + m.timesOfDay.filter(t =>
    logs.some(l => l.medicationId === m.id && l.timeOfDay === t && l.taken)
  ).length, 0);
  const pct = totalDoses > 0 ? Math.round(takenDoses / totalDoses * 100) : 0;

  const slots = ['morning','afternoon','evening','night'] as const;

  if (meds.length === 0) return (
    <div style={{ fontSize: 11, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>No medications</div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 7 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap: 5 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: accent, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{takenDoses}</span>
        <span style={{ fontSize: 11, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>/{totalDoses} taken</span>
      </div>
      <div style={{ height: 2.5, background:'#121212', borderRadius: 1, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background: accent }}/>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 3 }}>
        {slots.map(slot => {
          const slotMeds = meds.filter(m => m.timesOfDay.includes(slot));
          if (slotMeds.length === 0) return null;
          const taken = slotMeds.filter(m => logs.some(l => l.medicationId === m.id && l.timeOfDay === slot && l.taken)).length;
          return (
            <div key={slot} style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize: 9.5, color:'#555', fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase', letterSpacing:'0.05em' }}>{slot}</span>
              <span style={{ fontSize: 9.5, color: taken === slotMeds.length ? '#22c55e' : '#555', fontFamily:"'JetBrains Mono',monospace" }}>{taken}/{slotMeds.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HabMini({ accent, hov }: { accent: string; hov: boolean }) {
  const today = localDateStr();
  const habits = getHabits().filter(h => (h.frequency ?? 'daily') === 'daily');
  const todayLogs = getHabitLogsForDate(today);
  const allLogs = getHabitLogs();

  const done = habits.filter(h => {
    const log = todayLogs.find(l => l.habitId === h.id);
    return isHabitDone(h.type, h.target, log?.value);
  }).length;

  const bestStreak = habits.length > 0 ? Math.max(0, ...habits.map(h => computeStreak(h.id, allLogs))) : 0;

  if (habits.length === 0) return (
    <div style={{ fontSize: 11, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>No habits yet</div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
      <div style={{ display:'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 8, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>TODAY</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: accent, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1.1 }}>{done}/{habits.length}</div>
        </div>
        {bestStreak > 0 && (
          <div>
            <div style={{ fontSize: 8, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>STREAK</div>
            <div style={{ fontSize: 28, fontWeight: 700, color:'#f97316', fontFamily:"'JetBrains Mono',monospace", lineHeight: 1.1 }}>{bestStreak}d</div>
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap: 4, flexWrap:'wrap' }}>
        {habits.map(h => {
          const log = todayLogs.find(l => l.habitId === h.id);
          const isDone = isHabitDone(h.type, h.target, log?.value);
          return (
            <div key={h.id} style={{ width: 8, height: 8, borderRadius: 1, background: isDone ? accent : '#121212', border: `1px solid ${isDone ? accent : '#2a2a2a'}` }}/>
          );
        })}
      </div>
    </div>
  );
}

function TodoMini({ accent, hov }: { accent: string; hov: boolean }) {
  const [todos, setTodos] = useState<{ title: string; done: boolean }[]>([]);
  useEffect(() => {
    import('../../api').then(({ api }) =>
      api.get<{ title: string; done: boolean }[]>('/api/todos')
        .then(setTodos).catch(() => {})
    );
  }, []);

  const pending = todos.filter(t => !t.done);

  const fg      = hov ? HOVER_TEXT : '#e2e2e2';
  const fgMuted = hov ? 'rgba(0,0,0,0.5)' : '#555';
  const dot     = hov ? 'rgba(0,0,0,0.6)' : accent;

  if (todos.length === 0) return (
    <div style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>No to-dos yet</div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 7 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap: 5 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: fg, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{pending.length}</span>
        <span style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>pending</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 4 }}>
        {pending.slice(0, 4).map((t, i) => (
          <div key={i} style={{ display:'flex', alignItems:'flex-start', gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: 1, flexShrink: 0, marginTop: 3.5, background: dot }}/>
            <span style={{ fontSize: 10.5, color: fg, fontFamily:'Space Grotesk,sans-serif', lineHeight: 1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiaryMini({ accent, hov }: { accent: string; hov: boolean }) {
  const entries = (() => {
    try { return Object.values(JSON.parse(localStorage.getItem('srt_diary') ?? '{}')) as {date:string;freeText:string;updatedAt:string}[]; }
    catch { return []; }
  })();

  const sorted = entries.filter(e => e.freeText?.trim()).sort((a,b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const thisMonth = entries.filter(e => e.date?.startsWith(localDateStr().slice(0,7))).length;

  if (!latest) return (
    <div style={{ fontSize: 11, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>No entries yet</div>
  );

  const d = new Date(latest.date + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { month:'short', day:'numeric' });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 7 }}>
      <div style={{ fontSize: 8.5, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>LAST ENTRY · {dateLabel.toUpperCase()}</div>
      <div style={{ fontSize: 11, color:'#e2e2e2', fontFamily:'Space Grotesk,sans-serif', lineHeight: 1.6, flex: 1,
        overflow:'hidden', display:'-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient:'vertical' } as React.CSSProperties}>
        {latest.freeText}
      </div>
      <div style={{ fontSize: 9.5, color: accent, fontFamily:"'JetBrains Mono',monospace" }}>{thisMonth} entries this month</div>
    </div>
  );
}

function CalMini({ accent }: { accent: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 5 }}>
      <div style={{ fontSize: 8.5, color:'#555', fontFamily:"'JetBrains Mono',monospace", marginBottom: 1 }}>COMING SOON</div>
      <div style={{ fontSize: 10.5, color:'#383838', fontFamily:'Space Grotesk,sans-serif', lineHeight: 1.6 }}>
        Calendar integration will let you see appointments, reminders, and events alongside your recovery data.
      </div>
    </div>
  );
}

// ── CenterGoals ───────────────────────────────────────────────────────────────
function CenterGoals({ pct, done, total }: { pct: number; done: number; total: number }) {

  return (
    <div style={{
      position: 'absolute', left: CENTER_X, top: CENTER_Y,
      width: CENTER_SQ, height: CENTER_SQ, zIndex: 3,
      background: '#0d0d0d',
      border: '2px solid #2a2a2a',
      borderRadius: 4,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 2,
    }}>
      {/* Text */}
      <span style={{ fontSize: 28, fontWeight: 700, color: '#e2e2e2', fontFamily:"'JetBrains Mono',monospace", lineHeight: 1, position: 'relative' }}>
        {pct}<span style={{ fontSize: 13, color: '#555' }}>%</span>
      </span>
      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555', fontFamily:"'JetBrains Mono',monospace", position: 'relative' }}>
        Daily Goals
      </span>
      {total > 0 && (
        <span style={{ fontSize: 9, color: '#383838', fontFamily:"'JetBrains Mono',monospace", position: 'relative', marginTop: 2 }}>
          {done}/{total}
        </span>
      )}
    </div>
  );
}

// ── HomeTab ───────────────────────────────────────────────────────────────────
export default function HomeTab({ onNavigate }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function upd() {
      if (!wrapRef.current) return;
      setScale(wrapRef.current.offsetWidth / CW);
    }
    upd();
    const ro = new ResizeObserver(upd);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }).toUpperCase();

  // Overall pct
  const todayStr = localDateStr();
  const meds = getMedications().filter(m => m.active && (!m.startDate || m.startDate <= todayStr));
  const medLogs = getMedLogsForDate(todayStr);
  const takenMeds = meds.reduce((n,m) => n + m.timesOfDay.filter(t =>
    medLogs.some(l => l.medicationId === m.id && l.timeOfDay === t && l.taken)
  ).length, 0);
  const totalMeds = meds.reduce((n,m) => n + m.timesOfDay.length, 0);

  const habits = getHabits().filter(h => (h.frequency ?? 'daily') === 'daily');
  const habitLogs = getHabitLogsForDate(todayStr);
  const doneHabits = habits.filter(h => {
    const log = habitLogs.find(l => l.habitId === h.id);
    return isHabitDone(h.type, h.target, log?.value);
  }).length;

  const totalGoals = totalMeds + habits.length;
  const pct = totalGoals > 0 ? Math.round(((takenMeds + doneHabits) / totalGoals) * 100) : 0;

  const cardContent = (m: Module, hov: boolean) => {
    switch (m.id) {
      case 'wellbeing':  return <WbMini accent={m.col} hov={hov} />;
      case 'medication': return <MedMini accent={m.col} hov={hov} />;
      case 'habits':     return <HabMini accent={m.col} hov={hov} />;
      case 'todo':       return <TodoMini accent={m.col} hov={hov} />;
      case 'diary':      return <DiaryMini accent={m.col} hov={hov} />;
      case 'calendar':   return <CalMini accent={m.col} />;
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>

      {/* Header */}
      <div style={{ borderBottom:'1px solid #1e1e1e', paddingBottom: 14, display:'flex', alignItems:'baseline', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing:'-0.02em', color:'#e2e2e2', fontFamily:'Space Grotesk,sans-serif' }}>
          Home
        </h1>
        <span style={{ fontSize: 11, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>{dateLabel}</span>
        {totalGoals > 0 && (
          <span style={{ marginLeft:'auto', fontSize: 11, color:'#555', fontFamily:"'JetBrains Mono',monospace" }}>
            <span style={{ color:'#e2e2e2', fontWeight: 700 }}>{pct}%</span> daily goals
          </span>
        )}
      </div>

      {/* Canvas */}
      <div ref={wrapRef} style={{ width:'100%', height: CH * scale }}>
        <div style={{ width: CW, height: CH, position:'relative', transform:`scale(${scale})`, transformOrigin:'top left' }}>

{/* Cards */}
          {MODULES.map(m => (
            <BrainCard key={m.id}
              style={{ position:'absolute', left: m.cardX, top: m.cardY, width: CARD_W, height: CARD_H, zIndex: 1 }}
              module={m} onNavigate={onNavigate}>
              {(hov) => cardContent(m, hov)}
            </BrainCard>
          ))}

          {/* Center goals square */}
          <CenterGoals pct={pct} done={takenMeds + doneHabits} total={totalGoals} />
        </div>
      </div>
    </div>
  );
}
