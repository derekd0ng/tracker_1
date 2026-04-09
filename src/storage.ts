// ── localStorage helpers ───────────────────────────────────────────────────
// All data is stored in the browser's localStorage under namespaced keys.
// Future: swap out load/persist to use a backend or IndexedDB.

import type { WellbeingEntry, Medication, MedicationLog, TimeOfDay, Habit, HabitLog } from './types';

const KEYS = {
  WELLBEING: 'srt_wellbeing',
  MEDICATIONS: 'srt_medications',
  MED_LOGS: 'srt_med_logs',
  HABITS: 'srt_habits',
  HABIT_LOGS: 'srt_habit_logs',
};

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function persist<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Well-being ─────────────────────────────────────────────────────────────

export function getWellbeingEntries(): WellbeingEntry[] {
  return load<WellbeingEntry>(KEYS.WELLBEING);
}

export function saveWellbeingEntry(entry: WellbeingEntry): void {
  const all = getWellbeingEntries();
  const idx = all.findIndex(e => e.id === entry.id);
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  persist(KEYS.WELLBEING, all);
}

export function deleteWellbeingEntry(id: string): void {
  persist(KEYS.WELLBEING, getWellbeingEntries().filter(e => e.id !== id));
}

// ── Medications ────────────────────────────────────────────────────────────

export function getMedications(): Medication[] {
  return load<Medication>(KEYS.MEDICATIONS);
}

export function saveMedication(med: Medication): void {
  const all = getMedications();
  const idx = all.findIndex(m => m.id === med.id);
  if (idx >= 0) all[idx] = med;
  else all.push(med);
  persist(KEYS.MEDICATIONS, all);
}

export function deleteMedication(id: string): void {
  persist(KEYS.MEDICATIONS, getMedications().filter(m => m.id !== id));
}

// ── Medication daily logs ──────────────────────────────────────────────────

export function getMedLogs(): MedicationLog[] {
  return load<MedicationLog>(KEYS.MED_LOGS);
}

export function getMedLogsForDate(date: string): MedicationLog[] {
  return getMedLogs().filter(l => l.date === date);
}

// ── Habits ─────────────────────────────────────────────────────────────────

export function getHabits(): Habit[] {
  return load<Habit>(KEYS.HABITS);
}

export function saveHabit(habit: Habit): void {
  const all = getHabits();
  const idx = all.findIndex(h => h.id === habit.id);
  if (idx >= 0) all[idx] = habit;
  else all.push(habit);
  persist(KEYS.HABITS, all);
}

export function deleteHabit(id: string): void {
  persist(KEYS.HABITS, getHabits().filter(h => h.id !== id));
}

export function getHabitLogs(): HabitLog[] {
  return load<HabitLog>(KEYS.HABIT_LOGS);
}

export function getHabitLogsForDate(date: string): HabitLog[] {
  return getHabitLogs().filter(l => l.date === date);
}

export function setHabitLog(date: string, habitId: string, value: number): void {
  const all = getHabitLogs();
  const idx = all.findIndex(l => l.date === date && l.habitId === habitId);
  if (idx >= 0) all[idx] = { date, habitId, value };
  else all.push({ date, habitId, value });
  persist(KEYS.HABIT_LOGS, all);
}

export function bulkSetHabitLogs(
  entries: Array<{ date: string; habitId: string; value: number | null }>,
): void {
  const all = getHabitLogs();
  for (const { date, habitId, value } of entries) {
    const idx = all.findIndex(l => l.date === date && l.habitId === habitId);
    if (value === null) {
      if (idx >= 0) all.splice(idx, 1);
    } else {
      if (idx >= 0) all[idx] = { date, habitId, value };
      else all.push({ date, habitId, value });
    }
  }
  persist(KEYS.HABIT_LOGS, all);
}

export function bulkSetMedLogs(
  entries: Array<{ date: string; medicationId: string; timeOfDay: TimeOfDay; taken: boolean }>,
): void {
  const all = getMedLogs();
  for (const { date, medicationId, timeOfDay, taken } of entries) {
    const idx = all.findIndex(
      l => l.date === date && l.medicationId === medicationId && l.timeOfDay === timeOfDay,
    );
    if (taken) {
      const entry = { date, medicationId, timeOfDay, taken: true };
      if (idx >= 0) all[idx] = entry;
      else all.push(entry);
    } else {
      if (idx >= 0) all.splice(idx, 1);
    }
  }
  persist(KEYS.MED_LOGS, all);
}

export function skipMedLog(date: string, medicationId: string, timeOfDay: TimeOfDay): void {
  const all = getMedLogs();
  const idx = all.findIndex(
    l => l.date === date && l.medicationId === medicationId && l.timeOfDay === timeOfDay,
  );
  const entry = { date, medicationId, timeOfDay, taken: false, skipped: true, changedAt: Date.now() };
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  persist(KEYS.MED_LOGS, all);
}

export function clearMedLog(date: string, medicationId: string, timeOfDay: TimeOfDay): void {
  persist(
    KEYS.MED_LOGS,
    getMedLogs().filter(
      l => !(l.date === date && l.medicationId === medicationId && l.timeOfDay === timeOfDay),
    ),
  );
}

// ── Medication daily logs ──────────────────────────────────────────────────

