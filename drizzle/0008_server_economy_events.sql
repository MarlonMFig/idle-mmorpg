-- Migration 0008_server_economy_events — server-delivered economy ledger

CREATE TABLE IF NOT EXISTS server_economy_events (
  event_id text PRIMARY KEY,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  source text NOT NULL,
  rewards_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS server_economy_events_player_idx
  ON server_economy_events (player_id, created_at);

CREATE INDEX IF NOT EXISTS server_economy_events_source_idx
  ON server_economy_events (source, created_at);
