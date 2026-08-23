-- Item 45 — Guild Shop (limites por playerId+offerId+cycleId; sem Guild Coin).
-- Apply: psql "$DATABASE_URL" -f drizzle/0003_guild_shop.sql

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
