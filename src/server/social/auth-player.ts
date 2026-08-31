import { and, eq } from 'drizzle-orm';
import type { SocialDb } from '@/server/db/client';
import { players } from '@/server/db/schema';

const AUTH_PROVIDER = 'neon-auth';

export interface AuthenticatedUser {
  id: string;
  name?: string | null;
  email?: string | null;
}

export async function getOrCreateAuthPlayer(
  db: SocialDb,
  user: AuthenticatedUser,
): Promise<{ playerId: string; nickname: string }> {
  const existing = await db
    .select()
    .from(players)
    .where(
      and(eq(players.linkedAuthProvider, AUTH_PROVIDER), eq(players.linkedAuthSubject, user.id)),
    )
    .limit(1);

  const nickname = user.name?.trim().slice(0, 24) || 'Shinobi';
  if (existing[0]) {
    if (existing[0].nickname !== nickname) {
      await db
        .update(players)
        .set({ nickname, updatedAt: new Date() })
        .where(eq(players.id, existing[0].id));
    }
    return { playerId: existing[0].id, nickname };
  }

  const playerId = `p-neon-${user.id}`;
  await db
    .insert(players)
    .values({
      id: playerId,
      nickname,
      tokenHash: null,
      linkedAuthProvider: AUTH_PROVIDER,
      linkedAuthSubject: user.id,
    })
    .onConflictDoNothing();

  const created = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!created[0]) {
    throw new Error('Não foi possível criar o jogador autenticado.');
  }
  return { playerId: created[0].id, nickname: created[0].nickname };
}
