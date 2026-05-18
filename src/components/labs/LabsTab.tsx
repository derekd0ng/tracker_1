import { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts';
import { api } from '../../api';
import type { LabResult } from '../../types';
import { IconLabs, IconPlus, IconX, IconPencil } from '../Icons';
import type { LabType } from '../../types';

const ACCENT = '#fbbf24';

const LAB_TYPES: LabType[] = ['blood', 'urine', 'stool', 'other'];
const TYPE_COLOR: Record<LabType, string> = {
  blood: '#f87171',
  urine: '#60a5fa',
  stool: '#a78bfa',
  other: '#6b7280',
};
const TYPE_LABEL: Record<LabType, string> = {
  blood: 'Blood',
  urine: 'Urine',
  stool: 'Stool',
  other: 'Other',
};

function TypeBadge({ type }: { type: string }) {
  const t = (LAB_TYPES.includes(type as LabType) ? type : 'other') as LabType;
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 3,
      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      background: TYPE_COLOR[t] + '22', color: TYPE_COLOR[t], border: `1px solid ${TYPE_COLOR[t]}44`,
    }}>
      {TYPE_LABEL[t]}
    </span>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────

type Status = 'normal' | 'high' | 'low' | 'unknown';

function getStatus(value: number | null, refLow: number | null, refHigh: number | null): Status {
  if (value === null) return 'unknown';
  if (refHigh !== null && value > refHigh) return 'high';
  if (refLow  !== null && value < refLow)  return 'low';
  if (refLow !== null || refHigh !== null)  return 'normal';
  return 'unknown';
}

const STATUS_COLOR: Record<Status, string> = {
  normal:  '#34d399',
  high:    '#f87171',
  low:     '#fbbf24',
  unknown: '#555',
};
const STATUS_LABEL: Record<Status, string> = {
  normal:  'Normal',
  high:    'High',
  low:     'Low',
  unknown: '—',
};

// ── Date formatter for charts ─────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtRefRange(r: LabResult): string {
  if (r.refText) return r.refText;
  if (r.refLow !== null && r.refHigh !== null) return `${r.refLow}–${r.refHigh}`;
  if (r.refLow  !== null) return `>${r.refLow}`;
  if (r.refHigh !== null) return `<${r.refHigh}`;
  return '—';
}

// ── ParsedRow — editable row in preview modal ─────────────────────────────────

interface ParsedRow {
  metricName: string;
  date: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
  refText: string;
  labType: string;
}

function parseToRow(raw: any): ParsedRow {
  return {
    metricName: raw.metric_name ?? '',
    date:       raw.date        ?? '',
    value:      raw.value    !== null && raw.value    !== undefined ? String(raw.value)    : '',
    unit:       raw.unit        ?? '',
    refLow:     raw.ref_low  !== null && raw.ref_low  !== undefined ? String(raw.ref_low)  : '',
    refHigh:    raw.ref_high !== null && raw.ref_high !== undefined ? String(raw.ref_high) : '',
    refText:    raw.ref_text    ?? '',
    labType:    LAB_TYPES.includes(raw.lab_type) ? raw.lab_type : 'other',
  };
}

function rowToPayload(row: ParsedRow) {
  return {
    metricName: row.metricName,
    date:       row.date,
    value:      row.value   !== '' ? parseFloat(row.value)   : null,
    unit:       row.unit    || null,
    refLow:     row.refLow  !== '' ? parseFloat(row.refLow)  : null,
    refHigh:    row.refHigh !== '' ? parseFloat(row.refHigh) : null,
    refText:    row.refText || null,
    labType:    row.labType || 'other',
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#121212',
  border: `1px solid #1e1e1e`,
  borderTop: `3px solid ${ACCENT}`,
  borderRadius: 6,
  padding: '20px 24px',
};

const inputStyle: React.CSSProperties = {
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 4,
  color: '#e2e2e2',
  fontSize: 12,
  padding: '3px 6px',
  fontFamily: "'Space Grotesk', sans-serif",
  width: '100%',
  boxSizing: 'border-box',
};

const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#555',
  paddingBottom: 8,
  paddingRight: 12,
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  paddingTop: 8,
  paddingBottom: 8,
  paddingRight: 12,
  fontSize: 13,
  color: '#e2e2e2',
  verticalAlign: 'middle',
  borderTop: '1px solid #1e1e1e',
};

