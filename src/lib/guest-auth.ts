/**
 * Guest Account persistente (Item 37).
 * playerId estável + token secreto no client.
 * Futuro: vincular a OAuth via linkedAuth* no servidor.
 */

const GUEST_AUTH_KEY = 'idle-mmorpg:guest-auth-v1';

export interface GuestAuthCredentials {
  playerId: string;
  token: string;
  nickname: string;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function loadGuestAuth(): GuestAuthCredentials | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(GUEST_AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GuestAuthCredentials;
    if (!data?.playerId || !data?.token) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGuestAuth(creds: GuestAuthCredentials): void {
  if (!canUseStorage()) return;
  localStorage.setItem(GUEST_AUTH_KEY, JSON.stringify(creds));
}

export async function ensureGuestAuth(nickname: string): Promise<GuestAuthCredentials> {
  const existing = loadGuestAuth();
  if (existing) {
    if (nickname && nickname !== existing.nickname) {
      const next = { ...existing, nickname };
      saveGuestAuth(next);
      return next;
    }
    return existing;
  }

  const res = await fetch('/api/social/auth/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: nickname || 'Shinobi' }),
  });
  const json = (await res.json()) as {
    ok?: boolean;
    playerId?: string;
    token?: string;
    nickname?: string;
    error?: string;
  };
  if (!res.ok || !json.playerId || !json.token) {
    throw new Error(json.error || 'Falha ao registrar Guest Account.');
  }
  const creds: GuestAuthCredentials = {
    playerId: json.playerId,
    token: json.token,
    nickname: json.nickname || nickname || 'Shinobi',
  };
  saveGuestAuth(creds);
  return creds;
}

export function guestAuthHeaders(creds?: GuestAuthCredentials | null): Record<string, string> {
  const c = creds ?? loadGuestAuth();
  if (!c) return {};
  return {
    'x-player-id': c.playerId,
    'x-player-token': c.token,
  };
}
