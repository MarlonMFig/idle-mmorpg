import type { AuthenticatedUser } from '@/server/social/auth-player';

/** Stable local-only identity for `next dev` (no Supabase). */
export const LOCAL_DEV_AUTH_USER: AuthenticatedUser = {
  id: 'local-dev-player',
  name: 'Shinobi Local',
  username: 'local',
  email: null,
};

/**
 * Supabase is used in production and when explicitly opted in on localhost.
 * Set `NEXT_PUBLIC_USE_SUPABASE_LOCAL=1` in `.env.local` to test Supabase locally.
 */
export function shouldUseSupabase(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return process.env.NEXT_PUBLIC_USE_SUPABASE_LOCAL === '1';
}

export function isLocalGameplayRuntime(): boolean {
  return !shouldUseSupabase();
}
