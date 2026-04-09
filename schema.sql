-- Recovery Tracker — PostgreSQL schema
-- Run this once against your Supabase / Railway Postgres instance.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Refresh tokens ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ── Medications ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medications (
  id                  TEXT        PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  dose                TEXT,
  start_date          TEXT,
  duration_days       INTEGER,
  times_of_day        TEXT[]      NOT NULL DEFAULT '{}',
  purpose             TEXT,
  prescribing_doctor  TEXT,
  notes               TEXT,
  active              BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_medications_user ON medications(user_id);

-- ── Medication logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medication_logs (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medication_id   TEXT    NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  date            TEXT    NOT NULL,
  time_of_day     TEXT    NOT NULL,
  taken           BOOLEAN NOT NULL DEFAULT false,
  taken_at        TEXT,
  skipped         BOOLEAN DEFAULT false,
  changed_at      BIGINT,
  UNIQUE(medication_id, date, time_of_day)
);
CREATE INDEX IF NOT EXISTS idx_med_logs_user_date ON medication_logs(user_id, date);

-- ── Habits ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habits (
  id            TEXT        PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  type          TEXT        NOT NULL CHECK (type IN ('boolean', 'numeric')),
  frequency     TEXT        NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  icon          TEXT,
  unit          TEXT,
  target        NUMERIC,
  weekly_target INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);

-- ── Habit logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS habit_logs (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id  TEXT    NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date      TEXT    NOT NULL,
  value     NUMERIC NOT NULL,
  UNIQUE(habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs(user_id, date);

-- ── Wellbeing entries ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wellbeing_entries (
  id            TEXT        PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT        NOT NULL,
  time          TEXT        NOT NULL,
  heart_rate    INTEGER,
  systolic_bp   INTEGER,
  diastolic_bp  INTEGER,
  spo2          NUMERIC,
  overall_feel  INTEGER     NOT NULL,
  symptoms      JSONB       NOT NULL DEFAULT '[]',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wellbeing_user_date ON wellbeing_entries(user_id, date);
