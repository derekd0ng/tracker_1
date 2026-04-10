// ── API-backed storage ─────────────────────────────────────────────────────
// All data lives in the database. An in-memory cache mirrors it so that
// every existing synchronous getter (getMedications, getHabits, …) continues
// to work without touching any component code.
//
// Boot sequence:
//   1. App.tsx calls initStorage() after a successful auth/refresh.
//   2. initStorage() fetches everything in parallel → fills cache.
//   3. Components render — their useState(() => getX()) initializers read
//      from the now-populated cache, exactly as before.
//
// Mutations update the cache immediately (optimistic) then fire the API call
// in the background. Component reload() functions still work unchanged.

import { api } from './api';
import type { WellbeingEntry, Medication, MedicationLog, TimeOfDay, Habit, HabitLog } from './types';

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = {
  wellbeing:   [] as WellbeingEntry[],
  medications: [] as Medication[],
  medLogs:     [] as MedicationLog[],
  habits:      [] as Habit[],
  habitLogs:   [] as HabitLog[],
};

// ── Boot ──────────────────────────────────────────────────────────────────────

export async function initStorage(): Promise<void> {
  const [medications, medLogs, habits, habitLogs, wellbeing] = await Promise.all([
    api.get<Medication[]>('/api/medications'),
    api.get<MedicationLog[]>('/api/medications/logs'),
    api.get<Habit[]>('/api/habits'),
    api.get<HabitLog[]>('/api/habits/logs'),
    api.get<WellbeingEntry[]>('/api/wellbeing'),
  ]);
  cache.medications = medications;
  cache.medLogs     = medLogs;
  cache.habits      = habits;
  cache.habitLogs   = habitLogs;
  cache.wellbeing   = wellbeing;
}

// ── Well-being ────────────────────────────────────────────────────────────────

export function getWellbeingEntries(): WellbeingEntry[] {
  return cache.wellbeing;
}

export function saveWellbeingEntry(entry: WellbeingEntry): void {
  const idx = cache.wellbeing.findIndex(e => e.id === entry.id);
  cache.wellbeing = idx >= 0
    ? cache.wellbeing.map((e, i) => i === idx ? entry : e)
    : [...cache.wellbeing, entry];
  api.put(`/api/wellbeing/${entry.id}`, entry).catch(e => console.error('saveWellbeingEntry:', e));
}

export function deleteWellbeingEntry(id: string): void {
  cache.wellbeing = cache.wellbeing.filter(e => e.id !== id);
  api.delete(`/api/wellbeing/${id}`).catch(e => console.error('deleteWellbeingEntry:', e));
}

// ── Medications ───────────────────────────────────────────────────────────────

export function getMedications(): Medication[] {
  return cache.medications;
}

export function saveMedication(med: Medication): void {
  const idx = cache.medications.findIndex(m => m.id === med.id);
  cache.medications = idx >= 0
    ? cache.medications.map((m, i) => i === idx ? med : m)
    : [...cache.medications, med];
  api.put(`/api/medications/${med.id}`, med).catch(e => console.error('saveMedication:', e));
}

export function deleteMedication(id: string): void {
  cache.medications = cache.medications.filter(m => m.id !== id);
  api.delete(`/api/medications/${id}`).catch(e => console.error('deleteMedication:', e));
}

// ── Medication logs ───────────────────────────────────────────────────────────

export function getMedLogs(): MedicationLog[] {
  return cache.medLogs;
}

export function getMedLogsForDate(date: string): MedicationLog[] {
  return cache.medLogs.filter(l => l.date === date);
}

export function toggleMedLog(date: string, medicationId: string, timeOfDay: TimeOfDay): void {
  const idx = cache.medLogs.findIndex(
    l => l.date === date && l.medicationId === medicationId && l.timeOfDay === timeOfDay,
  );
  const now = new Date();
  const takenAt = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  if (idx >= 0) {
    const nowTaken = !cache.medLogs[idx].taken;
    cache.medLogs[idx] = { date, medicationId, timeOfDay, taken: nowTaken,
      ...(nowTaken ? { takenAt, changedAt: Date.now() } : {}), skipped: false };
  } else {
    cache.medLogs.push({ date, medicationId, timeOfDay, taken: true, takenAt, changedAt: Date.now() });
  }
  api.post('/api/medications/logs/toggle', { date, medicationId, timeOfDay })
    .catch(e => console.error('toggleMedLog:', e));
}

