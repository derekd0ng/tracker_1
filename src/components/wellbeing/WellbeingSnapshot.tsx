import { useState, useRef, useEffect } from 'react';
import WellbeingForm from './WellbeingForm';
import { getWellbeingEntries, getHabits, getHabitLogs } from '../../storage';
import type { WellbeingEntry, SymptomEntry } from '../../types';

// ── Helpers ────────────────────────────────────────────────────────────────

function loadSleepData() {
  const sleepHabit = getHabits().find(h => /sleep/i.test(h.name));
  if (!sleepHabit) return undefined;
  return getHabitLogs()
    .filter(l => l.habitId === sleepHabit.id && l.value > 0)
    .map(l => ({ date: l.date, value: l.value }));
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatEntryDateTime(e: WellbeingEntry): string {
  const d = new Date(e.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${dateStr} • ${e.time}`;
}

// ── Color / status helpers ─────────────────────────────────────────────────

type VitalColor = 'green' | 'yellow' | 'orange' | 'red';
type VitalStatus = 'good' | 'warning' | 'caution' | 'bad' | 'neutral';

function toStatus(c: VitalColor): VitalStatus {
  if (c === 'green') return 'good';
  if (c === 'red') return 'bad';
  if (c === 'orange') return 'caution';
  if (c === 'yellow') return 'warning';
  return 'neutral';
}

function feelColor(v: number): VitalColor {
  if (v >= 8) return 'green';
  if (v >= 6) return 'yellow';
  if (v >= 3) return 'orange';
  return 'red';
}
function spo2Color(v: number): VitalColor {
  if (v >= 95) return 'green';
  if (v >= 92) return 'yellow';
  if (v >= 90) return 'orange';
  return 'red';
}
function sysBPColor(v: number): VitalColor {
  if (v >= 150) return 'red';
  if (v >= 135) return 'orange';
  if (v >= 120) return 'yellow';
  if (v >= 90)  return 'green';
  return 'yellow';
}
function diaBPColor(v: number): VitalColor {
  if (v > 100) return 'red';
  if (v >= 85)  return 'orange';
  if (v >= 80)  return 'yellow';
  if (v >= 60)  return 'green';
  return 'yellow';
}
function hrColor(hr: number, avgHr: number | null): VitalColor {
  if (avgHr === null) return 'green';
  const pct = Math.abs(hr - avgHr) / avgHr;
  if (pct <= 0.10) return 'green';
  if (pct <= 0.20) return 'yellow';
  if (pct <= 0.30) return 'orange';
  return 'red';
}
function sleepColor(v: number): VitalColor {
  if (v >= 80) return 'green';
  if (v >= 60) return 'yellow';
  if (v >= 40) return 'orange';
  return 'red';
}
function symptomStatus(intensity: number): VitalStatus {
  if (intensity <= 1) return 'neutral';
  if (intensity <= 4) return 'warning';
  if (intensity <= 7) return 'caution';
  return 'bad';
}

// ── VitalCard ──────────────────────────────────────────────────────────────

interface VitalCardProps { label: string; value: string; status: VitalStatus; wide?: boolean; }
function VitalCard({ label, value, status, wide }: VitalCardProps) {
  const parts = value.match(/^([\d./]+)(.*)$/);
  const num  = parts?.[1] ?? value;
  const unit = parts?.[2]?.trim() ?? '';
  return (
    <div className={`vital-card vital-card--${status}${wide ? ' vital-card--wide' : ''}`}>
      <div className="vital-card-dot" />
      <div className="vital-card-label">{label}</div>
      <div className="vital-card-row">
        <span className="vital-card-value">{num}</span>
        {unit && <span className="vital-card-unit">{unit}</span>}
      </div>
    </div>
  );
}

// ── WellbeingSnapshot ──────────────────────────────────────────────────────

interface Props {
  onSaved?: () => void;
  navButton?: React.ReactNode;
}

export default function WellbeingSnapshot({ onSaved, navButton }: Props) {
  const [entries, setEntries] = useState<WellbeingEntry[]>(() => getWellbeingEntries());
  const [sleepData, setSleepData] = useState(loadSleepData);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<WellbeingEntry | undefined>();
  const [voiceTranscript, setVoiceTranscript] = useState<string | undefined>();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognition = typeof window !== 'undefined'
    ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

  function startVoiceEntry() {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    let transcript = '';
    recognition.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += (transcript ? ' ' : '') + e.results[i][0].transcript;
      }
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      if (transcript.trim()) {
        setVoiceTranscript(transcript.trim());
        setEditEntry(undefined);
        setShowForm(true);
      }
    };
    recognition.start();
    setListening(true);
  }

  function stopVoiceEntry() {
    recognitionRef.current?.stop();
  }

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const sleepHabit = getHabits().find(h => /sleep/i.test(h.name));

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  const today = localDateStr();

  const latestEntry = sorted[0] ?? null;
  const latestHR    = sorted.find(e => e.heartRate  != null) ?? null;
  const latestBP    = sorted.find(e => e.systolicBP != null && e.diastolicBP != null) ?? null;
  const latestSpO2  = sorted.find(e => e.spo2       != null) ?? null;

  const thirtyDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return localDateStr(d); })();
  const avgHr = (() => {
    const vals = sorted.filter(e => e.date >= thirtyDaysAgo && e.heartRate != null).map(e => e.heartRate as number);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  })();

  const sleepByDate = sleepData ? Object.fromEntries(sleepData.map(d => [d.date, d.value])) : {};
  const latestSleep = sleepData
    ? [...sleepData].filter(d => d.value > 0).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    : null;

  function openNew() { setVoiceTranscript(undefined); setEditEntry(undefined); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditEntry(undefined); setVoiceTranscript(undefined); }
  function handleSaved() {
    setEntries(getWellbeingEntries());
    setSleepData(loadSleepData());
    closeForm();
    onSaved?.();
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="flex-between" style={{ marginBottom: latestEntry ? 4 : 0 }}>
          <div>
            <p className="section-title" style={{ marginBottom: 0 }}>Latest Well-being</p>
            {latestEntry && (
              <p className="text-muted snapshot-ts" style={{ fontSize: '0.8rem', marginTop: 3, marginBottom: 0 }}>
                Last entry: {formatEntryDateTime(latestEntry)}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-primary" onClick={openNew}>+ Log Entry</button>
            {SpeechRecognition && (
              <button
                className={`btn${listening ? ' btn-primary' : ' btn-secondary'}`}
                onClick={listening ? stopVoiceEntry : startVoiceEntry}
                title={listening ? 'Stop and open form' : 'Log by voice'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}
              >
                {listening ? (
                  <>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite', flexShrink: 0 }} />
                    Stop
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="2" width="6" height="12" rx="3"/>
                      <path d="M5 10a7 7 0 0 0 14 0"/>
                      <line x1="12" y1="19" x2="12" y2="22"/>
                      <line x1="8" y1="22" x2="16" y2="22"/>
                    </svg>
                    Voice
                  </>
                )}
              </button>
            )}
            {navButton}
          </div>
        </div>

        {!latestEntry ? (
          <p className="text-muted" style={{ padding: '8px 0' }}>No entries yet. Log your first entry above.</p>
        ) : (
          <div className="vital-cards-row" style={{ marginTop: 16 }}>
            {latestEntry.overallFeel != null && (
              <VitalCard label="Feel" value={`${latestEntry.overallFeel} /10`} status={toStatus(feelColor(latestEntry.overallFeel))} />
            )}
            {latestHR && (
              <VitalCard label={`Heart Rate${latestHR.date !== latestEntry.date ? ` (${shortDate(latestHR.date)})` : ''}`} value={`${latestHR.heartRate} bpm`} status={toStatus(hrColor(latestHR.heartRate!, avgHr))} />
            )}
            {latestBP && (() => {
              const STATUS_RANK: Record<VitalStatus, number> = { bad: 4, caution: 3, warning: 2, good: 1, neutral: 0 };
              const sysStatus = toStatus(sysBPColor(latestBP.systolicBP!));
              const diaStatus = toStatus(diaBPColor(latestBP.diastolicBP!));
              const bpStatus = STATUS_RANK[sysStatus] >= STATUS_RANK[diaStatus] ? sysStatus : diaStatus;
              return (
                <VitalCard
                  label={`Blood Pressure${latestBP.date !== latestEntry.date ? ` (${shortDate(latestBP.date)})` : ''}`}
                  value={`${latestBP.systolicBP}/${latestBP.diastolicBP} mmHg`}
                  status={bpStatus}
                  wide
                />
              );
            })()}
            {latestSpO2 && (
              <VitalCard label={`SpO₂${latestSpO2.date !== latestEntry.date ? ` (${shortDate(latestSpO2.date)})` : ''}`} value={`${latestSpO2.spo2} %`} status={toStatus(spo2Color(latestSpO2.spo2!))} />
            )}
            {latestSleep && (
              <VitalCard label={`Sleep${latestSleep.date !== latestEntry.date ? ` (${shortDate(latestSleep.date)})` : ''}`} value={`${latestSleep.value} /100`} status={toStatus(sleepColor(latestSleep.value))} />
            )}
            {latestEntry.symptoms.length === 0 ? (
              <VitalCard label="Symptoms" value="None" status="good" />
            ) : latestEntry.symptoms.map((s: SymptomEntry) => (
              <VitalCard key={s.name} label={s.duration ? `${s.name} · ${s.duration}` : s.name} value={`${s.intensity} /10`} status={symptomStatus(s.intensity)} />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal">
            <div className="modal-header">
              <p className="modal-title">{editEntry ? 'Edit Entry' : 'Log Well-being'}</p>
              <button className="btn btn-ghost" onClick={closeForm}>✕</button>
            </div>
            <WellbeingForm
              onSaved={handleSaved}
              onCancel={closeForm}
              initial={editEntry}
              sleepHabitId={sleepHabit?.id}
              initialSleepScore={sleepData?.find(d => d.date === (editEntry?.date ?? today))?.value}
              initialParseText={voiceTranscript}
            />
          </div>
        </div>
      )}
    </>
  );
}

export { sleepColor, shortDate, localDateStr };
