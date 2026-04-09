import { useState, useCallback } from 'react';
import WellbeingForm from './WellbeingForm';
import WellbeingCharts from './WellbeingCharts';
import WellbeingSnapshot from './WellbeingSnapshot';
import { getWellbeingEntries, deleteWellbeingEntry, getHabits, getHabitLogs } from '../../storage';
import type { WellbeingEntry } from '../../types';

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

export default function WellbeingTab() {
  const [entries, setEntries] = useState<WellbeingEntry[]>(() => getWellbeingEntries());
  const [sleepData, setSleepData] = useState(loadSleepData);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [editEntry, setEditEntry] = useState<WellbeingEntry | undefined>();

  const sleepHabit = getHabits().find(h => /sleep/i.test(h.name));
  const reload = useCallback(() => setEntries(getWellbeingEntries()), []);

  function openEdit(entry: WellbeingEntry) { setEditEntry(entry); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditEntry(undefined); }
  function handleSaved() { reload(); setSleepData(loadSleepData()); closeForm(); }
  function handleDelete(id: string) {
    if (window.confirm('Delete this entry?')) { deleteWellbeingEntry(id); reload(); }
  }

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  const recent = sorted.slice(0, 5);

  const sleepByDate = sleepData ? Object.fromEntries(sleepData.map(d => [d.date, d.value])) : {};

  return (
    <div>
      {/* Latest metrics snapshot + Log Entry button */}
      <WellbeingSnapshot onSaved={reload} />

      {/* Charts */}
      <WellbeingCharts entries={entries} sleepData={sleepData} />

      {/* Recent entries */}
      {recent.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="flex-between" style={{ marginBottom: 14 }}>
            <p className="section-title" style={{ marginBottom: 0 }}>Recent Entries</p>
            {sorted.length > 5 && (
              <button className="btn btn-secondary" onClick={() => setShowAll(true)}>
                View all {sorted.length}
              </button>
            )}
          </div>
          <div className="entry-list">
            {recent.map(entry => (
              <div key={entry.id} className="entry-row">
                <div className="flex-between">
                  <div className="entry-row-main">
                    <span className="entry-date">{entry.date} · {entry.time}</span>
                    <span className="entry-metric">Feel: {entry.overallFeel}/10</span>
                    {entry.heartRate && (
                      <span className="entry-metric-muted">HR: {entry.heartRate}</span>
                    )}
                    {entry.systolicBP && entry.diastolicBP && (
                      <span className="entry-metric-muted">BP: {entry.systolicBP}/{entry.diastolicBP}</span>
                    )}
                    {entry.spo2 && (
                      <span className="entry-metric-muted">SpO₂: {entry.spo2}%</span>
                    )}
                    {sleepByDate[entry.date] != null && (
                      <span className="entry-metric-muted">Sleep: {sleepByDate[entry.date]}/100</span>
                    )}
                    {entry.symptoms.length > 0 && (
                      <span className="entry-metric-muted">
                        · {entry.symptoms.map(s => `${s.name} (${s.intensity})`).join(', ')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <button className="btn btn-ghost" onClick={() => openEdit(entry)}>Edit</button>
                    <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(entry.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All entries modal */}
      {showAll && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setShowAll(false); }}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <p className="modal-title">All Entries ({sorted.length})</p>
              <button className="btn btn-ghost" onClick={() => setShowAll(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="entry-list">
                {sorted.map(entry => (
                  <div key={entry.id} className="entry-row">
                    <div className="flex-between">
                      <div className="entry-row-main">
                        <span className="entry-date">{entry.date} · {entry.time}</span>
                        <span className="entry-metric">Feel: {entry.overallFeel}/10</span>
                        {entry.heartRate && <span className="entry-metric-muted">HR: {entry.heartRate}</span>}
                        {entry.systolicBP && entry.diastolicBP && <span className="entry-metric-muted">BP: {entry.systolicBP}/{entry.diastolicBP}</span>}
                        {entry.spo2 && <span className="entry-metric-muted">SpO₂: {entry.spo2}%</span>}
                        {sleepByDate[entry.date] != null && <span className="entry-metric-muted">Sleep: {sleepByDate[entry.date]}/100</span>}
                        {entry.symptoms.length > 0 && (
                          <span className="entry-metric-muted">· {entry.symptoms.map(s => `${s.name} (${s.intensity})`).join(', ')}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button className="btn btn-ghost" onClick={() => { setShowAll(false); openEdit(entry); }}>Edit</button>
                        <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(entry.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form modal (for edit from entry list) */}
      {showForm && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal">
            <div className="modal-header">
              <p className="modal-title">Edit Entry</p>
              <button className="btn btn-ghost" onClick={closeForm}>✕</button>
            </div>
            <WellbeingForm
              onSaved={handleSaved}
              onCancel={closeForm}
              initial={editEntry}
              sleepHabitId={sleepHabit?.id}
              initialSleepScore={sleepData?.find(d => d.date === editEntry?.date)?.value}
            />
          </div>
        </div>
      )}
    </div>
  );
}