export function skipMedLog(date: string, medicationId: string, timeOfDay: TimeOfDay): void {
  const idx = cache.medLogs.findIndex(
    l => l.date === date && l.medicationId === medicationId && l.timeOfDay === timeOfDay,
  );
  const entry: MedicationLog = { date, medicationId, timeOfDay, taken: false, skipped: true, changedAt: Date.now() };
  if (idx >= 0) cache.medLogs[idx] = entry; else cache.medLogs.push(entry);
  api.post('/api/medications/logs/skip', { date, medicationId, timeOfDay })
    .catch(e => console.error('skipMedLog:', e));
}

export function clearMedLog(date: string, medicationId: string, timeOfDay: TimeOfDay): void {
  cache.medLogs = cache.medLogs.filter(
    l => !(l.date === date && l.medicationId === medicationId && l.timeOfDay === timeOfDay),
  );
  api.post('/api/medications/logs/clear', { date, medicationId, timeOfDay })
    .catch(e => console.error('clearMedLog:', e));
}

export function moveMedLog(date: string, medicationId: string, fromSlot: TimeOfDay, toSlot: TimeOfDay): void {
  const idx = cache.medLogs.findIndex(
    l => l.date === date && l.medicationId === medicationId && l.timeOfDay === fromSlot,
  );
  const entry: MedicationLog = { date, medicationId, timeOfDay: fromSlot, taken: false, skipped: false, movedTo: toSlot, changedAt: Date.now() };
  if (idx >= 0) cache.medLogs[idx] = entry; else cache.medLogs.push(entry);
  api.post('/api/medications/logs/move', { date, medicationId, fromSlot, toSlot })
    .catch(e => console.error('moveMedLog:', e));
}

export function bulkSetMedLogs(
  entries: Array<{ date: string; medicationId: string; timeOfDay: TimeOfDay; taken: boolean }>,
): void {
  for (const { date, medicationId, timeOfDay, taken } of entries) {
    const idx = cache.medLogs.findIndex(
      l => l.date === date && l.medicationId === medicationId && l.timeOfDay === timeOfDay,
    );
    if (taken) {
      const entry: MedicationLog = { date, medicationId, timeOfDay, taken: true };
      if (idx >= 0) cache.medLogs[idx] = entry; else cache.medLogs.push(entry);
    } else {
      if (idx >= 0) cache.medLogs.splice(idx, 1);
    }
  }
  api.post('/api/medications/logs/bulk', { entries })
    .catch(e => console.error('bulkSetMedLogs:', e));
}

// ── Habits ────────────────────────────────────────────────────────────────────

export function getHabits(): Habit[] {
  return cache.habits;
}

export function saveHabit(habit: Habit): void {
  const idx = cache.habits.findIndex(h => h.id === habit.id);
  cache.habits = idx >= 0
    ? cache.habits.map((h, i) => i === idx ? habit : h)
    : [...cache.habits, habit];
  api.put(`/api/habits/${habit.id}`, habit).catch(e => console.error('saveHabit:', e));
}

export function deleteHabit(id: string): void {
  cache.habits = cache.habits.filter(h => h.id !== id);
  api.delete(`/api/habits/${id}`).catch(e => console.error('deleteHabit:', e));
}

export function getHabitLogs(): HabitLog[] {
  return cache.habitLogs;
}

export function getHabitLogsForDate(date: string): HabitLog[] {
  return cache.habitLogs.filter(l => l.date === date);
}

export function setHabitLog(date: string, habitId: string, value: number): void {
  const idx = cache.habitLogs.findIndex(l => l.date === date && l.habitId === habitId);
  if (idx >= 0) cache.habitLogs[idx] = { date, habitId, value };
  else cache.habitLogs.push({ date, habitId, value });
  api.post('/api/habits/logs', { date, habitId, value })
    .catch(e => console.error('setHabitLog:', e));
}

export function bulkSetHabitLogs(
  entries: Array<{ date: string; habitId: string; value: number | null }>,
): void {
  for (const { date, habitId, value } of entries) {
    const idx = cache.habitLogs.findIndex(l => l.date === date && l.habitId === habitId);
    if (value === null) {
      if (idx >= 0) cache.habitLogs.splice(idx, 1);
    } else {
      if (idx >= 0) cache.habitLogs[idx] = { date, habitId, value };
      else cache.habitLogs.push({ date, habitId, value });
    }
  }
  api.post('/api/habits/logs/bulk', { entries })
    .catch(e => console.error('bulkSetHabitLogs:', e));
}