// ── Excel export ──────────────────────────────────────────────────────────

export async function exportAsXlsx(): Promise<void> {
  const { utils, writeFile } = await import('xlsx');

  const meds    = getMedications();
  const medLogs = getMedLogs();
  const habits  = getHabits();
  const medById  = Object.fromEntries(meds.map(m => [m.id, m]));
  const habitById = Object.fromEntries(habits.map(h => [h.id, h]));

  // Sheet 1 — Well-being
  const wellbeing = getWellbeingEntries().map(e => ({
    Date: e.date,
    Time: e.time ?? '',
    Feel: e.overallFeel ?? '',
    'Heart Rate': e.heartRate ?? '',
    'Systolic BP': e.systolicBP ?? '',
    'Diastolic BP': e.diastolicBP ?? '',
    SpO2: e.spo2 ?? '',
    Symptoms: e.symptoms?.map(s => `${s.name} (${s.intensity}/10)`).join(', ') ?? '',
    Notes: e.notes ?? '',
  }));

  // Sheet 2 — Medications
  const medications = meds.map(m => ({
    Name: m.name,
    Dose: m.dose ?? '',
    'Times of Day': m.timesOfDay.join(', '),
    'Start Date': m.startDate ?? '',
    'Duration (days)': m.durationDays ?? '',
    Purpose: m.purpose ?? '',
    Doctor: m.prescribingDoctor ?? '',
    Active: m.active ? 'Yes' : 'No',
  }));

  // Sheet 3 — Medication Logs
  const medicationLogs = medLogs.map(l => ({
    Date: l.date,
    Medication: medById[l.medicationId]?.name ?? l.medicationId,
    'Time of Day': l.timeOfDay,
    Taken: l.taken ? 'Yes' : 'No',
    'Taken At': l.takenAt ?? '',
    Skipped: l.skipped ? 'Yes' : 'No',
  }));

  // Sheet 4 — Habits
  const habitRows = habits.map(h => ({
    Name: h.name,
    Type: h.type,
    Target: h.target ?? '',
    Unit: h.unit ?? '',
  }));

  // Sheet 5 — Habit Logs
  const habitLogs = getHabitLogs().map(l => ({
    Date: l.date,
    Habit: habitById[l.habitId]?.name ?? l.habitId,
    Value: l.value,
  }));

  const wb = utils.book_new();
  utils.book_append_sheet(wb, utils.json_to_sheet(wellbeing),      'Well-being');
  utils.book_append_sheet(wb, utils.json_to_sheet(medications),    'Medications');
  utils.book_append_sheet(wb, utils.json_to_sheet(medicationLogs), 'Medication Logs');
  utils.book_append_sheet(wb, utils.json_to_sheet(habitRows),      'Habits');
  utils.book_append_sheet(wb, utils.json_to_sheet(habitLogs),      'Habit Logs');

  writeFile(wb, `recovery-export-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ── Chart order preference ────────────────────────────────────────────────

const CHART_ORDER_KEY = 'srt_chart_order';

export function getChartOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(CHART_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveChartOrder(order: string[]): void {
  localStorage.setItem(CHART_ORDER_KEY, JSON.stringify(order));
}

// ── Backup / restore ──────────────────────────────────────────────────────

export function exportData(): void {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    version: 1,
    data: {
      wellbeing:   localStorage.getItem(KEYS.WELLBEING)   ?? '[]',
      medications: localStorage.getItem(KEYS.MEDICATIONS) ?? '[]',
      medLogs:     localStorage.getItem(KEYS.MED_LOGS)    ?? '[]',
      habits:      localStorage.getItem(KEYS.HABITS)      ?? '[]',
      habitLogs:   localStorage.getItem(KEYS.HABIT_LOGS)  ?? '[]',
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

export function importData(json: string): void {
  const snapshot = JSON.parse(json);
  if (!snapshot?.data) throw new Error('Invalid backup file');
  const { data } = snapshot;
  if (data.wellbeing)   localStorage.setItem(KEYS.WELLBEING,   data.wellbeing);
  if (data.medications) localStorage.setItem(KEYS.MEDICATIONS, data.medications);
  if (data.medLogs)     localStorage.setItem(KEYS.MED_LOGS,    data.medLogs);
  if (data.habits)      localStorage.setItem(KEYS.HABITS,      data.habits);
  if (data.habitLogs)   localStorage.setItem(KEYS.HABIT_LOGS,  data.habitLogs);
}

// ── Medication daily logs ──────────────────────────────────────────────────

export function toggleMedLog(
  date: string,
  medicationId: string,
  timeOfDay: TimeOfDay,
): void {
  const all = getMedLogs();
  const idx = all.findIndex(
    l => l.date === date && l.medicationId === medicationId && l.timeOfDay === timeOfDay,
  );
  const now = new Date();
  const takenAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (idx >= 0) {
    const nowTaken = !all[idx].taken;
    all[idx] = { date, medicationId, timeOfDay, taken: nowTaken, ...(nowTaken ? { takenAt, changedAt: Date.now() } : {}) };
  } else {
    all.push({ date, medicationId, timeOfDay, taken: true, takenAt, changedAt: Date.now() });
  }
  persist(KEYS.MED_LOGS, all);
}
