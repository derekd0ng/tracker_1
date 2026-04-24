import { useState, useEffect, useRef } from 'react';
import type { TabId } from '../../types';
import {
  getWellbeingEntries, getMedications, getMedLogs, getMedLogsForDate,
  getHabits, getHabitLogs, getHabitLogsForDate,
  toggleMedLog, setHabitLog,
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
const CW = 1440, CH = 628;
const CARD_W = 380, CARD_H = 180;
const NAV = 64;
const HAB_NAV_W = 130, HAB_NAV_H = 76;

// Row Y — 20px margins, 24px gaps between rows
const R1Y = 20, R2Y = 224, R3Y = 428;

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

// Shared hover-aware color helper
const C = (hov: boolean) => ({
  fg:      hov ? HOVER_TEXT         : '#e2e2e2',
  fgMuted: hov ? 'rgba(0,0,0,0.5)' : '#555555',
  fgDim:   hov ? 'rgba(0,0,0,0.3)' : '#383838',
  bg:      hov ? 'rgba(0,0,0,0.12)': '#121212',
  border:  hov ? 'rgba(0,0,0,0.15)': '#1e1e1e',
});

const MINI_MAX = 5; // max rows before "+X more"

function CheckSq({ done, accent, hov }: { done: boolean; accent: string; hov: boolean }) {
  const col = done ? (hov ? 'rgba(0,0,0,0.6)' : accent) : (hov ? 'rgba(0,0,0,0.25)' : '#383838');
  return (
    <svg width={13} height={13} viewBox="0 0 16 16" fill="none"
      stroke={col} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="12" height="12" rx="1.5"/>
      {done && <polyline points="5,8 7,10 11,6"/>}
    </svg>
  );
}

// Status helpers for wb grid
const WB_SC: Record<string,string> = { good:'#34d399',warning:'#facc15',caution:'#fb923c',bad:'#f87171',neutral:'#888' };
const wbS = (v:number, r:[number,string][]) => { for(const [t,s] of r) if(v>=t) return WB_SC[s]; return WB_SC.neutral; };
const feelSC  = (v:number) => wbS(v,[[8,'good'],[6,'warning'],[3,'caution'],[0,'bad']]);
const spo2SC  = (v:number) => wbS(v,[[95,'good'],[92,'warning'],[90,'caution'],[0,'bad']]);
const sleepSC = (v:number) => wbS(v,[[80,'good'],[60,'warning'],[40,'caution'],[0,'bad']]);
const sysSC   = (v:number) => v>=150?WB_SC.bad:v>=135?WB_SC.caution:v>=120?WB_SC.warning:v>=90?WB_SC.good:WB_SC.warning;
const diaSC   = (v:number) => v>100?WB_SC.bad:v>=85?WB_SC.caution:v>=80?WB_SC.warning:v>=60?WB_SC.good:WB_SC.warning;
const hrSC    = (hr:number,avg:number|null) => { if(!avg) return WB_SC.good; const p=Math.abs(hr-avg)/avg; return p<=.10?WB_SC.good:p<=.20?WB_SC.warning:p<=.30?WB_SC.caution:WB_SC.bad; };
const sympSC  = (i:number) => i<=1?WB_SC.neutral:i<=4?WB_SC.warning:i<=7?WB_SC.caution:WB_SC.bad;
const stronger= (a:string,b:string) => { const r:Record<string,number>={[WB_SC.bad]:4,[WB_SC.caution]:3,[WB_SC.warning]:2,[WB_SC.good]:1,[WB_SC.neutral]:0}; return (r[a]??0)>=(r[b]??0)?a:b; };

function WbMini({ accent, hov }: { accent: string; hov: boolean }) {
  const { fgMuted, bg, border } = C(hov);
  const entries = getWellbeingEntries().sort((a,b) => b.date.localeCompare(a.date)||b.time.localeCompare(a.time));
  const latest    = entries[0];
  const latestHR  = entries.find(e => e.heartRate  != null);
  const latestBP  = entries.find(e => e.systolicBP != null && e.diastolicBP != null);
  const latestSpo = entries.find(e => e.spo2       != null);
  const sleepHabitId = getHabits().find(h => /sleep/i.test(h.name))?.id;
  const latestSleep  = sleepHabitId
    ? getHabitLogs().filter(l => l.habitId === sleepHabitId && l.value > 0).sort((a,b) => b.date.localeCompare(a.date))[0] ?? null
    : null;
  const thirtyAgo = (() => { const d=new Date(); d.setDate(d.getDate()-30); return localDateStr(d); })();
  const avgHr = (() => {
    const vals = entries.filter(e => e.date >= thirtyAgo && e.heartRate != null).map(e => e.heartRate as number);
    return vals.length ? vals.reduce((s,v)=>s+v,0)/vals.length : null;
  })();

  if (!latest) return (
    <div style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>No entries yet</div>
  );

  // Build grid cells (everything except feel)
  type Cell = { l:string; v:string; u:string; c:string; isNone?:boolean };
  const cells: Cell[] = [];
  if (latestHR?.heartRate   != null) cells.push({ l:'HR',   v:String(latestHR.heartRate),  u:'bpm',  c:hrSC(latestHR.heartRate, avgHr) });
  if (latestBP?.systolicBP  != null) cells.push({ l:'BP',   v:`${latestBP.systolicBP}/${latestBP.diastolicBP}`, u:'mmHg', c:stronger(sysSC(latestBP.systolicBP!),diaSC(latestBP.diastolicBP!)) });
  if (latestSpo?.spo2       != null) cells.push({ l:'SpO₂', v:String(latestSpo.spo2),       u:'%',    c:spo2SC(latestSpo.spo2!) });
  if (latestSleep)                    cells.push({ l:'Sleep',v:String(latestSleep.value),     u:'/100', c:sleepSC(latestSleep.value) });
  if (latest.symptoms.length === 0)   cells.push({ l:'Symptoms', v:'None', u:'', c:WB_SC.neutral, isNone:true });
  else latest.symptoms.forEach(s =>   cells.push({ l:s.name, v:String(s.intensity), u:'/10', c:sympSC(s.intensity) }));

  // 3×2 grid: max 6 cells; if 5 → last spans 2 cols; if >6 → replace 6th with +X more
  const MAX = 6;
  const overflow = cells.length > MAX ? cells.length - MAX + 1 : 0;
  const visible  = overflow > 0
    ? [...cells.slice(0, MAX - 1), { l:'', v:`+${overflow}`, u:' more', c:WB_SC.neutral, isNone:true }]
    : cells;
  const isFive   = visible.length === 5;
  const div      = hov ? 'rgba(0,0,0,0.15)' : 'var(--border)';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', justifyContent:'space-between' }}>
      {/* Big feel number */}
      {latest.overallFeel != null && (
        <div style={{ display:'flex', alignItems:'baseline', gap: 5, paddingBottom: 7 }}>
          <span style={{ fontSize: 30, fontWeight: 700, color: hov ? HOVER_TEXT : feelSC(latest.overallFeel), fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{latest.overallFeel}</span>
          <span style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>/10 feel</span>
        </div>
      )}
      {/* 3-column 2-row grid strip */}
      {visible.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          borderTop: `1px solid ${div}`,
          marginLeft: -14, marginRight: -14, flex: 1,
        }}>
          {visible.map((m, i) => {
            const isSpan    = isFive && i === 4;
            const noRight   = (i % 3 === 2) || isSpan;
            const hasTopBdr = i >= 3;
            return (
              <div key={i} style={{
                gridColumn: isSpan ? 'span 2' : undefined,
                borderRight: noRight ? 'none' : `1px solid ${div}`,
                borderTop: hasTopBdr ? `1px solid ${div}` : 'none',
                padding: '5px 8px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <span style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: '0.06em', color: fgMuted, textTransform: 'uppercase', fontFamily:"'JetBrains Mono',monospace", whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {m.l}
                </span>
                {m.isNone ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: fgMuted, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{m.v}</span>
                ) : (
                  <div style={{ display:'flex', alignItems:'baseline', gap: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: hov ? HOVER_TEXT : m.c, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{m.v}</span>
                    <span style={{ fontSize: 6.5, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>{m.u}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SLOT_ORDER = ['morning','afternoon','evening','night'] as const;
type Slot = typeof SLOT_ORDER[number];
const SLOT_LABEL: Record<Slot, string> = { morning:'Morning', afternoon:'Afternoon', evening:'Evening', night:'Night' };

function currentSlotIndex() {
  const h = new Date().getHours();
  if (h >= 8 && h < 13) return 0;
  if (h >= 13 && h < 17) return 1;
  if (h >= 17 && h < 20) return 2;
  return 3;
}

function MedMini({ accent, hov }: { accent: string; hov: boolean }) {
  const { fg, fgMuted, fgDim } = C(hov);
  const [tick, setTick] = useState(0);
  const today = localDateStr();
  const meds = getMedications().filter(m => m.active && (!m.startDate || m.startDate <= today));
  const logs = getMedLogsForDate(today);

  const totalDoses = meds.reduce((n,m) => n + m.timesOfDay.length, 0);
  const takenDoses = meds.reduce((n,m) => n + m.timesOfDay.filter(s =>
    logs.some(l => l.medicationId === m.id && l.timeOfDay === s && l.taken)
  ).length, 0);

  // Find next slot with pending meds
  const ci = currentSlotIndex();
  let nextSlot: Slot | null = null;
  let nextMeds: typeof meds = [];
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    const slot = SLOT_ORDER[(ci + i) % SLOT_ORDER.length];
    const slotMeds = meds.filter(m => m.timesOfDay.includes(slot));
    const pending = slotMeds.filter(m => !logs.some(l => l.medicationId === m.id && l.timeOfDay === slot && (l.taken || l.skipped)));
    if (pending.length > 0) { nextSlot = slot; nextMeds = pending; break; }
  }

  function toggleMed(medId: string, slot: Slot) {
    toggleMedLog(today, medId, slot);
    setTick(t => t + 1);
  }

  if (meds.length === 0) return (
    <div style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>No medications</div>
  );

  const visible = nextMeds.slice(0, MINI_MAX);
  const overflow = nextMeds.length - visible.length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 5 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: fg, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{takenDoses}</span>
        <span style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>/{totalDoses} taken</span>
      </div>
      {nextSlot ? (
        <>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.1em', color: fgMuted, fontFamily:"'JetBrains Mono',monospace", textTransform:'uppercase' }}>
            Next up · {SLOT_LABEL[nextSlot]}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap: 3 }}>
            {visible.map(m => (
              <div key={m.id} onClick={e => { e.stopPropagation(); toggleMed(m.id, nextSlot!); }}
                style={{ display:'flex', alignItems:'center', gap: 6, cursor:'pointer', padding:'1px 0' }}>
                <CheckSq done={false} accent={accent} hov={hov} />
                <span style={{ fontSize: 10.5, color: fg, fontFamily:'Space Grotesk,sans-serif', lineHeight: 1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {m.name}{m.dose ? ` · ${m.dose}` : ''}
                </span>
              </div>
            ))}
            {overflow > 0 && <div style={{ fontSize: 9.5, color: fgDim, fontFamily:"'JetBrains Mono',monospace" }}>+{overflow} more</div>}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 10, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>✓ All done for today</div>
      )}
    </div>
  );
}

function HabMini({ accent, hov }: { accent: string; hov: boolean }) {
  const { fg, fgMuted, fgDim } = C(hov);
  const [tick, setTick] = useState(0);
  const today = localDateStr();
  const habits = getHabits().filter(h => (h.frequency ?? 'daily') === 'daily');
  const todayLogs = getHabitLogsForDate(today);

  const doneCount = habits.filter(h => isHabitDone(h.type, h.target, todayLogs.find(l => l.habitId === h.id)?.value)).length;

  function toggleHabit(h: ReturnType<typeof getHabits>[number]) {
    const log = todayLogs.find(l => l.habitId === h.id);
    const isDone = isHabitDone(h.type, h.target, log?.value);
    if (isDone) {
      setHabitLog(today, h.id, 0);
    } else {
      setHabitLog(today, h.id, h.type === 'boolean' ? 1 : (h.target ?? 1));
    }
    setTick(t => t + 1);
  }

  if (habits.length === 0) return (
    <div style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>No habits yet</div>
  );

  const visible = habits.slice(0, MINI_MAX);
  const overflow = habits.length - visible.length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 5 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: fg, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{doneCount}</span>
        <span style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>/{habits.length} done</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 3 }}>
        {visible.map(h => {
          const log = todayLogs.find(l => l.habitId === h.id);
          const isDone = isHabitDone(h.type, h.target, log?.value);
          return (
            <div key={h.id} onClick={e => { e.stopPropagation(); toggleHabit(h); }}
              style={{ display:'flex', alignItems:'center', gap: 6, cursor:'pointer', padding:'1px 0' }}>
              <CheckSq done={isDone} accent={accent} hov={hov} />
              <span style={{
                fontSize: 10.5, color: isDone ? fgMuted : fg,
                fontFamily:'Space Grotesk,sans-serif', lineHeight: 1.3,
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1,
              }}>{h.icon ? `${h.icon} ` : ''}{h.name}</span>
            </div>
          );
        })}
        {overflow > 0 && <div style={{ fontSize: 9.5, color: fgDim, fontFamily:"'JetBrains Mono',monospace" }}>+{overflow} more</div>}
      </div>
    </div>
  );
}

const TODO_MAX = 5;

function TodoMini({ accent, hov }: { accent: string; hov: boolean }) {
  const [todos, setTodos] = useState<{ id: string; title: string; done: boolean }[]>([]);

  useEffect(() => {
    import('../../api').then(({ api }) =>
      api.get<{ id: string; title: string; done: boolean }[]>('/api/todos')
        .then(setTodos).catch(() => {})
    );
  }, []);

  async function toggle(id: string, done: boolean) {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !done } : t));
    const { api } = await import('../../api');
    api.patch(`/api/todos/${id}`, { done: !done }).catch(() => {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, done } : t));
    });
  }

  const { fg, fgMuted, fgDim } = C(hov);

  const pending = todos.filter(t => !t.done);
  const done    = todos.filter(t => t.done);
  // Pending first, then done
  const ordered = [...pending, ...done];
  const visible = ordered.slice(0, TODO_MAX);
  const overflow = ordered.length - visible.length;

  if (todos.length === 0) return (
    <div style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>No to-dos yet</div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 5 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: fg, fontFamily:"'JetBrains Mono',monospace", lineHeight: 1 }}>{pending.length}</span>
        <span style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>/{todos.length} pending</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap: 3 }}>
      {visible.map(t => (
        <div
          key={t.id}
          onClick={e => { e.stopPropagation(); toggle(t.id, t.done); }}
          style={{ display:'flex', alignItems:'center', gap: 6, cursor:'pointer', borderRadius: 2, padding: '1px 0' }}
        >
          {/* Check icon */}
          <svg width={13} height={13} viewBox="0 0 16 16" fill="none"
            stroke={t.done ? (hov ? 'rgba(0,0,0,0.5)' : accent) : (hov ? 'rgba(0,0,0,0.3)' : '#383838')}
            strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="2" y="2" width="12" height="12" rx="1.5"/>
            {t.done && <polyline points="5,8 7,10 11,6"/>}
          </svg>
          <span style={{
            fontSize: 10.5, lineHeight: 1.3, fontFamily:'Space Grotesk,sans-serif',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            color: t.done ? fgMuted : fg,
            textDecoration: t.done ? 'line-through' : 'none',
            opacity: t.done ? 0.6 : 1,
          }}>{t.title}</span>
        </div>
      ))}
      {overflow > 0 && (
        <div style={{ fontSize: 9.5, color: fgDim, fontFamily:"'JetBrains Mono',monospace", marginTop: 2 }}>
          +{overflow} more
        </div>
      )}
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

  const { fg, fgMuted } = C(hov);

  if (!latest) return (
    <div style={{ fontSize: 11, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>No entries yet</div>
  );

  const d = new Date(latest.date + 'T00:00:00');
  const dateLabel = d.toLocaleDateString('en-US', { month:'short', day:'numeric' });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 7 }}>
      <div style={{ fontSize: 8.5, color: fgMuted, fontFamily:"'JetBrains Mono',monospace" }}>LAST ENTRY · {dateLabel.toUpperCase()}</div>
      <div style={{ fontSize: 11, color: fg, fontFamily:'Space Grotesk,sans-serif', lineHeight: 1.6, flex: 1,
        overflow:'hidden', display:'-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient:'vertical' } as React.CSSProperties}>
        {latest.freeText}
      </div>
      <div style={{ fontSize: 9.5, color: hov ? 'rgba(0,0,0,0.5)' : accent, fontFamily:"'JetBrains Mono',monospace" }}>{thisMonth} entries this month</div>
    </div>
  );
}

function CalMini({ accent }: { accent: string }) {
  const { fgMuted, fgDim } = C(false);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 5 }}>
      <div style={{ fontSize: 8.5, color: fgMuted, fontFamily:"'JetBrains Mono',monospace", marginBottom: 1 }}>COMING SOON</div>
      <div style={{ fontSize: 10.5, color: fgDim, fontFamily:'Space Grotesk,sans-serif', lineHeight: 1.6 }}>
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
    <div style={{ display:'flex', flexDirection:'column', gap: 16, position:'relative' }}>

      {/* Background gradient spill */}
      <style>{`
        @keyframes gradientSpin {
          0%   { transform: translate(-50%,-50%) rotate(-20deg) scale(1);    }
          50%  { transform: translate(-50%,-50%) rotate(20deg)  scale(1.06); }
          100% { transform: translate(-50%,-50%) rotate(-20deg) scale(1);    }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        width: '50vw', height: '50vw',
        borderRadius: '50%',
        background: `conic-gradient(from 0deg,
          rgba(52,211,153,0.22),
          rgba(34,211,238,0.20),
          rgba(96,165,250,0.18),
          rgba(129,140,248,0.18),
          rgba(232,121,249,0.20),
          rgba(192,132,252,0.18),
          rgba(52,211,153,0.22))`,
        filter: 'blur(72px)',
        pointerEvents: 'none',
        zIndex: 0,
        animation: 'gradientSpin 18s ease-in-out infinite',
      }} />

      {/* Header */}
      <div style={{ borderBottom:'1px solid #1e1e1e', paddingBottom: 14, display:'flex', alignItems:'baseline', gap: 12, position:'relative', zIndex: 1 }}>
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
      <div ref={wrapRef} style={{ width:'100%', height: CH * scale, position:'relative', zIndex: 1 }}>
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
