import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL required for Supabase and Railway Postgres
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected postgres pool error:', err);
});

export async function ensureCalendarTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT        NOT NULL,
      date        DATE        NOT NULL,
      start_time  TIME,
      end_time    TIME,
      description TEXT,
      color       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date
    ON calendar_events (user_id, date)
  `);
}

export async function ensureDiaryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS diary_entries (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date        DATE        NOT NULL,
      free_text   TEXT        NOT NULL DEFAULT '',
      prompts     JSONB       NOT NULL DEFAULT '{}',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, date)
    )
  `);
}

export async function ensureTodosTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT        NOT NULL,
      done        BOOLEAN     NOT NULL DEFAULT false,
      due_date    DATE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
