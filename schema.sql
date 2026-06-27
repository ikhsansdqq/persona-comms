-- Run once against your D1 database:
-- wrangler d1 execute personal-comms-d1 --file=schema.sql --remote

CREATE TABLE IF NOT EXISTS records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  update_id   INTEGER NOT NULL UNIQUE,
  chat_id     INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK(type IN ('todo', 'task', 'expense', 'unknown')),
  data        TEXT NOT NULL,
  raw_input   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_records_chat_type ON records (chat_id, type);
CREATE INDEX IF NOT EXISTS idx_records_created   ON records (chat_id, created_at);
