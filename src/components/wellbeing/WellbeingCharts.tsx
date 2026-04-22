import { IconSmile, IconHeartRate, IconBloodPressure, IconOxygen, IconMoon, IconTriangleAlert } from '../Icons';
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
  feel:     <IconSmile size={15} color="var(--success)" />,
  hr:       <IconHeartRate size={15} color="var(--success)" />,
  spo2:     <IconOxygen size={15} color="var(--success)" />,
  sleep:    <IconMoon size={15} color="var(--success)" />,
  bp:       <IconBloodPressure size={15} color="var(--success)" />,
  symptoms: <IconTriangleAlert size={15} color="var(--success)" />,
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