// ── Merge modal ───────────────────────────────────────────────────────────────

interface MergeGroup {
  names: string[];
  canonical: string;
  enabled: boolean;
  counts: Record<string, number>;
  labType: string;
}

function MergeModal({
  groups: initial,
  onApply,
  onClose,
}: {
  groups: MergeGroup[];
  onApply: (groups: MergeGroup[]) => Promise<void>;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<MergeGroup[]>(initial);
  const [applying, setApplying] = useState(false);

  function toggle(i: number) {
    setGroups(g => g.map((gr, idx) => idx === i ? { ...gr, enabled: !gr.enabled } : gr));
  }
  function setCanonical(i: number, val: string) {
    setGroups(g => g.map((gr, idx) => idx === i ? { ...gr, canonical: val } : gr));
  }

  const activeCount = groups.filter(g => g.enabled).length;

  async function handleApply() {
    setApplying(true);
    await onApply(groups.filter(g => g.enabled));
    setApplying(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8,
        width: '100%', maxWidth: 640, padding: '28px 28px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: ACCENT, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
            Merge similar metrics
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4 }}>
            <IconX size={18} />
          </button>
        </div>
        <p style={{ margin: '0 0 20px', fontSize: 12, color: '#666' }}>
          {groups.length} group{groups.length !== 1 ? 's' : ''} found within the same lab type. Toggle off any you don't want to merge, then set the canonical name.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {groups.map((g, i) => (
            <div key={i} style={{
              background: g.enabled ? '#131313' : '#0c0c0c',
              border: `1px solid ${g.enabled ? '#2a2a2a' : '#1a1a1a'}`,
              borderRadius: 6, padding: '14px 16px',
              opacity: g.enabled ? 1 : 0.5,
              transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* Toggle */}
                <button
                  onClick={() => toggle(i)}
                  style={{
                    marginTop: 2, flexShrink: 0,
                    width: 18, height: 18, borderRadius: 3,
                    background: g.enabled ? ACCENT : 'transparent',
                    border: `1.5px solid ${g.enabled ? ACCENT : '#444'}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {g.enabled && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <polyline points="2,5 4,7 8,3" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Variant chips + type badge */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
                    <TypeBadge type={g.labType} />
                    {g.names.map(n => (
                      <span key={n} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 8px', borderRadius: 3,
                        background: '#1e1e1e', border: '1px solid #2a2a2a',
                        fontSize: 12, color: '#ccc',
                      }}>
                        {n}
                        <span style={{ fontSize: 10, color: '#555' }}>×{g.counts[n] ?? 0}</span>
                      </span>
                    ))}
                  </div>

                  {/* Canonical name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#555', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      Merge as
                    </span>
                    <input
                      value={g.canonical}
                      onChange={e => setCanonical(i, e.target.value)}
                      disabled={!g.enabled}
                      style={{
                        ...inputStyle,
                        maxWidth: 260,
                        color: ACCENT,
                        borderColor: g.enabled ? '#333' : '#1e1e1e',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', background: 'transparent', border: '1px solid #2a2a2a',
            color: '#999', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={applying || activeCount === 0}
            style={{
              padding: '8px 20px', background: ACCENT, border: 'none',
              color: '#080808', borderRadius: 4,
              cursor: applying || activeCount === 0 ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
              opacity: activeCount === 0 ? 0.4 : 1,
            }}
          >
            {applying ? 'Applying…' : `Apply ${activeCount} merge${activeCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  rows, onSave, onClose,
}: {
  rows: ParsedRow[];
  onSave: (rows: ParsedRow[]) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<ParsedRow[]>(rows);
  const [saving, setSaving] = useState(false);

  function update(i: number, field: keyof ParsedRow, val: string) {
    setData(d => d.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  }

  function remove(i: number) {
    setData(d => d.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    await onSave(data);
    setSaving(false);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '40px 16px', overflowY: 'auto',
    }}>
      <div style={{
        background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8,
        width: '100%', maxWidth: 900, padding: '28px 28px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, color: ACCENT, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>
              Review parsed results
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666' }}>
              {data.length} result{data.length !== 1 ? 's' : ''} found — edit before saving
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4 }}>
            <IconX size={18} />
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Metric', 'Date', 'Value', 'Unit', 'Ref Low', 'Ref High', 'Ref Text', 'Type', ''].map(h => (
                  <th key={h} style={{ ...th, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  {(['metricName','date','value','unit','refLow','refHigh','refText'] as (keyof ParsedRow)[]).map(f => (
                    <td key={f} style={{ paddingRight: 6, paddingTop: 4, paddingBottom: 4, borderTop: '1px solid #1a1a1a' }}>
                      <input
                        value={row[f]}
                        onChange={e => update(i, f, e.target.value)}
                        style={{ ...inputStyle, minWidth: f === 'metricName' ? 130 : f === 'refText' ? 90 : 70 }}
                      />
                    </td>
                  ))}
                  <td style={{ paddingRight: 6, paddingTop: 4, paddingBottom: 4, borderTop: '1px solid #1a1a1a' }}>
                    <select
                      value={row.labType}
                      onChange={e => update(i, 'labType', e.target.value)}
                      style={{ ...inputStyle, minWidth: 76, color: TYPE_COLOR[(row.labType as LabType) ?? 'other'] }}
                    >
                      {LAB_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                  </td>
                  <td style={{ paddingTop: 4, paddingBottom: 4, borderTop: '1px solid #1a1a1a' }}>
                    <button
                      onClick={() => remove(i)}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4 }}
                      title="Remove row"
                    >
                      <IconX size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.length === 0 && (
          <p style={{ textAlign: 'center', color: '#555', fontSize: 13, padding: '20px 0' }}>
            All rows removed.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 18px', background: 'transparent', border: '1px solid #2a2a2a',
            color: '#999', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
          }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || data.length === 0}
            style={{
              padding: '8px 20px', background: ACCENT, border: 'none',
              color: '#080808', borderRadius: 4, cursor: saving ? 'wait' : 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
              opacity: data.length === 0 ? 0.4 : 1,
            }}
          >
            {saving ? 'Saving…' : `Save ${data.length} result${data.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Metric chart ──────────────────────────────────────────────────────────────

function MetricChart({ metricName, labType, results }: { metricName: string; labType: string; results: LabResult[] }) {
  const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
  const unit     = sorted.find(r => r.unit)?.unit ?? '';
  const refLow   = sorted.find(r => r.refLow  !== null)?.refLow  ?? null;
  const refHigh  = sorted.find(r => r.refHigh !== null)?.refHigh ?? null;

  const values = sorted.map(r => r.value).filter((v): v is number => v !== null);
  const minVal  = values.length ? Math.min(...values) : 0;
  const maxVal  = values.length ? Math.max(...values) : 1;
  const margin  = (maxVal - minVal) * 0.3 || 1;

  const yMin = Math.min(minVal - margin, refLow  ?? minVal - margin);
  const yMax = Math.max(maxVal + margin, refHigh ?? maxVal + margin);

  const data = sorted.map(r => ({ date: fmtDate(r.date), value: r.value, rawDate: r.date }));

  const dotColor = (val: number | null) => STATUS_COLOR[getStatus(val, refLow, refHigh)];

  return (
    <div style={{ ...card, minWidth: 0 }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, fontFamily: "'Space Grotesk', sans-serif" }}>
          {metricName}
        </span>
        <TypeBadge type={labType} />
        {unit && <span style={{ fontSize: 11, color: '#555' }}>{unit}</span>}
        {(refLow !== null || refHigh !== null) && (
          <span style={{ fontSize: 11, color: '#666', marginLeft: 10 }}>
            ref: {refLow !== null ? refLow : ''}
            {refLow !== null && refHigh !== null ? '–' : ''}
            {refHigh !== null ? refHigh : ''}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#1e1e1e" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: '#555', fontSize: 10 }}
            axisLine={false} tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 4, fontSize: 12 }}
            labelStyle={{ color: '#999' }}
            itemStyle={{ color: ACCENT }}
            formatter={(val: any) => [`${val}${unit ? ' ' + unit : ''}`, metricName]}
          />
          {/* Reference range shaded band */}
          {refLow !== null && refHigh !== null && (
            <ReferenceArea y1={refLow} y2={refHigh} fill="#34d39918" />
          )}
          {refLow  !== null && refHigh === null && (
            <ReferenceLine y={refLow}  stroke="#34d39955" strokeDasharray="4 3" />
          )}
          {refHigh !== null && refLow  === null && (
            <ReferenceLine y={refHigh} stroke="#34d39955" strokeDasharray="4 3" />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={ACCENT}
            strokeWidth={2}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              const color = dotColor(payload.value);
              return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke="#0d0d0d" strokeWidth={2} />;
            }}
            activeDot={{ r: 5, fill: ACCENT }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LabsTab() {
  const [results, setResults]         = useState<LabResult[]>([]);
  const [loading, setLoading]         = useState(true);
  const [parsing, setParsing]         = useState(false);
  const [parseProgress, setParseProgress] = useState('');
  const [parseError, setParseError]   = useState<string | null>(null);
  const [preview, setPreview]         = useState<ParsedRow[] | null>(null);
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[] | null>(null);
  const [merging, setMerging]         = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editDraft, setEditDraft]       = useState<ParsedRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<LabResult[]>('/api/labs')
      .then(data => { setResults(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // ── PDF import ───────────────────────────────────────────────────────────────

  async function parseSingleFile(file: File, apiKey: string): Promise<ParsedRow[]> {
    const buf    = await file.arrayBuffer();
    const bytes  = new Uint8Array(buf);
    let binary   = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: b64 },
            },
            {
              type: 'text',
              text: `Extract all laboratory test results from this document. Return ONLY a valid JSON array — no markdown, no explanation.

Each element must have exactly these fields:
- "metric_name": string — the test/analyte name in English (e.g. "Hemoglobin", "Glucose"). Always translate to English regardless of the document language.
- "date": string — test date as YYYY-MM-DD (use collection date; fall back to report date)
- "value": number or null — the numeric result
- "unit": string or null — unit such as "g/dL", "mmol/L", "×10⁹/L"
- "ref_low": number or null — lower bound of the normal reference range
- "ref_high": number or null — upper bound of the normal reference range
- "ref_text": string or null — reference range exactly as printed (e.g. "3.9–6.1", "<5.0")
- "lab_type": one of "blood", "urine", "stool", or "other" — infer from the document title, section headers, or the metric itself (e.g. Hemoglobin → blood, Creatinine in a urine panel → urine)

Rules:
• "<X" → ref_high=X, ref_low=null
• ">X" → ref_low=X, ref_high=null
• "X–Y" → ref_low=X, ref_high=Y
• Include every individual test metric; skip summary or section headers
• Return [] if no results found`,
            },
          ],
        }],
      }),
    });

    const json = await res.json();
    if (json.error) throw new Error(`${file.name}: ${json.error.message}`);

    const text: string = json.content?.[0]?.text ?? '';
    let jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      const start = text.indexOf('[');
      if (start !== -1) {
        const partial = text.slice(start);
        const lastComma = partial.lastIndexOf('},');
        const salvaged = lastComma !== -1 ? partial.slice(0, lastComma + 1) + ']' : null;
        if (salvaged) jsonMatch = [salvaged];
      }
    }
    if (!jsonMatch) throw new Error(`${file.name}: could not extract results`);

    const parsed: any[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) throw new Error(`${file.name}: unexpected response format`);
    return parsed.map(parseToRow);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) {
      setParseError('VITE_ANTHROPIC_API_KEY not set — add it to .env.local');
      return;
    }

    setParsing(true);
    setParseError(null);
    setParseProgress(files.length > 1 ? `Parsing 1 of ${files.length}…` : 'Parsing…');

    const allRows: ParsedRow[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      if (files.length > 1) setParseProgress(`Parsing ${i + 1} of ${files.length}…`);
      try {
        const rows = await parseSingleFile(files[i], apiKey);
        allRows.push(...rows);
      } catch (err: any) {
        errors.push(err.message ?? files[i].name);
      }
    }

    setParsing(false);
    setParseProgress('');

    if (allRows.length === 0) {
      setParseError(errors.length ? errors.join(' · ') : 'No lab results found in the selected files.');
    } else {
      if (errors.length) setParseError(`Partial import — failed: ${errors.join(', ')}`);
      setPreview(allRows);
    }
  }

  // ── Save confirmed results ───────────────────────────────────────────────────

  async function handleSave(rows: ParsedRow[]) {
    const payload = rows.map(rowToPayload).filter(r => r.metricName && r.date);
    const saved = await api.post<LabResult[]>('/api/labs', payload);
    setResults(prev => [...saved, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    setPreview(null);
  }

  async function handleDelete(id: string) {
    await api.delete(`/api/labs/${id}`);
    setResults(prev => prev.filter(r => r.id !== id));
  }

  function handleEditStart(r: LabResult) {
    setEditingId(r.id);
    setEditDraft({
      metricName: r.metricName,
      date:       r.date,
      value:      r.value    !== null ? String(r.value)    : '',
      unit:       r.unit     ?? '',
      refLow:     r.refLow   !== null ? String(r.refLow)   : '',
      refHigh:    r.refHigh  !== null ? String(r.refHigh)  : '',
      refText:    r.refText  ?? '',
      labType:    r.labType,
    });
  }

  function patchDraft(field: keyof ParsedRow, val: string) {
    setEditDraft(d => d ? { ...d, [field]: val } : d);
  }

  async function handleEditSave(id: string) {
    if (!editDraft) return;
    const payload = rowToPayload(editDraft);
    const updated = await api.patch<LabResult>(`/api/labs/${id}`, payload);
    setResults(prev => prev.map(r => r.id === id ? updated : r));
    setEditingId(null);
    setEditDraft(null);
  }

  // ── Merge similar metrics ─────────────────────────────────────────────────────

  async function handleMergeOpen() {
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) { setParseError('VITE_ANTHROPIC_API_KEY not set'); return; }

    // Unique (name, type) pairs — metrics of different lab types are never merged
    const seen = new Set<string>();
    const uniquePairs: { name: string; type: string }[] = [];
    results.forEach(r => {
      const key = `${r.metricName}||${r.labType}`;
      if (!seen.has(key)) { seen.add(key); uniquePairs.push({ name: r.metricName, type: r.labType }); }
    });
    if (uniquePairs.length < 2) { setParseError('Not enough distinct metrics to merge.'); return; }

    setMerging(true);
    setParseError(null);
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `You are a medical laboratory expert. Given this list of lab test metrics (each with a name and lab type), identify groups of entries that refer to the SAME measurement, have the SAME lab_type, but differ in spelling, capitalisation, abbreviation, or are medical synonyms.

IMPORTANT: Never group metrics that have different lab_type values — "Glucose" in blood and "Glucose" in urine are separate measurements.

Examples of what to group (same type only):
- "absolute" and "Absolute" with type "blood" (capitalisation)
- "WBC", "White Blood Cells", "Leukocytes" all with type "blood"
- "Hgb" and "Hemoglobin" with type "blood"
- "Relative %", "Relative", "Percentage" with the same type

Return ONLY a valid JSON array — no markdown, no explanation. Each element:
- "names": array of the variant metric names (strings only, not objects)
- "canonical": the best standard English medical name
- "lab_type": the shared lab type of this group

Only include groups with 2+ names. Return [] if no duplicates found.

Metrics (name + type):
${JSON.stringify(uniquePairs)}`,
          }],
        }),
      });

      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      const text: string = json.content?.[0]?.text ?? '[]';
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('Unexpected response from AI');
      const raw: { names: string[]; canonical: string; lab_type: string }[] = JSON.parse(match[0]);

      if (raw.length === 0) {
        setParseError('No similar metrics found — all names look distinct.');
        return;
      }

      // Count occurrences per (name, type) key
      const countMap: Record<string, number> = {};
      results.forEach(r => {
        const key = `${r.metricName}||${r.labType}`;
        countMap[key] = (countMap[key] ?? 0) + 1;
      });

      // Auto-pick canonical = variant with highest count; fall back to AI suggestion
      const groups: MergeGroup[] = raw.map(g => {
        const labType = g.lab_type ?? 'other';
        const sortedByCount = [...g.names].sort(
          (a, b) => (countMap[`${b}||${labType}`] ?? 0) - (countMap[`${a}||${labType}`] ?? 0)
        );
        return {
          names: g.names,
          canonical: sortedByCount[0] ?? g.canonical,
          enabled: true,
          labType,
          counts: Object.fromEntries(g.names.map(n => [n, countMap[`${n}||${labType}`] ?? 0])),
        };
      });

      setMergeGroups(groups);
    } catch (err: any) {
      setParseError(err.message ?? 'Failed to find similar metrics');
    } finally {
      setMerging(false);
    }
  }

  async function handleMergeApply(groups: MergeGroup[]) {
    for (const g of groups) {
      const others = g.names.filter(n => n !== g.canonical);
      if (others.length === 0) continue;
      await api.post('/api/labs/merge', { from: g.names, to: g.canonical, labType: g.labType });
    }
    // Refresh the full list so charts rebuild correctly
    const updated = await api.get<LabResult[]>('/api/labs');
    setResults(updated);
    setMergeGroups(null);
  }

  // ── Group by metric for charts ────────────────────────────────────────────────

  const byMetric = results.reduce<Record<string, LabResult[]>>((acc, r) => {
    const key = `${r.metricName}||${r.labType}`;
    (acc[key] ??= []).push(r);
    return acc;
  }, {});

  const chartMetrics = Object.entries(byMetric)
    .filter(([, list]) => list.length >= 2)
    .sort(([a], [b]) => a.localeCompare(b));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 0 60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconLabs size={20} color={ACCENT} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: ACCENT, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>
            Lab Results
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {parseError && (
            <span style={{ fontSize: 12, color: '#f87171', maxWidth: 280 }}>{parseError}</span>
          )}
          {results.length > 0 && (
            confirmClear ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#f87171' }}>Clear all?</span>
                <button onClick={async () => { await api.delete('/api/labs'); setResults([]); setConfirmClear(false); }} style={{ padding: '4px 10px', background: '#f87171', border: 'none', borderRadius: 3, color: '#080808', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk',sans-serif" }}>Yes</button>
                <button onClick={() => setConfirmClear(false)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #333', borderRadius: 3, color: '#999', fontSize: 12, cursor: 'pointer', fontFamily: "'Space Grotesk',sans-serif" }}>No</button>
              </span>
            ) : (
              <button onClick={() => setConfirmClear(true)} style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #f8717144', color: '#f87171', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif" }}>
                Clear All
              </button>
            )
          )}
          {results.length > 0 && (
            <button
              onClick={handleMergeOpen}
              disabled={merging}
              style={{
                padding: '8px 14px', background: 'transparent',
                border: `1px solid ${ACCENT}44`, color: ACCENT,
                borderRadius: 4, cursor: merging ? 'wait' : 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {merging ? 'Scanning…' : 'Merge Similar'}
            </button>
          )}
          <button
            onClick={() => { setParseError(null); fileRef.current?.click(); }}
            disabled={parsing}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', background: ACCENT, border: 'none',
              color: '#080808', borderRadius: 4, cursor: parsing ? 'wait' : 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            <IconPlus size={14} color="#080808" />
            {parsing ? parseProgress || 'Parsing…' : 'Import PDFs'}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: 'none' }} onChange={handleFile} />
        </div>
      </div>

      {/* Results table */}
      {loading ? (
        <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>Loading…</div>
      ) : results.length === 0 ? (
        <div style={{
          ...card, textAlign: 'center', padding: '48px 24px',
          border: '1px dashed #2a2a2a', borderTop: `3px solid ${ACCENT}`,
        }}>
          <IconLabs size={32} color="#333" />
          <p style={{ margin: '16px 0 6px', fontSize: 14, color: '#555' }}>No lab results yet</p>
          <p style={{ margin: 0, fontSize: 12, color: '#3a3a3a' }}>
            Import a PDF lab report — Claude will extract the metrics automatically
          </p>
        </div>
      ) : (
        <div style={card}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Metric', 'Type', 'Date', 'Result', 'Unit', 'Reference', 'Status', ''].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  const editing = editingId === r.id && editDraft;
                  const status  = getStatus(r.value, r.refLow, r.refHigh);
                  const cellIn  = (field: keyof ParsedRow, w = 90) => (
                    <input
                      value={editDraft?.[field] ?? ''}
                      onChange={e => patchDraft(field, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditSave(r.id); if (e.key === 'Escape') { setEditingId(null); setEditDraft(null); } }}
                      style={{ ...inputStyle, minWidth: w }}
                    />
                  );
                  return (
                    <tr key={r.id} style={{ background: editing ? '#141414' : undefined }}>
                      <td style={td}>
                        {editing
                          ? cellIn('metricName', 140)
                          : <span style={{ fontWeight: 600, color: '#e2e2e2' }}>{r.metricName}</span>}
                      </td>
                      <td style={td}>
                        {editing ? (
                          <select
                            value={editDraft.labType}
                            onChange={e => patchDraft('labType', e.target.value)}
                            style={{ ...inputStyle, minWidth: 76, color: TYPE_COLOR[(editDraft.labType as LabType) ?? 'other'] }}
                          >
                            {LAB_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                          </select>
                        ) : <TypeBadge type={r.labType} />}
                      </td>
                      <td style={td}>
                        {editing ? cellIn('date', 100) : <span style={{ color: '#888' }}>{fmtDate(r.date)}</span>}
                      </td>
                      <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {editing ? cellIn('value', 70) : (r.value !== null ? r.value : '—')}
                      </td>
                      <td style={td}>
                        {editing ? cellIn('unit', 70) : (r.unit && <span style={{ color: '#666', fontSize: 12 }}>{r.unit}</span>)}
                      </td>
                      <td style={{ ...td, color: '#777', fontSize: 12 }}>
                        {editing
                          ? <div style={{ display: 'flex', gap: 4 }}>{cellIn('refLow', 54)}<span style={{ color: '#555', alignSelf: 'center' }}>–</span>{cellIn('refHigh', 54)}</div>
                          : fmtRefRange(r)}
                      </td>
                      <td style={td}>
                        {!editing && status !== 'unknown' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: STATUS_COLOR[status] }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[status], display: 'inline-block' }} />
                            {STATUS_LABEL[status]}
                          </span>
                        )}
                      </td>
                      <td style={{ ...td, paddingRight: 0, whiteSpace: 'nowrap' }}>
                        {editing ? (
                          <>
                            <button onClick={() => handleEditSave(r.id)} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', padding: '2px 4px' }} title="Save"><svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,8 6,11 13,4"/></svg></button>
                            <button onClick={() => { setEditingId(null); setEditDraft(null); }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '2px 4px' }} title="Cancel"><IconX size={13} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEditStart(r)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '2px 4px' }} onMouseEnter={e => (e.currentTarget.style.color = ACCENT)} onMouseLeave={e => (e.currentTarget.style.color = '#444')} title="Edit"><IconPencil size={13} /></button>
                            <button onClick={() => handleDelete(r.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '2px 4px' }} onMouseEnter={e => (e.currentTarget.style.color = '#f87171')} onMouseLeave={e => (e.currentTarget.style.color = '#444')} title="Delete"><IconX size={13} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trend charts */}
      {chartMetrics.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555' }}>
            Trends
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16,
          }}>
            {chartMetrics.map(([key, list]) => {
              const [metricName, labType] = key.split('||');
              return <MetricChart key={key} metricName={metricName} labType={labType} results={list} />;
            })}
          </div>
        </div>
      )}

      {/* Merge modal */}
      {mergeGroups && (
        <MergeModal
          groups={mergeGroups}
          onApply={handleMergeApply}
          onClose={() => setMergeGroups(null)}
        />
      )}

      {/* Preview modal */}
      {preview && (
        <PreviewModal
          rows={preview}
          onSave={handleSave}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
