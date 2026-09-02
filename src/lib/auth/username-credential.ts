/** Internal domain — not deliverable; maps username logins to Supabase email auth. */
const USERNAME_AUTH_DOMAIN = 'username.idle-mmorpg.local';

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return 'Nome de usuário deve ter entre 3 e 20 caracteres.';
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return 'Use apenas letras, números e sublinhado (_).';
  }
  return null;
}

export function usernameToAuthEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_AUTH_DOMAIN}`;
}

export function readUsernameFromMetadata(
  meta: Record<string, unknown> | undefined,
): string | null {
  if (typeof meta?.username === 'string' && meta.username.trim()) {
    return meta.username.trim();
  }
  return null;
}
