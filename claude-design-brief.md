# Claude Design Brief — Health Recovery Tracker

## What to submit
Paste the **Prompt** section below into Claude Design.  
Attach the **5 screenshots** listed at the bottom (capture these from your running app at localhost:5173).

---

## Prompt

Design a **personal health recovery tracking web app** called **"Recovery"**. It is a single-page app with a fixed left sidebar navigation and a scrollable main content area. The user is an individual tracking their own recovery — medications, vitals/wellbeing, and daily habits.

### App structure

**Navigation sidebar** (240px wide, fixed left, full height):
- App title: "Recovery" (large, bold)
- Sub-label: "Personal tracker"
- 4 nav items with icons: Dashboard, Well-being, Medications, Habits
- Bottom section: user name/email + sign out
- Each tab shifts the active accent color: Dashboard = white, Well-being = green, Medications = teal/cyan, Habits = blue

**Tab 1 — Dashboard** (landing screen):
- Greeting: "Good morning, Kirill" + "You've completed X% of your daily recovery goals"
- Well-being snapshot card: latest vitals (HR, BP, SpO2, overall feel 1–10) + active symptom chips
- Medications card: "X/Y taken" counter + collapsible time-slot sections (Morning/Afternoon/Evening/Night) with medication checkboxes
- Habits & Streaks card: "X/Y done" counter + daily and weekly habit rows with checkboxes/inputs + streak badges

**Tab 2 — Well-being**:
- "+ Log Entry" button → modal form with: heart rate, blood pressure, SpO2, overall feel slider 1–10, symptom chips with intensity, text notes, voice input
- Line charts showing trends over 1/7/14/30 day ranges (one chart per metric)

**Tab 3 — Medications**:
- 3 stat cards at top: Doses Taken today (X/Y), Weekly Adherence %, Average Daily Doses
- Collapsible time-slot sections with medication rows (checkbox for taken/skipped, move-to-slot option)
- Medication list below with active/inactive toggle, edit, delete
- "+ Add Medication" button + "Bulk Input" ghost button
- AI info modal triggered by purple icon per medication ("AI Overview")

**Tab 4 — Habits**:
- 4 stat cards: current streak, longest streak, completion rate, active habits count
- Daily habits section (boolean toggle + numeric input variants)
- Weekly habits section
- "Suggested for You" AI section with habit recommendation cards
- Streak badges with flame icon on high-streak habits

### Design constraints & context
- **Must be dark theme** — the user runs this as a PWA at night and prefers dark
- **Primary font:** Onest (Google Fonts) — geometric, modern, friendly
- **Data density:** medium-high — health data needs to be scannable, not sparse
- **Interactivity:** all cards have hover states, collapsible sections, modal overlays
- **Mobile-responsive:** sidebar collapses to bottom nav on mobile (≤768px)
- **No illustrations or stock photos** — data-driven UI only

### Current design (what to replace / improve upon)
The current design uses:
- Background: `#090e1e` (very dark navy)
- Card surface: `#101829`
- Accent: `#00bcd4` (cyan/teal) as default; per-tab accents as noted above
- Heavy use of subtle borders (`rgba(255,255,255,0.07)`), large border-radius (24px on cards)
- Stat numbers are large and bold; section titles at ~1.15rem
- Icons are small PNG/SVG images (morning sun, moon, etc.)

**The goal is a fresh visual direction** — a redesign that feels more polished, modern, and cohesive while keeping the dark theme and data-dense structure. Consider: better use of color hierarchy, more intentional spacing, stronger visual differentiation between tabs, more refined typography scale, and richer interactive states.

### Key components to show in the design
Please design at minimum these 3 screens:
1. **Dashboard** (default view with all 3 cards populated with sample data)
2. **Medications tab** (with stat cards + expanded morning slot showing 2–3 medications)
3. **Well-being tab** (with charts visible for heart rate and overall feel)

Include a mobile view for the Dashboard.

---

## Screenshots to capture and attach

Run `npm run dev` (localhost:5173), log in, and take these 5 screenshots:

1. **Dashboard** — full page, all cards populated (take in afternoon so morning slot shows as overdue)
2. **Medications tab** — full page, morning slot expanded showing 2–3 medications
3. **Well-being tab** — 7-day chart view with at least 2 charts visible
4. **Habits tab** — daily + weekly sections with a few habits logged
5. **Sidebar close-up** — just the nav sidebar with Medications tab active (teal accent state)

Attach all 5 to give Claude Design the full current-state context.
