-- Migration 0005_player_saves — cloud save linked to Neon Auth player

CREATE TABLE IF NOT EXISTS player_saves (
  player_id text PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_saves_updated_idx ON player_saves (updated_at);
