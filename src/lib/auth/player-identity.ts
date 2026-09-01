let activePlayerId: string | null = null;

export function setAuthPlayerIdentity(authUserId: string): string {
  const normalized = authUserId.trim();
  activePlayerId = normalized ? `p-supabase-${normalized}` : null;
  return activePlayerId ?? '';
}

export function getAuthPlayerId(): string | null {
  return activePlayerId;
}
