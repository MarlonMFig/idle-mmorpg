-- Migration 0004_neon_auth_players — Neon Auth identities
-- Apply: npm run db:migrate:social

-- Existing Guest Account rows remain available for a future explicit migration.
-- New Neon Auth-linked players do not need a client-held token hash.
ALTER TABLE players
  ALTER COLUMN token_hash DROP NOT NULL;
