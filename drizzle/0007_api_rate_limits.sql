-- Migration 0007_api_rate_limits — shared rate limits across app instances

CREATE TABLE IF NOT EXISTS api_rate_limits (
  key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0
);
