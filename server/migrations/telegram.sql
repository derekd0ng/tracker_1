-- Run this once in your Supabase / Postgres database

CREATE TABLE IF NOT EXISTS telegram_connections (
  user_id     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  chat_id     BIGINT      NOT NULL UNIQUE,
  connected_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS telegram_link_codes (
  code        TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
