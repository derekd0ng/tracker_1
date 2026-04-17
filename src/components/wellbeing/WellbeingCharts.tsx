import { useState, useMemo, useRef } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { WellbeingEntry } from '../../types';
import { getChartOrder, saveChartOrder } from '../../storage';

interface SleepPoint {
  date: string;   // YYYY-MM-DD
  value: number;
}

interface Props {
  entries: WellbeingEntry[];
  sleepData?: SleepPoint[];
}

const RANGES = [1, 7, 14, 30] as const;
type Range = (typeof RANGES)[number];

// Palette tuned for the dark navy scheme
const C = {
  feel:    '#10B981',   // emerald green — wellbeing accent
  sleep:   '#A78BFA',   // soft violet
  hr:      '#F87171',   // soft coral-red
  bpSys:   '#60A5FA',   // steel blue
  bpDia:   '#38BDF8',   // sky blue
  spo2:    '#34D399',   // emerald-400
};
const SYMPTOM_COLORS = [
  '#F59E0B', // amber
  '#EF4444', // red
  '#10B981', // emerald
  '#A78BFA', // violet
  '#38BDF8', // sky blue
  '#F97316', // orange
  '#34D399', // teal-green
  '#FB7185', // rose
  '#FBBF24', // yellow
];

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function parseDurMin(dur: string): number | null {
  const s = dur.toLowerCase().trim();
  if (s.includes('all day')) return 24 * 60;
  let total = 0;
  const hMatch = s.match(/(\d+(?:\.\d+)?)\s*h(?:r|our)?s?/);
  const mMatch = s.match(/(\d+(?:\.\d+)?)\s*m(?:in)?s?/);
  if (hMatch) total += parseFloat(hMatch[1]) * 60;
  if (mMatch) total += parseFloat(mMatch[1]);
  return total > 0 ? Math.round(total) : null;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minsToTime(mins: number): string {
  const c = Math.max(0, Math.min(1439, mins));
  return `${String(Math.floor(c / 60)).padStart(2, '0')}:${String(c % 60).padStart(2, '0')}`;
}

const tooltipStyle = {
  fontSize: '0.8rem',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  background: '#263c58',
  color: '#dae2fd',
};

const gridStroke   = 'rgba(255,255,255,0.14)';
const tickStyle    = { fontSize: 10, fill: 'rgba(188,201,205,0.8)' } as const;

function dayStats(vals: (number | undefined)[]) {
  const clean = vals.filter((v): v is number => v != null);
  if (clean.length === 0) return { avg: null, band: null as [number, number] | null };
  const mn = Math.min(...clean);
  const mx = Math.max(...clean);
  const mean = Math.round((clean.reduce((s, v) => s + v, 0) / clean.length) * 10) / 10;
  return { avg: mean, band: [mn, mx] as [number, number] };
}

// Hide range band keys from tooltip
function tooltipFormatter(value: unknown, name: string) {
  if (name.endsWith('Band')) return [null, null] as never;
  return [value, name] as never;
}

function weeklyAvg(values: (number | null | undefined)[]): string | null {
  const clean = values.filter((v): v is number => v != null);
  if (clean.length === 0) return null;
  return (clean.reduce((s, v) => s + v, 0) / clean.length).toFixed(1);
}

type ChartId = 'feel' | 'sleep' | 'hr' | 'bp' | 'spo2' | 'symptoms';
const DEFAULT_ORDER: ChartId[] = ['feel', 'sleep', 'hr', 'bp', 'spo2', 'symptoms'];

const CHART_ICONS: Record<ChartId, JSX.Element> = {
  feel: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.125 6.75C10.4375 6.75 10.7031 6.64062 10.9219 6.42188C11.1406 6.20312 11.25 5.9375 11.25 5.625C11.25 5.3125 11.1406 5.04688 10.9219 4.82812C10.7031 4.60938 10.4375 4.5 10.125 4.5C9.8125 4.5 9.54688 4.60938 9.32812 4.82812C9.10938 5.04688 9 5.3125 9 5.625C9 5.9375 9.10938 6.20312 9.32812 6.42188C9.54688 6.64062 9.8125 6.75 10.125 6.75ZM4.875 6.75C5.1875 6.75 5.45312 6.64062 5.67188 6.42188C5.89062 6.20312 6 5.9375 6 5.625C6 5.3125 5.89062 5.04688 5.67188 4.82812C5.45312 4.60938 5.1875 4.5 4.875 4.5C4.5625 4.5 4.29688 4.60938 4.07812 4.82812C3.85938 5.04688 3.75 5.3125 3.75 5.625C3.75 5.9375 3.85938 6.20312 4.07812 6.42188C4.29688 6.64062 4.5625 6.75 4.875 6.75ZM7.5 11.625C8.35 11.625 9.12188 11.3844 9.81563 10.9031C10.5094 10.4219 11.0125 9.7875 11.325 9H10.0875C9.8125 9.4625 9.44688 9.82813 8.99063 10.0969C8.53438 10.3656 8.0375 10.5 7.5 10.5C6.9625 10.5 6.46563 10.3656 6.00938 10.0969C5.55313 9.82813 5.1875 9.4625 4.9125 9H3.675C3.9875 9.7875 4.49062 10.4219 5.18437 10.9031C5.87812 11.3844 6.65 11.625 7.5 11.625ZM7.5 15C6.4625 15 5.4875 14.8031 4.575 14.4094C3.6625 14.0156 2.86875 13.4812 2.19375 12.8062C1.51875 12.1312 0.984375 11.3375 0.590625 10.425C0.196875 9.5125 0 8.5375 0 7.5C0 6.4625 0.196875 5.4875 0.590625 4.575C0.984375 3.6625 1.51875 2.86875 2.19375 2.19375C2.86875 1.51875 3.6625 0.984375 4.575 0.590625C5.4875 0.196875 6.4625 0 7.5 0C8.5375 0 9.5125 0.196875 10.425 0.590625C11.3375 0.984375 12.1312 1.51875 12.8062 2.19375C13.4812 2.86875 14.0156 3.6625 14.4094 4.575C14.8031 5.4875 15 6.4625 15 7.5C15 8.5375 14.8031 9.5125 14.4094 10.425C14.0156 11.3375 13.4812 12.1312 12.8062 12.8062C12.1312 13.4812 11.3375 14.0156 10.425 14.4094C9.5125 14.8031 8.5375 15 7.5 15ZM7.5 13.5C9.175 13.5 10.5938 12.9188 11.7563 11.7563C12.9188 10.5938 13.5 9.175 13.5 7.5C13.5 5.825 12.9188 4.40625 11.7563 3.24375C10.5938 2.08125 9.175 1.5 7.5 1.5C5.825 1.5 4.40625 2.08125 3.24375 3.24375C2.08125 4.40625 1.5 5.825 1.5 7.5C1.5 9.175 2.08125 10.5938 3.24375 11.7563C4.40625 12.9188 5.825 13.5 7.5 13.5Z" fill="#10B981"/>
    </svg>
  ),
  hr: (
    <svg width="15" height="14" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 13.7625L6.4125 12.7875C5.15 11.65 4.10625 10.6687 3.28125 9.84375C2.45625 9.01875 1.8 8.27812 1.3125 7.62187C0.825 6.96562 0.484375 6.3625 0.290625 5.8125C0.096875 5.2625 0 4.7 0 4.125C0 2.95 0.39375 1.96875 1.18125 1.18125C1.96875 0.39375 2.95 0 4.125 0C4.775 0 5.39375 0.1375 5.98125 0.4125C6.56875 0.6875 7.075 1.075 7.5 1.575C7.925 1.075 8.43125 0.6875 9.01875 0.4125C9.60625 0.1375 10.225 0 10.875 0C12.05 0 13.0313 0.39375 13.8188 1.18125C14.6063 1.96875 15 2.95 15 4.125C15 4.7 14.9031 5.2625 14.7094 5.8125C14.5156 6.3625 14.175 6.96562 13.6875 7.62187C13.2 8.27812 12.5437 9.01875 11.7188 9.84375C10.8938 10.6687 9.85 11.65 8.5875 12.7875L7.5 13.7625ZM7.5 11.7375C8.7 10.6625 9.6875 9.74063 10.4625 8.97188C11.2375 8.20313 11.85 7.53437 12.3 6.96562C12.75 6.39687 13.0625 5.89063 13.2375 5.44688C13.4125 5.00313 13.5 4.5625 13.5 4.125C13.5 3.375 13.25 2.75 12.75 2.25C12.25 1.75 11.625 1.5 10.875 1.5C10.2875 1.5 9.74375 1.66563 9.24375 1.99688C8.74375 2.32813 8.4 2.75 8.2125 3.2625H6.7875C6.6 2.75 6.25625 2.32813 5.75625 1.99688C5.25625 1.66563 4.7125 1.5 4.125 1.5C3.375 1.5 2.75 1.75 2.25 2.25C1.75 2.75 1.5 3.375 1.5 4.125C1.5 4.5625 1.5875 5.00313 1.7625 5.44688C1.9375 5.89063 2.25 6.39687 2.7 6.96562C3.15 7.53437 3.7625 8.20313 4.5375 8.97188C5.3125 9.74063 6.3 10.6625 7.5 11.7375Z" fill="#10B981"/>
    </svg>
  ),
  spo2: (
    <svg width="15" height="13" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.125 12.75C6.5 12.75 5.96875 12.5312 5.53125 12.0938C5.09375 11.6562 4.875 11.125 4.875 10.5H6.375C6.375 10.7125 6.44687 10.8906 6.59062 11.0344C6.73437 11.1781 6.9125 11.25 7.125 11.25C7.3375 11.25 7.51563 11.1781 7.65938 11.0344C7.80313 10.8906 7.875 10.7125 7.875 10.5C7.875 10.2875 7.80313 10.1094 7.65938 9.96562C7.51563 9.82187 7.3375 9.75 7.125 9.75H0V8.25H7.125C7.75 8.25 8.28125 8.46875 8.71875 8.90625C9.15625 9.34375 9.375 9.875 9.375 10.5C9.375 11.125 9.15625 11.6562 8.71875 12.0938C8.28125 12.5312 7.75 12.75 7.125 12.75ZM0 5.25V3.75H10.125C10.45 3.75 10.7187 3.64375 10.9312 3.43125C11.1437 3.21875 11.25 2.95 11.25 2.625C11.25 2.3 11.1437 2.03125 10.9312 1.81875C10.7187 1.60625 10.45 1.5 10.125 1.5C9.8 1.5 9.53125 1.60625 9.31875 1.81875C9.10625 2.03125 9 2.3 9 2.625H7.5C7.5 1.8875 7.75312 1.26562 8.25937 0.759375C8.76562 0.253125 9.3875 0 10.125 0C10.8625 0 11.4844 0.253125 11.9906 0.759375C12.4969 1.26562 12.75 1.8875 12.75 2.625C12.75 3.3625 12.4969 3.98437 11.9906 4.49062C11.4844 4.99687 10.8625 5.25 10.125 5.25H0ZM12.375 11.25V9.75C12.7 9.75 12.9687 9.64375 13.1812 9.43125C13.3937 9.21875 13.5 8.95 13.5 8.625C13.5 8.3 13.3937 8.03125 13.1812 7.81875C12.9687 7.60625 12.7 7.5 12.375 7.5H0V6H12.375C13.1125 6 13.7344 6.25313 14.2406 6.75938C14.7469 7.26563 15 7.8875 15 8.625C15 9.3625 14.7469 9.98438 14.2406 10.4906C13.7344 10.9969 13.1125 11.25 12.375 11.25Z" fill="#10B981"/>
    </svg>
  ),
  sleep: (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.575 15C6.525 15 5.54062 14.8 4.62187 14.4C3.70312 14 2.90312 13.4594 2.22187 12.7781C1.54062 12.0969 1 11.2969 0.6 10.3781C0.2 9.45938 0 8.475 0 7.425C0 5.6 0.58125 3.99062 1.74375 2.59687C2.90625 1.20312 4.3875 0.3375 6.1875 0C5.9625 1.2375 6.03125 2.44687 6.39375 3.62812C6.75625 4.80937 7.38125 5.84375 8.26875 6.73125C9.15625 7.61875 10.1906 8.24375 11.3719 8.60625C12.5531 8.96875 13.7625 9.0375 15 8.8125C14.675 10.6125 13.8125 12.0938 12.4125 13.2563C11.0125 14.4188 9.4 15 7.575 15ZM7.575 13.5C8.675 13.5 9.69375 13.225 10.6313 12.675C11.5688 12.125 12.3062 11.3687 12.8438 10.4062C11.7687 10.3062 10.75 10.0344 9.7875 9.59062C8.825 9.14687 7.9625 8.54375 7.2 7.78125C6.4375 7.01875 5.83125 6.15625 5.38125 5.19375C4.93125 4.23125 4.6625 3.2125 4.575 2.1375C3.6125 2.675 2.85937 3.41562 2.31562 4.35938C1.77187 5.30313 1.5 6.325 1.5 7.425C1.5 9.1125 2.09062 10.5469 3.27187 11.7281C4.45312 12.9094 5.8875 13.5 7.575 13.5Z" fill="#10B981"/>
    </svg>
  ),
  bp: (
    <svg width="15" height="12" viewBox="0 0 15 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.3375 8.625C6.6375 8.925 7.025 9.07188 7.5 9.06563C7.975 9.05938 8.325 8.8875 8.55 8.55L12.75 2.25L6.45 6.45C6.1125 6.675 5.93438 7.01875 5.91563 7.48125C5.89688 7.94375 6.0375 8.325 6.3375 8.625ZM7.5 0C8.2375 0 8.94688 0.103125 9.62813 0.309375C10.3094 0.515625 10.95 0.825 11.55 1.2375L10.125 2.1375C9.7125 1.925 9.28437 1.76562 8.84062 1.65937C8.39687 1.55312 7.95 1.5 7.5 1.5C5.8375 1.5 4.42188 2.08437 3.25312 3.25312C2.08437 4.42188 1.5 5.8375 1.5 7.5C1.5 8.025 1.57188 8.54375 1.71563 9.05625C1.85938 9.56875 2.0625 10.05 2.325 10.5H12.675C12.9625 10.025 13.1719 9.53125 13.3031 9.01875C13.4344 8.50625 13.5 7.975 13.5 7.425C13.5 6.975 13.4469 6.5375 13.3406 6.1125C13.2344 5.6875 13.075 5.275 12.8625 4.875L13.7625 3.45C14.1375 4.0375 14.4344 4.6625 14.6531 5.325C14.8719 5.9875 14.9875 6.675 15 7.3875C15.0125 8.1 14.9313 8.78125 14.7563 9.43125C14.5813 10.0812 14.325 10.7 13.9875 11.2875C13.85 11.5125 13.6625 11.6875 13.425 11.8125C13.1875 11.9375 12.9375 12 12.675 12H2.325C2.0625 12 1.8125 11.9375 1.575 11.8125C1.3375 11.6875 1.15 11.5125 1.0125 11.2875C0.6875 10.725 0.4375 10.1281 0.2625 9.49687C0.0875 8.86562 0 8.2 0 7.5C0 6.4625 0.196875 5.49062 0.590625 4.58437C0.984375 3.67812 1.52188 2.88437 2.20312 2.20312C2.88437 1.52188 3.68125 0.984375 4.59375 0.590625C5.50625 0.196875 6.475 0 7.5 0Z" fill="#10B981"/>
    </svg>
  ),
  symptoms: (
    <svg width="17" height="15" viewBox="0 0 17 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 14.25L8.25 0L16.5 14.25H0ZM2.5875 12.75H13.9125L8.25 3L2.5875 12.75ZM8.25 12C8.4625 12 8.64063 11.9281 8.78438 11.7844C8.92813 11.6406 9 11.4625 9 11.25C9 11.0375 8.92813 10.8594 8.78438 10.7156C8.64063 10.5719 8.4625 10.5 8.25 10.5C8.0375 10.5 7.85937 10.5719 7.71562 10.7156C7.57187 10.8594 7.5 11.0375 7.5 11.25C7.5 11.4625 7.57187 11.6406 7.71562 11.7844C7.85937 11.9281 8.0375 12 8.25 12ZM7.5 9.75H9V6H7.5V9.75Z" fill="#10B981"/>
    </svg>
  ),
};

