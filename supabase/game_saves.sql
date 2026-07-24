-- Run once in the shared CBAware Supabase SQL editor.
-- Game cloud saves, keyed like Aware users (google_id), not auth.users.

CREATE TABLE IF NOT EXISTS game_saves (
  google_id TEXT PRIMARY KEY,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS game_saves_updated_at_idx
  ON game_saves (updated_at DESC);

COMMENT ON TABLE game_saves IS
  'Toppjakt The Game player save blob (PlayerStats JSON). Linked via Google id shared with Aware users.google_id.';
