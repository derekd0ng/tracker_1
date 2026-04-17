import { useState, useRef, useEffect } from 'react';
import type { WellbeingEntry, SymptomEntry } from '../../types';
import { SYMPTOM_OPTIONS } from '../../types';
import { saveWellbeingEntry, setHabitLog } from '../../storage';

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function HeadachePicker({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(l => l !== id) : [...selected, id]);
  }

  // Returns JSX for a clickable zone ellipse + optional label
  function zone(id: string, cx: number, cy: number, rx: number, ry: number, label?: string, ly?: number, fs = 7.5) {
    const active = selected.includes(id);
    return (
      <g key={id} onClick={() => toggle(id)} style={{ cursor: 'pointer' }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
          fill={active ? 'rgba(255,180,171,0.28)' : 'rgba(255,255,255,0.03)'}
          stroke={active ? '#FFB4AB' : 'rgba(255,255,255,0.1)'}
          strokeWidth={1}
        />
        {label && (
          <text x={cx} y={(ly ?? cy) + 4} textAnchor="middle" fontSize={fs}
            fill={active ? '#FFB4AB' : 'rgba(255,255,255,0.35)'}
            style={{ pointerEvents: 'none', userSelect: 'none' as const }}
          >{label}</text>
        )}
      </g>
    );
  }

  const dec = { pointerEvents: 'none' as const }; // shorthand for decorative elements

  return (
    <div className="headache-picker">
      <span className="headache-picker-hint">Tap to mark affected areas</span>
      <div className="headache-projections">

        {/* ── Front view ── */}
        <div className="headache-view">
          <span className="headache-view-label">Front</span>
          <svg viewBox="0 0 140 175" className="headache-svg">
            {/* Head + ears */}
            <ellipse cx="70" cy="90" rx="58" ry="74" fill="rgba(8,15,34,0.55)" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
            <ellipse cx="11" cy="90" rx="11" ry="20"  fill="rgba(8,15,34,0.55)" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" />
            <ellipse cx="129" cy="90" rx="11" ry="20" fill="rgba(8,15,34,0.55)" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" />
            {/* Zones */}
            {zone('forehead',     70,  48, 42, 18, 'Forehead')}
            {zone('left-temple',  17,  90, 22, 33, 'L', 90, 8)}
            {zone('right-temple', 123, 90, 22, 33, 'R', 90, 8)}
            {zone('sinus',        70,  86, 37, 14, 'Sinus', 82, 7)}
            {zone('jaw',          70, 148, 37, 20, 'Jaw')}
            {/* Face decorations */}
            <ellipse cx="52" cy="86" rx="9" ry="5.5" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" style={dec} />
            <ellipse cx="88" cy="86" rx="9" ry="5.5" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" style={dec} />
            <ellipse cx="70" cy="114" rx="5" ry="7"  fill="rgba(255,255,255,0.06)" style={dec} />
            <path d="M54,132 Q70,142 86,132" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" fill="none" style={dec} />
          </svg>
        </div>

        {/* ── Side view (left profile, face facing right) ── */}
        <div className="headache-view">
          <span className="headache-view-label">Side</span>
          <svg viewBox="0 0 130 190" className="headache-svg">
            {/* Head */}
            <ellipse cx="65" cy="90" rx="56" ry="74" fill="rgba(8,15,34,0.55)" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
            {/* Neck */}
            <rect x="35" y="160" width="50" height="30" rx="8" fill="rgba(8,15,34,0.55)" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" />
            {/* Ear (center-right of profile) */}
            <ellipse cx="108" cy="92" rx="10" ry="17" fill="rgba(8,15,34,0.55)" stroke="rgba(255,255,255,0.09)" strokeWidth="1.5" />
            {/* Nose protrusion (right edge = face) */}
            <path d="M121,94 C127,99 127,107 121,110 L116,104" fill="rgba(8,15,34,0.55)" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
            {/* Zones */}
            {zone('crown',    65,  24, 44, 20, 'Crown')}
            {zone('forehead', 105, 62, 24, 26, 'Front', 62, 7)}
            {zone('back',     20,  90, 22, 42, 'Back',  90, 7)}
            {zone('neck',     60, 170, 28, 18, 'Neck')}
            {/* Eye decoration */}
            <ellipse cx="110" cy="82" rx="8" ry="5" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" style={dec} />
          </svg>
        </div>

        {/* ── Top view (bird's eye) ── */}
        <div className="headache-view">
          <span className="headache-view-label">Top</span>
          <svg viewBox="0 0 140 170" className="headache-svg">
            {/* Head oval */}
            <ellipse cx="70" cy="88" rx="57" ry="70" fill="rgba(8,15,34,0.55)" stroke="rgba(255,255,255,0.13)" strokeWidth="1.5" />
            {/* Nose bump at top = front */}
            <path d="M63,18 C63,10 77,10 77,18" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" fill="rgba(8,15,34,0.6)" style={dec} />
            {/* Zones */}
            {zone('forehead',     70,  28, 38, 17, 'Front')}
            {zone('left-temple',  15,  88, 17, 42, 'L', 88, 8)}
            {zone('right-temple', 125, 88, 17, 42, 'R', 88, 8)}
            {zone('crown',        70,  88, 28, 28, 'Crown')}
            {zone('back',         70, 150, 38, 18, 'Back')}
            {/* "FRONT" direction hint */}
            <text x="70" y="10" textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.25)" style={dec}>▲ FRONT</text>
          </svg>
        </div>

      </div>
    </div>
  );
}