// ── Chart order (UI preference — keep in localStorage) ───────────────────────

const CHART_ORDER_KEY = 'srt_chart_order';

export function getChartOrder(): string[] | null {
  try { return JSON.parse(localStorage.getItem(CHART_ORDER_KEY) ?? 'null'); }
  catch { return null; }
}

export function saveChartOrder(order: string[]): void {
  localStorage.setItem(CHART_ORDER_KEY, JSON.stringify(order));
}

// ── Data export (XLSX) ────────────────────────────────────────────────────────

export async function exportAsXlsx(): Promise<void> {
  const { utils, writeFile } = await import('xlsx');
  const meds     = getMedications();
  const medLogs  = getMedLogs();
  const habits   = getHabits();
  const medById  = Object.fromEntries(meds.map(m => [m.id, m]));
  const habitById = Object.fromEntries(habits.map(h => [h.id, h]));

  const wellbeing = getWellbeingEntries().map(e => ({
    Date: e.date, Time: e.time ?? '', Feel: e.overallFeel ?? '',
    'Heart Rate': e.heartRate ?? '', 'Systolic BP': e.systolicBP ?? '',
    'Diastolic BP': e.diastolicBP ?? '', SpO2: e.spo2 ?? '',
    Symptoms: e.symptoms?.map(s => `${s.name} (${s.intensity}/10)`).join(', ') ?? '',
    Notes: e.notes ?? '',
  }));
  const medications = meds.map(m => ({
    Name: m.name, Dose: m.dose ?? '', 'Times of Day': m.timesOfDay.join(', '),
    'Start Date': m.startDate ?? '', 'Duration (days)': m.durationDays ?? '',
    Purpose: m.purpose ?? '', Doctor: m.prescribingDoctor ?? '',
    Active: m.active ? 'Yes' : 'No',
  }));
  const medicationLogs = medLogs.map(l => ({
    Date: l.date, Medication: medById[l.medicationId]?.name ?? l.medicationId,
    'Time of Day': l.timeOfDay, Taken: l.taken ? 'Yes' : 'No',
    'Taken At': l.takenAt ?? '', Skipped: l.skipped ? 'Yes' : 'No',
  }));
  const habitRows = habits.map(h => ({
    Name: h.name, Type: h.type, Target: h.target ?? '', Unit: h.unit ?? '',
  }));
  const habitLogs = getHabitLogs().map(l => ({
    Date: l.date, Habit: habitById[l.habitId]?.name ?? l.habitId, Value: l.value,
  }));

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(wellbeing),      'Well-being');
  utils.book_append_sheet(wb, utils.json_to_sheet(medications),    'Medications');
  utils.book_append_sheet(wb, utils.json_to_sheet(medicationLogs), 'Medication Logs');
  utils.book_append_sheet(wb, utils.json_to_sheet(habitRows),      'Habits');
  utils.book_append_sheet(wb, utils.json_to_sheet(habitLogs),      'Habit Logs');
  writeFile(wb, `recovery-export-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ── Backup JSON export ────────────────────────────────────────────────────────

export function exportData(): void {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    version: 1,
    data: {
      wellbeing:   JSON.stringify(cache.wellbeing),
      medications: JSON.stringify(cache.medications),
      medLogs:     JSON.stringify(cache.medLogs),
      habits:      JSON.stringify(cache.habits),
      habitLogs:   JSON.stringify(cache.habitLogs),
    },
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `recovery-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Backup JSON import (sends to API, then refreshes cache) ───────────────────

export async function importData(json: string): Promise<void> {
  const snapshot = JSON.parse(json);
  if (!snapshot?.data) throw new Error('Invalid backup file');
  const { data } = snapshot;

  const medications = data.medications ? JSON.parse(data.medications) : [];
  const medLogs     = data.medLogs     ? JSON.parse(data.medLogs)     : [];
  const habits      = data.habits      ? JSON.parse(data.habits)      : [];
  const habitLogs   = data.habitLogs   ? JSON.parse(data.habitLogs)   : [];
  const wellbeing   = data.wellbeing   ? JSON.parse(data.wellbeing)   : [];

  // Sequential — logs depend on their parent records existing first
  await api.post('/api/medications/import', { medications, medLogs });
  await api.post('/api/habits/import',      { habits, habitLogs });
  await api.post('/api/wellbeing/import',   { wellbeing });

  // Refresh cache after import
  await initStorage();
}
