/** SQL bootstrap idempotente — migration v1 social. */
export const SOCIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS players (
  id text PRIMARY KEY,
  nickname text NOT NULL,
  token_hash text,
  linked_auth_provider text,
  linked_auth_subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS players_linked_auth_uidx
  ON players (linked_auth_provider, linked_auth_subject);
CREATE TABLE IF NOT EXISTS player_saves (
  player_id text PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS player_saves_updated_idx ON player_saves (updated_at);
CREATE TABLE IF NOT EXISTS api_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ranking_snapshots (
  player_id text PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  player_level integer NOT NULL DEFAULT 1,
  level_xp integer NOT NULL DEFAULT 0,
  total_xp bigint NOT NULL DEFAULT 0,
  account_power integer NOT NULL DEFAULT 0,
  account_power_provisional boolean NOT NULL DEFAULT true,
  total_mastery integer NOT NULL DEFAULT 0,
  unique_characters integer NOT NULL DEFAULT 0,
  collection_rarity_score integer NOT NULL DEFAULT 0,
  online_kills integer NOT NULL DEFAULT 0,
  lineage_id text,
  lineage_rank integer NOT NULL DEFAULT 0,
  specialization_id text,
  specialization_level integer NOT NULL DEFAULT 0,
  lineage_online_kills integer NOT NULL DEFAULT 0,
  equipped_title_id text,
  boss_best jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ranking_level_idx ON ranking_snapshots (player_level);
CREATE INDEX IF NOT EXISTS ranking_power_idx ON ranking_snapshots (account_power);
CREATE INDEX IF NOT EXISTS ranking_mastery_idx ON ranking_snapshots (total_mastery);
CREATE INDEX IF NOT EXISTS ranking_collection_idx ON ranking_snapshots (unique_characters);
CREATE INDEX IF NOT EXISTS ranking_kills_idx ON ranking_snapshots (online_kills);
CREATE INDEX IF NOT EXISTS ranking_lineage_idx ON ranking_snapshots (lineage_id, lineage_rank);

CREATE TABLE IF NOT EXISTS guilds (
  id text PRIMARY KEY,
  name text NOT NULL,
  name_normalized text NOT NULL,
  tag text NOT NULL,
  description text NOT NULL DEFAULT '',
  level integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  leader_id text NOT NULL REFERENCES players(id),
  join_mode text NOT NULL DEFAULT 'open',
  member_limit integer NOT NULL DEFAULT 30,
  member_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS guilds_name_uidx ON guilds (name_normalized);
CREATE UNIQUE INDEX IF NOT EXISTS guilds_tag_uidx ON guilds (tag);
CREATE INDEX IF NOT EXISTS guilds_level_idx ON guilds (level);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id text NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  nickname text NOT NULL,
  contribution integer NOT NULL DEFAULT 0,
  player_level integer NOT NULL DEFAULT 1,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, player_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS guild_members_player_uidx ON guild_members (player_id);
CREATE INDEX IF NOT EXISTS guild_members_guild_idx ON guild_members (guild_id);

CREATE TABLE IF NOT EXISTS guild_online_kill_limits (
  player_id text PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  cycle_id text NOT NULL,
  granted_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_online_kill_limits_cycle_idx
  ON guild_online_kill_limits (cycle_id);

CREATE TABLE IF NOT EXISTS guild_applications (
  guild_id text NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  player_level integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, player_id)
);
CREATE INDEX IF NOT EXISTS guild_applications_status_idx ON guild_applications (guild_id, status);

CREATE TABLE IF NOT EXISTS guild_activities (
  id text PRIMARY KEY,
  guild_id text NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  type text NOT NULL,
  actor_id text,
  target_id text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_activities_guild_idx ON guild_activities (guild_id, created_at);

CREATE TABLE IF NOT EXISTS guild_boss_cycles (
  id text PRIMARY KEY,
  guild_id text NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  boss_id text NOT NULL,
  definition_id text NOT NULL,
  cycle_id text NOT NULL,
  max_hp integer NOT NULL,
  current_hp integer NOT NULL,
  status text NOT NULL DEFAULT 'AVAILABLE',
  started_at timestamptz,
  defeated_at timestamptz,
  total_damage integer NOT NULL DEFAULT 0,
  reached_milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  guild_xp_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS guild_boss_cycle_uidx ON guild_boss_cycles (guild_id, boss_id, cycle_id);
CREATE INDEX IF NOT EXISTS guild_boss_guild_idx ON guild_boss_cycles (guild_id);

CREATE TABLE IF NOT EXISTS guild_boss_participants (
  cycle_row_id text NOT NULL REFERENCES guild_boss_cycles(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  attempts_used integer NOT NULL DEFAULT 0,
  attempts_reset_cycle_id text,
  total_damage integer NOT NULL DEFAULT 0,
  best_attempt_damage integer NOT NULL DEFAULT 0,
  participated boolean NOT NULL DEFAULT false,
  eligible_participation boolean NOT NULL DEFAULT false,
  eligible_defeat boolean NOT NULL DEFAULT false,
  claimed_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (cycle_row_id, player_id)
);

CREATE TABLE IF NOT EXISTS guild_boss_attempts (
  id text PRIMARY KEY,
  cycle_row_id text NOT NULL REFERENCES guild_boss_cycles(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  submitted_damage integer,
  accepted_damage integer,
  end_reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS guild_boss_attempts_cycle_idx ON guild_boss_attempts (cycle_row_id);
CREATE INDEX IF NOT EXISTS guild_boss_attempts_player_idx ON guild_boss_attempts (player_id, status);

CREATE TABLE IF NOT EXISTS guild_boss_pending_claims (
  claim_id text PRIMARY KEY,
  cycle_row_id text NOT NULL REFERENCES guild_boss_cycles(id) ON DELETE CASCADE,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind text NOT NULL,
  milestone_id text,
  rewards_json jsonb NOT NULL,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_boss_claims_player_idx ON guild_boss_pending_claims (cycle_row_id, player_id);

-- Item 44 — World Boss global
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

-- Item 45 — Guild Shop (limites por player; sem Guild Coin)
CREATE TABLE IF NOT EXISTS guild_shop_purchases (
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  offer_id text NOT NULL,
  cycle_id text NOT NULL,
  bought integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, offer_id, cycle_id)
);

CREATE TABLE IF NOT EXISTS guild_shop_transactions (
  transaction_id text PRIMARY KEY,
  player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  offer_id text NOT NULL,
  cycle_id text NOT NULL,
  price integer NOT NULL,
  quantity integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guild_shop_tx_player_idx ON guild_shop_transactions (player_id, created_at);
`;
