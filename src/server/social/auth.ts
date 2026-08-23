import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { SocialDb } from '@/server/db/client';
import { players } from '@/server/db/schema';
import { SocialError } from '@/server/social/errors';

export function hashPlayerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newPlayerId(): string {
  return `p-${randomUUID()}`;
}

export function newPlayerToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function registerGuest(
  db: SocialDb,
  input: { nickname: string; playerId?: string },
): Promise<{ playerId: string; token: string; nickname: string }> {
  const nickname = input.nickname.trim().slice(0, 24) || 'Shinobi';
  const playerId = input.playerId?.trim() || newPlayerId();
  const token = newPlayerToken();
  const tokenHash = hashPlayerToken(token);

  const existing = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (existing[0]) {
    throw new SocialError('CONFLICT', 'playerId já registrado. Use o token existente.', 409);
  }

  await db.insert(players).values({
    id: playerId,
    nickname,
    tokenHash,
  });

  return { playerId, token, nickname };
}

export async function authenticatePlayer(
  db: SocialDb,
  playerId: string | null | undefined,
  token: string | null | undefined,
): Promise<{ playerId: string; nickname: string }> {
  if (!playerId || !token) {
    throw new SocialError('UNAUTHORIZED', 'Autenticação necessária.', 401);
  }
  const rows = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  const row = rows[0];
  if (!row || row.tokenHash !== hashPlayerToken(token)) {
    throw new SocialError('UNAUTHORIZED', 'Token inválido.', 401);
  }
  return { playerId: row.id, nickname: row.nickname };
}

export function readAuthHeaders(req: Request): { playerId: string | null; token: string | null } {
  const playerId = req.headers.get('x-player-id');
  const token =
    req.headers.get('x-player-token') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    null;
  return { playerId, token };
}