interface Props {
  onSaved: () => void;
  onCancel: () => void;
  initial?: WellbeingEntry;
  sleepHabitId?: string;
  initialSleepScore?: number;
  initialParseText?: string;  // pre-fill + auto-parse the description field
}

const SYMPTOM_NAMES = ['Dizziness', 'Brain Fog', 'Headache', 'Fatigue', 'Nausea', 'Vision Problems', 'Weakness', 'Numbness', 'Ear Ringing'] as const;

function buildParsePrompt(text: string): string {
  return `Extract health data from this description and return ONLY valid JSON, no explanation.

Description: "${text}"

Return JSON with only the fields that are clearly mentioned. Use null for anything not mentioned.
Available symptom names (use exact spelling): ${SYMPTOM_NAMES.join(', ')}

Schema:
{
  "heartRate": number | null,
  "systolicBP": number | null,
  "diastolicBP": number | null,
  "spo2": number | null,
  "overallFeel": number 1-10 | null,
  "symptoms": [{ "name": string, "intensity": number 1-10, "duration": string | null }],
  "notes": string | null
}
For duration use short human-readable format, e.g. "10 min", "2 h", "all day". Use null if not mentioned.`;
}

export default function WellbeingForm({ onSaved, onCancel, initial, sleepHabitId, initialSleepScore, initialParseText }: Props) {
  const [date, setDate] = useState(initial?.date ?? todayDate());
  const [time, setTime] = useState(initial?.time ?? currentTime());
  const [heartRate, setHeartRate] = useState(initial?.heartRate?.toString() ?? '');
  const [systolicBP, setSystolicBP] = useState(initial?.systolicBP?.toString() ?? '');
  const [diastolicBP, setDiastolicBP] = useState(initial?.diastolicBP?.toString() ?? '');
  const [spo2, setSpo2] = useState(initial?.spo2?.toString() ?? '');
  const [overallFeel, setOverallFeel] = useState<number | null>(initial?.overallFeel ?? null);
  // Track which symptoms are selected
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(
    initial?.symptoms.map(s => s.name) ?? [],
  );
  // Track intensity per symptom (default 5)
  const [intensities, setIntensities] = useState<Record<string, number>>(
    initial
      ? Object.fromEntries(initial.symptoms.map(s => [s.name, s.intensity]))
      : {},
  );
  const [durations, setDurations] = useState<Record<string, string>>(
    initial
      ? Object.fromEntries(initial.symptoms.filter(s => s.duration).map(s => [s.name, s.duration!]))
      : {},
  );
  const [headacheLocations, setHeadacheLocations] = useState<string[]>(
    initial?.symptoms.find(s => s.name === 'Headache')?.locations ?? [],
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [sleepScore, setSleepScore] = useState(initialSleepScore != null ? initialSleepScore.toString() : '');

  // ── AI parse state ────────────────────────────────────────────────────────
  const [parseText, setParseText] = useState(initialParseText ?? '');
  const [parsing, setParsing] = useState(false);
  const [parsedOk, setParsedOk] = useState(false);
  const [parseError, setParseError] = useState('');

  // ── Voice input ───────────────────────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognition = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;
  const voiceSupported = !!SpeechRecognition;

  function startListening() {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = parseText;
    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += (finalTranscript ? ' ' : '') + t;
        else interim = t;
      }
      setParseText(finalTranscript + (interim ? ' ' + interim : ''));
      setParsedOk(false);
      setParseError('');
    };
    recognition.onerror = () => { setListening(false); };
    recognition.onend = () => { setListening(false); };
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  useEffect(() => () => recognitionRef.current?.stop(), []);

  async function handleParse() {
    if (!parseText.trim()) return;
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) { setParseError('No API key configured.'); return; }
    setParsing(true);
    setParsedOk(false);
    setParseError('');
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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: buildParsePrompt(parseText) }],
        }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text?.trim() ?? '';
      // Strip markdown code fences if present
      const json = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(json);

      if (parsed.heartRate != null)   setHeartRate(String(parsed.heartRate));
      if (parsed.systolicBP != null)  setSystolicBP(String(parsed.systolicBP));
      if (parsed.diastolicBP != null) setDiastolicBP(String(parsed.diastolicBP));
      if (parsed.spo2 != null)        setSpo2(String(parsed.spo2));
      if (parsed.overallFeel != null) setOverallFeel(Math.min(10, Math.max(1, Math.round(parsed.overallFeel))) as number);
      if (parsed.notes)               setNotes(parsed.notes);
      if (Array.isArray(parsed.symptoms) && parsed.symptoms.length > 0) {
        const names = parsed.symptoms.map((s: any) => s.name).filter((n: string) => (SYMPTOM_NAMES as readonly string[]).includes(n));
        setSelectedSymptoms(names);
        const newIntensities: Record<string, number> = { ...intensities };
        const newDurations: Record<string, string> = { ...durations };
        for (const s of parsed.symptoms) {
          if ((SYMPTOM_NAMES as readonly string[]).includes(s.name) && s.intensity != null) {
            newIntensities[s.name] = Math.min(10, Math.max(1, Math.round(s.intensity)));
          }
          if ((SYMPTOM_NAMES as readonly string[]).includes(s.name) && s.duration) {
            newDurations[s.name] = s.duration;
          }
        }
        setIntensities(newIntensities);
        setDurations(newDurations);
      }
      setParsedOk(true);
    } catch {
      setParseError('Could not parse the response. Try rephrasing.');
    } finally {
      setParsing(false);
    }
  }

  // Auto-parse when opened via voice input on the main page
  useEffect(() => {
    if (initialParseText?.trim()) handleParse();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSymptom(name: string) {
    setSelectedSymptoms(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name],
    );
    // Set default intensity when first selected
    if (!intensities[name]) {
      setIntensities(prev => ({ ...prev, [name]: 5 }));
    }
  }

  function setIntensity(name: string, value: number) {
    setIntensities(prev => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const symptoms: SymptomEntry[] = selectedSymptoms.map(name => ({
      name,
      intensity: intensities[name] ?? 5,
      ...(durations[name]?.trim() ? { duration: durations[name].trim() } : {}),
      ...(name === 'Headache' && headacheLocations.length > 0 ? { locations: headacheLocations } : {}),
    }));

    const entry: WellbeingEntry = {
      id: initial?.id ?? generateId(),
      date,
      time,
      heartRate: heartRate ? Number(heartRate) : undefined,
      systolicBP: systolicBP ? Number(systolicBP) : undefined,
      diastolicBP: diastolicBP ? Number(diastolicBP) : undefined,
      spo2: spo2 ? Number(spo2) : undefined,
      overallFeel: overallFeel ?? undefined,
      symptoms,
      notes: notes.trim() || undefined,
    };

    saveWellbeingEntry(entry);
    if (sleepHabitId && sleepScore !== '') {
      const val = Number(sleepScore);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        setHabitLog(date, sleepHabitId, val);
      }
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="modal-body">

        {/* ── AI description parser ── */}
        <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <img src="/icon-ai.svg" alt="" style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)' }}>Describe how you feel</span>
          </div>
          <textarea
            placeholder={'e.g. "Feel about 7/10 today. HR 68, BP 118/76, spo2 97. Slight headache (3/10) and some fatigue."'}
            value={parseText}
            onChange={e => { setParseText(e.target.value); setParsedOk(false); setParseError(''); }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleParse(); } }}
            style={{ width: '100%', minHeight: 72, resize: 'vertical', fontSize: '0.88rem', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ height: 34, fontSize: '0.82rem', padding: '0 14px' }}
              disabled={parsing || !parseText.trim()}
              onClick={handleParse}
            >
              {parsing ? 'Parsing…' : 'Fill from description'}
            </button>
            {parsedOk && (
              <span style={{ fontSize: '0.8rem', color: 'var(--success, #22c55e)' }}>Fields filled — review below</span>
            )}
            {parseError && (
              <span style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>{parseError}</span>
            )}
          </div>
        </div>

        {/* When */}
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-field">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label>Time</label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Vital signs */}
        <p className="section-title mt-16">Vital Signs</p>
        <div className="form-grid">
          <div className="form-field">
            <label>Heart Rate (bpm)</label>
            <input
              type="number"
              min="30"
              max="220"
              placeholder="e.g. 72"
              value={heartRate}
              onChange={e => setHeartRate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Systolic BP (mmHg)</label>
            <input
              type="number"
              min="60"
              max="260"
              placeholder="e.g. 120"
              value={systolicBP}
              onChange={e => setSystolicBP(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Diastolic BP (mmHg)</label>
            <input
              type="number"
              min="40"
              max="160"
              placeholder="e.g. 80"
              value={diastolicBP}
              onChange={e => setDiastolicBP(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label>SpO₂ (%)</label>
            <input
              type="number"
              min="70"
              max="100"
              placeholder="e.g. 98"
              value={spo2}
              onChange={e => setSpo2(e.target.value)}
            />
          </div>
          {sleepHabitId && (
            <div className="form-field">
              <label>Sleep Score (0–100)</label>
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 75"
                value={sleepScore}
                onChange={e => setSleepScore(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Overall feel */}
        <div className="mt-16" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="section-title" style={{ margin: 0 }}>Overall Feel</p>
          <button
            type="button"
            onClick={() => setOverallFeel(overallFeel == null ? 5 : null)}
            style={{ fontSize: '0.75rem', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '2px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {overallFeel == null ? 'Set' : 'Clear'}
          </button>
        </div>
        {overallFeel != null && (
          <div className="form-field" style={{ marginTop: 8 }}>
            <label>Score (1 = very bad, 10 = excellent)</label>
            <div className="range-wrapper" style={{ marginTop: 4 }}>
              <span className="text-muted">1</span>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={overallFeel}
                onChange={e => setOverallFeel(Number(e.target.value))}
              />
              <span className="text-muted">10</span>
              <span className="range-value">{overallFeel}</span>
            </div>
          </div>
        )}

        {/* Symptoms */}
        <p className="section-title mt-16">Symptoms</p>
        <div className="symptom-grid">
          {SYMPTOM_OPTIONS.map(name => (
            <button
              key={name}
              type="button"
              className={`symptom-chip${selectedSymptoms.includes(name) ? ' selected' : ''}`}
              onClick={() => toggleSymptom(name)}
            >
              {name}
            </button>
          ))}
        </div>

        {/* Intensity sliders for selected symptoms */}
        {selectedSymptoms.length > 0 && (
          <div className="symptom-intensity-list">
            {selectedSymptoms.map(name => (
              <div key={name}>
                <div className="symptom-intensity-row">
                  <span className="symptom-name">{name}</span>
                  <div className="range-wrapper" style={{ flex: 1 }}>
                    <span className="text-muted">1</span>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={intensities[name] ?? 5}
                      onChange={e => setIntensity(name, Number(e.target.value))}
                    />
                    <span className="text-muted">10</span>
                    <span className="range-value">{intensities[name] ?? 5}</span>
                  </div>
                </div>
                <div style={{ paddingLeft: 4, marginTop: 4, marginBottom: 4 }}>
                  <input
                    type="text"
                    placeholder="Duration, e.g. 30 min, 2 h, all day"
                    value={durations[name] ?? ''}
                    onChange={e => setDurations(prev => ({ ...prev, [name]: e.target.value }))}
                    style={{ fontSize: '0.8rem', padding: '4px 8px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                {name === 'Headache' && (
                  <HeadachePicker selected={headacheLocations} onChange={setHeadacheLocations} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        <p className="section-title mt-16">Notes</p>
        <div className="form-field">
          <textarea
            placeholder="Any additional observations..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          Save Entry
        </button>
      </div>
    </form>
  );
}