function ChartHeader({ title, avg, unit = '', handle, icon }: { title: string; avg: string | null; unit?: string; handle?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <p className="chart-title" style={{ marginBottom: 0 }}>{title}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {avg !== null && (
          <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
            avg {avg}{unit}
          </span>
        )}
        {handle}
      </div>
    </div>
  );
}

export default function WellbeingCharts({ entries, sleepData }: Props) {
  const [range, setRange] = useState<Range>(14);
  const [order, setOrder] = useState<ChartId[]>(() => {
    const saved = getChartOrder() as ChartId[] | null;
    if (saved && saved.length === DEFAULT_ORDER.length) return saved;
    return DEFAULT_ORDER;
  });
  const [draggingId, setDraggingId] = useState<ChartId | null>(null);
  const [dragOverId, setDragOverId] = useState<ChartId | null>(null);
  const [hiddenSymptoms, setHiddenSymptoms] = useState<Set<string>>(new Set());

  function toggleSymptom(name: string) {
    setHiddenSymptoms(prev => {
      const s = new Set(prev);
      s.has(name) ? s.delete(name) : s.add(name);
      return s;
    });
  }
  const dragItem = useRef<ChartId | null>(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const cutoffStr = useMemo(() => {
    if (range === 1) return todayStr;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const yyyy = cutoff.getFullYear();
    const mm = String(cutoff.getMonth() + 1).padStart(2, '0');
    const dd = String(cutoff.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [range, todayStr]);

  const filtered = useMemo(
    () => entries.filter(e => e.date >= cutoffStr),
    [entries, cutoffStr],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, WellbeingEntry[]>();
    for (const e of filtered) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [filtered]);

  const dates = useMemo(() => Array.from(grouped.keys()).sort(), [grouped]);

  const vitalData = useMemo(() =>
    dates.map(date => {
      const es = grouped.get(date)!;
      const feel = dayStats(es.map(e => e.overallFeel));
      const hr   = dayStats(es.map(e => e.heartRate));
      const sys  = dayStats(es.map(e => e.systolicBP));
      const dia  = dayStats(es.map(e => e.diastolicBP));
      const spo2 = dayStats(es.map(e => e.spo2));
      return {
        date: fmtDate(date),
        feel: feel.avg, feelBand: feel.band,
        hr:   hr.avg,   hrBand:   hr.band,
        sys:  sys.avg,  sysBand:  sys.band,
        dia:  dia.avg,  diaBand:  dia.band,
        spo2: spo2.avg, spo2Band: spo2.band,
      };
    }),
    [dates, grouped],
  );

  const allSymptoms = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach(e => e.symptoms.forEach(s => set.add(s.name)));
    return Array.from(set);
  }, [filtered]);

  const symptomData = useMemo(() =>
    dates.map(date => {
      const es = grouped.get(date)!;
      const row: Record<string, string | number | [number, number] | null> = { date: fmtDate(date) };
      allSymptoms.forEach(name => {
        // Missing symptom in an entry = 0 (not absent from tracking, just not present)
        const stats = dayStats(es.map(e => e.symptoms.find(s => s.name === name)?.intensity ?? 0));
        row[name] = stats.avg;
        row[`${name}Band`] = stats.band;
      });
      return row;
    }),
    [dates, grouped, allSymptoms],
  );

  const sleepChartData = useMemo(() => {
    if (!sleepData) return [];
    return sleepData
      .filter(d => d.date >= cutoffStr && d.value > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({ date: fmtDate(d.date), sleep: d.value }));
  }, [sleepData, cutoffStr]);

  // ── 1-day view: one point per entry on a time axis ────────────────────────
  const todayEntries = useMemo(
    () => [...filtered].filter(e => e.date === todayStr).sort((a, b) => a.time.localeCompare(b.time)),
    [filtered, todayStr],
  );

  const oneDayVitalData = useMemo(() =>
    todayEntries.map(e => ({
      date: timeToMins(e.time),   // numeric minutes for fixed domain
      feel: e.overallFeel ?? null, feelBand: null,
      hr:   e.heartRate   ?? null, hrBand:   null,
      sys:  e.systolicBP  ?? null, sysBand:  null,
      dia:  e.diastolicBP ?? null, diaBand:  null,
      spo2: e.spo2        ?? null, spo2Band: null,
    })),
    [todayEntries],
  );

  // Sleep has no intraday time — not shown in 1-day view
  const oneDaySleepData: never[] = [];

  const oneDaySymptomNames = useMemo(() => {
    const set = new Set<string>();
    todayEntries.forEach(e => e.symptoms.forEach(s => set.add(s.name)));
    return Array.from(set);
  }, [todayEntries]);

  const oneDaySymptomData = useMemo(() => {
    if (todayEntries.length === 0) return [];

    // Build (start, end, name, intensity) intervals from each entry's symptoms
    const intervals: { name: string; intensity: number; start: number; end: number }[] = [];
    for (const entry of todayEntries) {
      const endMins = timeToMins(entry.time);
      for (const s of entry.symptoms) {
        const durMins = s.duration ? parseDurMin(s.duration) : null;
        const startMins = durMins != null ? Math.max(0, endMins - durMins) : endMins;
        intervals.push({ name: s.name, intensity: s.intensity, start: startMins, end: endMins });
      }
    }

    // Collect all time points: entry times + duration start points + zero-anchors
    const timeSet = new Set<number>();
    for (const entry of todayEntries) timeSet.add(timeToMins(entry.time));
    for (const iv of intervals) {
      if (iv.start < iv.end) {
        timeSet.add(iv.start);
        if (iv.start > 0) timeSet.add(iv.start - 1); // zero just before symptom starts
      }
    }

    return Array.from(timeSet).sort((a, b) => a - b).map(mins => {
      const row: Record<string, string | number | null> = { date: mins };
      for (const name of oneDaySymptomNames) {
        const active = intervals.find(iv => iv.name === name && iv.start <= mins && iv.end >= mins);
        row[name] = active ? active.intensity : 0;
        row[`${name}Band`] = null;
      }
      return row;
    });
  }, [todayEntries, oneDaySymptomNames]);

  const hasData  = dates.length > 0;
  const hasSleep = sleepChartData.length > 0;
  const hasHR    = vitalData.some(d => d.hr   !== null);
  const hasBP    = vitalData.some(d => d.sys  !== null || d.dia  !== null);
  const hasSpO2  = vitalData.some(d => d.spo2 !== null);

  const visible: Record<ChartId, boolean> = range === 1 ? {
    feel:     oneDayVitalData.some(d => d.feel !== null),
    sleep:    oneDaySleepData.length > 0,
    hr:       oneDayVitalData.some(d => d.hr !== null),
    bp:       oneDayVitalData.some(d => d.sys !== null || d.dia !== null),
    spo2:     oneDayVitalData.some(d => d.spo2 !== null),
    symptoms: oneDaySymptomNames.length > 0,
  } : {
    feel:     hasData,
    sleep:    hasSleep,
    hr:       hasHR,
    bp:       hasBP,
    spo2:     hasSpO2,
    symptoms: allSymptoms.length > 0,
  };

  function renderChart(id: ChartId, handle: React.ReactNode) {
    if (!visible[id]) return null;
    const icon = CHART_ICONS[id];
    const chartVitalData   = range === 1 ? oneDayVitalData   : vitalData;
    const chartSleepData   = range === 1 ? oneDaySleepData   : sleepChartData;
    const chartSymptomData = range === 1 ? oneDaySymptomData : symptomData;
    const chartSymptoms    = range === 1 ? oneDaySymptomNames : allSymptoms;
    const xAxis = range === 1
      ? <XAxis dataKey="date" type="number" domain={[0, 1439]} ticks={[0, 360, 720, 1080, 1380]} tickFormatter={minsToTime} tick={tickStyle} />
      : <XAxis dataKey="date" tick={tickStyle} />;
    const tooltipLabel = range === 1 ? (v: number) => minsToTime(v) : undefined;
    switch (id) {
      case 'feel':
        return (
          <>
            <ChartHeader title="Overall Feel (1–10)" avg={weeklyAvg(chartVitalData.map(d => d.feel))} handle={handle} icon={icon} />
            <ResponsiveContainer width="100%" height={170}>
              <ComposedChart data={chartVitalData} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                {xAxis}
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} labelFormatter={tooltipLabel} />
                <Area type="monotone" dataKey="feelBand" fill={C.feel} fillOpacity={0.18} stroke="none" legendType="none" connectNulls />
                <Line type="monotone" dataKey="feel" name="Feel" stroke={C.feel} strokeWidth={2} dot={{ r: 3, fill: C.feel }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        );
      case 'sleep':
        return (
          <>
            <ChartHeader title="Sleep Score (0–100)" avg={weeklyAvg(chartSleepData.map(d => d.sleep))} handle={handle} icon={icon} />
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={chartSleepData} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                {xAxis}
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={tooltipLabel} />
                <Line type="monotone" dataKey="sleep" name="Sleep" stroke={C.sleep} strokeWidth={2} dot={{ r: 3, fill: C.sleep }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        );
      case 'hr':
        return (
          <>
            <ChartHeader title="Heart Rate (bpm)" avg={weeklyAvg(chartVitalData.map(d => d.hr))} unit=" bpm" handle={handle} icon={icon} />
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={chartVitalData} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                {xAxis}
                <YAxis domain={['auto', 'auto']} tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} labelFormatter={tooltipLabel} />
                <Area type="monotone" dataKey="hrBand" fill={C.hr} fillOpacity={0.18} stroke="none" legendType="none" connectNulls />
                <Line type="monotone" dataKey="hr" name="Heart Rate" stroke={C.hr} strokeWidth={2} dot={{ r: 3, fill: C.hr }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        );
      case 'bp':
        return (
          <>
            <ChartHeader title="Blood Pressure (mmHg)"
              avg={(() => {
                const s = weeklyAvg(chartVitalData.map(d => d.sys));
                const d = weeklyAvg(chartVitalData.map(d => d.dia));
                return s && d ? `${s}/${d}` : s ?? d;
              })()}
              unit=" mmHg"
              handle={handle}
              icon={icon}
            />
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={chartVitalData} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                {xAxis}
                <YAxis domain={['auto', 'auto']} tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} labelFormatter={tooltipLabel} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '0.78rem' }} />
                <Area type="monotone" dataKey="sysBand" fill={C.bpSys} fillOpacity={0.18} stroke="none" legendType="none" connectNulls />
                <Area type="monotone" dataKey="diaBand" fill={C.bpDia} fillOpacity={0.18} stroke="none" legendType="none" connectNulls />
                <Line type="monotone" dataKey="sys" name="Systolic" stroke={C.bpSys} strokeWidth={2} dot={{ r: 3, fill: C.bpSys }} connectNulls />
                <Line type="monotone" dataKey="dia" name="Diastolic" stroke={C.bpDia} strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3, fill: C.bpDia }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        );
      case 'spo2':
        return (
          <>
            <ChartHeader title="SpO₂ (%)" avg={weeklyAvg(chartVitalData.map(d => d.spo2))} unit="%" handle={handle} icon={icon} />
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={chartVitalData} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                {xAxis}
                <YAxis domain={[88, 100]} tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} labelFormatter={tooltipLabel} />
                <Area type="monotone" dataKey="spo2Band" fill={C.spo2} fillOpacity={0.32} stroke="none" legendType="none" connectNulls />
                <Line type="monotone" dataKey="spo2" name="SpO₂" stroke={C.spo2} strokeWidth={2} dot={{ r: 3, fill: C.spo2 }} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        );
      case 'symptoms':
        return (
          <>
            <ChartHeader title="Symptom Intensity (1–10)"
              avg={weeklyAvg(chartSymptomData.flatMap(d =>
                chartSymptoms.map(n => d[n] as number | null)
              ))}
              handle={handle}
              icon={icon}
            />
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={chartSymptomData} margin={{ top: 4, right: 12, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                {xAxis}
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={tickStyle} />
                <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} labelFormatter={tooltipLabel} />
                <Legend
                  iconSize={8}
                  wrapperStyle={{ fontSize: '0.78rem' }}
                  onClick={(e: any) => toggleSymptom(e.value)}
                  formatter={(value: string) => (
                    <span style={{ opacity: hiddenSymptoms.has(value) ? 0.35 : 1, cursor: 'pointer', textDecoration: hiddenSymptoms.has(value) ? 'line-through' : 'none' }}>
                      {value}
                    </span>
                  )}
                />
                {chartSymptoms.map((name, i) => {
                  const color = SYMPTOM_COLORS[i % SYMPTOM_COLORS.length];
                  const hidden = hiddenSymptoms.has(name);
                  return [
                    <Area key={`${name}Band`} type="monotone" dataKey={`${name}Band`} fill={color} fillOpacity={0.35} stroke="none" legendType="none" connectNulls hide={hidden} />,
                    <Line key={name} type="monotone" dataKey={name} stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls hide={hidden} />,
                  ];
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </>
        );
    }
  }

  function handleDragStart(id: ChartId) {
    dragItem.current = id;
    setDraggingId(id);
  }

  function handleDragEnter(id: ChartId) {
    if (!dragItem.current || dragItem.current === id) return;
    setDragOverId(id);
    const from = order.indexOf(dragItem.current);
    const to   = order.indexOf(id);
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, dragItem.current);
    setOrder(next);
    saveChartOrder(next);
  }

  function handleDragEnd() {
    dragItem.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }

  const anyVisible = order.some(id => visible[id]);

  return (
    <div className="charts-section">
      <div className="flex-between">
        <p className="section-title" style={{ marginBottom: 0 }}>Trends</p>
        <div className="range-tabs">
          {RANGES.map(r => (
            <button key={r} className={`range-tab${range === r ? ' active' : ''}`} onClick={() => setRange(r)}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {!anyVisible ? (
        <p className="chart-empty">
          {range === 1 ? 'No entries today. Log an entry to see today\'s data.' : `No entries in the last ${range} days. Log an entry to start seeing trends.`}
        </p>
      ) : (
        <div className="chart-grid">
          {order.map(id => {
            if (!visible[id]) return null;
            const isDragging = draggingId === id;
            const isOver     = dragOverId === id;
            return (
              <div
                key={id}
                className="chart-card"
                draggable
                onDragStart={() => handleDragStart(id)}
                onDragEnter={() => handleDragEnter(id)}
                onDragOver={e => e.preventDefault()}
                onDragEnd={handleDragEnd}
                style={{
                  opacity:   isDragging ? 0.4 : 1,
                  outline:   isOver ? '2px solid var(--accent)' : undefined,
                  cursor:    'grab',
                  transition: 'opacity 0.15s, outline 0.1s',
                }}
              >
                {renderChart(id, <span className="chart-drag-handle" title="Drag to reorder">⠿</span>)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
