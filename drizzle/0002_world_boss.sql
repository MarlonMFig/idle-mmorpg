-- Item 44 — World Boss global (server-authoritative).
-- Apply: psql "$DATABASE_URL" -f drizzle/0002_world_boss.sql

CREATE TABLE IF NOT EXISTS world_boss_cycles (
  id text PRIMARY KEY,
  boss_id text NOT NULL,
  definition_id text NOT NULL,
  cycle_id text NOT NULL,
  max_hp bigint NOT NULL,
  current_hp bigint NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  started_at timestamptz,
  ends_at timestamptz,
  defeated_at timestamptz,
  total_damage bigint NOT NULL DEFAULT 0,
  participant_count integer NOT NULL DEFAULT 0,
  reached_milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS world_boss_cycle_uidx ON world_boss_cycles (boss_id, cycle_id);
CREATE INDEX IF NOT EXISTS world_boss_status_idx ON world_boss_cycles (status);

CREATE TABLE IF NOT EXISTS world_boss_participants (
  cycle_row_id text NOT NULL REFERENCES world_boss_cycles(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  attempts_used integer NOT NULL DEFAULT 0,
  attempts_reset_cycle_id text,
  total_damage bigint NOT NULL DEFAULT 0,
  best_attempt_damage bigint NOT NULL DEFAULT 0,
  participated boolean NOT NULL DEFAULT false,
  eligible_participation boolean NOT NULL DEFAULT false,
  eligible_defeat boolean NOT NULL DEFAULT false,
  claimed_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_updated_at bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (cycle_row_id, player_id)
);
CREATE INDEX IF NOT EXISTS world_boss_rank_idx ON world_boss_participants (cycle_row_id, total_damage, best_attempt_damage, score_updated_at);

CREATE TABLE IF NOT EXISTS world_boss_attempts (
  id text PRIMARY KEY,
  cycle_row_id text NOT NULL REFERENCES world_boss_cycles(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  submitted_damage bigint,
  accepted_damage bigint,
  end_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS world_boss_attempts_cycle_idx ON world_boss_attempts (cycle_row_id);
CREATE INDEX IF NOT EXISTS world_boss_attempts_player_idx ON world_boss_attempts (player_id, status);

CREATE TABLE IF NOT EXISTS world_boss_pending_claims (
  claim_id text PRIMARY KEY,
  cycle_row_id text NOT NULL REFERENCES world_boss_cycles(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind text NOT NULL,
  milestone_id text,
  rewards_json jsonb NOT NULL,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS world_boss_claims_player_idx ON world_boss_pending_claims (cycle_row_id, player_id);
