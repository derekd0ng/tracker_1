// ── Core data types for Recovery Tracker ──────────────────────────────────

export interface WellbeingEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  heartRate?: number;    // bpm
  systolicBP?: number;   // mmHg
  diastolicBP?: number;  // mmHg
  spo2?: number;         // %
  overallFeel?: number;  // 1–10, optional
  symptoms: SymptomEntry[];
  notes?: string;
}

export interface SymptomEntry {
  name: string;
  intensity: number;     // 1–10
  duration?: string;     // free text, e.g. "30 min", "2 h", "all day"
  locations?: string[];  // headache zone ids
}

// Predefined symptom options (user selects which apply)
export const SYMPTOM_OPTIONS = [
  'Dizziness',
  'Brain Fog',
  'Headache',
  'Fatigue',
  'Nausea',
  'Vision Problems',
  'Weakness',
  'Numbness',
  'Ear Ringing',
] as const;

export interface Medication {
  id: string;
  name: string;
  dose?: string;
  startDate?: string;      // YYYY-MM-DD
  durationDays?: number;
  timesOfDay: TimeOfDay[];
  purpose?: string;
  prescribingDoctor?: string;
  notes?: string;
  active: boolean;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export const TIMES_OF_DAY: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];

// One entry per medication × time-of-day × date
export interface MedicationLog {
  date: string;            // YYYY-MM-DD
  medicationId: string;
  timeOfDay: TimeOfDay;
  taken: boolean;
  takenAt?: string;        // HH:MM when taken
  skipped?: boolean;       // intentionally skipped; extends the course by 1 day
  movedTo?: TimeOfDay;     // moved to a different slot for this day only
  changedAt?: number;      // Date.now() of last taken/skipped action, for sorting
}

export type TabId = 'dashboard' | 'wellbeing' | 'medication' | 'habits' | 'todo' | 'diary' | 'home' | 'calendar' | 'labs';

export type LabType = 'blood' | 'urine' | 'stool' | 'other';

export interface LabResult {
  id: string;
  metricName: string;
  date: string;        // YYYY-MM-DD
  value: number | null;
  valueText: string | null;  // qualitative result e.g. "Positive", "Negative"
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  refText: string | null;
  labType: LabType;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string;
  description?: string;
  color?: string;
}

export interface DiaryEntry {
  date: string;
  freeText: string;
  prompts: Record<string, string>;
  updatedAt: string;
}

export interface TodoItem {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  dueDate?: string;
  reminderTime?: string;
}

export type HabitType = 'boolean' | 'numeric';
export type HabitFrequency = 'daily' | 'weekly';

export interface Habit {
  id: string;
  name: string;
  type: HabitType;
  frequency?: HabitFrequency;  // defaults to 'daily' when absent
  icon?: string;
  unit?: string;
  target?: number;
  weeklyTarget?: number;       // for weekly habits: how many times per week
  startDate?: string;          // YYYY-MM-DD, when tracking for this habit began
}

export interface HabitLog {
  date: string;       // YYYY-MM-DD
  habitId: string;
  value: number;      // boolean: 1=done 0=skipped; numeric: the recorded value
}
