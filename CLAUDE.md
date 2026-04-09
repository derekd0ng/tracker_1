# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at http://localhost:5173
npm run build    # TypeScript check + production build
npm run preview  # preview production build
```

## Architecture

**Stack:** React 18 + TypeScript, Vite, Recharts. No backend — all data stored in `localStorage`.

**Data flow:** `storage.ts` is the only file that touches `localStorage`. Components call its functions directly (no global state manager). Each tab component owns its own state and calls `storage.ts` on every user action, then re-reads to refresh.

**Key data types** (`src/types.ts`):
- `WellbeingEntry` — vitals (HR, BP, SpO2), overall feel 1–10, array of `SymptomEntry` (name + intensity 1–10)
- `Medication` — name, optional dose/startDate/durationDays/timesOfDay/purpose/doctor
- `MedicationLog` — one record per `(date × medicationId × timeOfDay)`, stores `taken: boolean`

**Tab structure:**
- `WellbeingTab` → `WellbeingForm` (modal) + `WellbeingCharts` (Recharts line charts, 7/14/30-day range)
- `MedicationTab` → `DailyMedLog` (per-day checkbox grid) + medication list + `MedicationForm` (modal)
- `ActivityTab` — placeholder

**Chart data:** Charts collapse multiple entries per day to the latest reading. `null` values are passed for missing metrics; Recharts `connectNulls` skips them gracefully.

## Extending

- **Add a new metric to well-being:** add field to `WellbeingEntry` in `types.ts`, add input in `WellbeingForm.tsx`, add a chart in `WellbeingCharts.tsx`.
- **Add activity tracking:** implement in `src/components/ActivityTab.tsx` — a new `ActivityEntry` type + storage functions following the same pattern as well-being.
- **Persist to a backend:** replace `load`/`persist` in `storage.ts`; the rest of the app is unaffected.
