import { LOCAL_DEV_AUTH_USER, shouldUseSupabase } from '@/lib/auth/local-runtime';
import { readUsernameFromMetadata } from '@/lib/auth/username-credential';
import { createClient } from '@/lib/supabase/server';
import type { AuthenticatedUser } from '@/server/social/auth-player';

export async function getAuthUser(): Promise<AuthenticatedUser | null> {
  if (!shouldUseSupabase()) {
    return LOCAL_DEV_AUTH_USER;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const meta = data.user.user_metadata as Record<string, unknown> | undefined;
  const username = readUsernameFromMetadata(meta);
  const name =
    username ||
    (typeof meta?.name === 'string' && meta.name) ||
    (typeof meta?.full_name === 'string' && meta.full_name) ||
    null;

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    name,
    username,
  };
}
