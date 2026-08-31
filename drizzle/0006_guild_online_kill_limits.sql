-- Migration 0006_guild_online_kill_limits — server-side guild XP budget

CREATE TABLE IF NOT EXISTS guild_online_kill_limits (
  player_id text PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  cycle_id text NOT NULL,
  granted_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guild_online_kill_limits_cycle_idx
  ON guild_online_kill_limits (cycle_id);
