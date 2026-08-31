import { desc, eq } from 'drizzle-orm';
import type { SocialDb } from '@/server/db/client';
import { playerSaves } from '@/server/db/schema';

export const MAX_SAVE_BYTES = 1_000_000;

export interface CloudSavePayload {
  version: number;
  player: {
    nickname: string;
    villageId: string;
    starterCharacterId: string;
  };
  [key: string]: unknown;
}

function objectField(payload: CloudSavePayload, key: string): Record<string, unknown> | null {
  const value = payload[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isCloudSavePayload(value: unknown): value is CloudSavePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  const player = payload.player;
  if (typeof payload.version !== 'number' || !Number.isInteger(payload.version)) return false;
  if (!player || typeof player !== 'object' || Array.isArray(player)) return false;
  const playerRecord = player as Record<string, unknown>;
  return (
    typeof playerRecord.nickname === 'string' &&
    playerRecord.nickname.length > 0 &&
    playerRecord.nickname.length <= 24 &&
    typeof playerRecord.villageId === 'string' &&
    typeof playerRecord.starterCharacterId === 'string'
  );
}

export async function getPlayerSave(
  db: SocialDb,
  playerId: string,
): Promise<{ payload: CloudSavePayload; updatedAt: Date } | null> {
  const rows = await db
    .select({
      payload: playerSaves.payload,
      updatedAt: playerSaves.updatedAt,
    })
    .from(playerSaves)
    .where(eq(playerSaves.playerId, playerId))
    .orderBy(desc(playerSaves.updatedAt))
    .limit(1);
  const row = rows[0];
  return row && isCloudSavePayload(row.payload)
    ? { payload: row.payload, updatedAt: row.updatedAt }
    : null;
}

export async function upsertPlayerSave(
  db: SocialDb,
  playerId: string,
  payload: CloudSavePayload,
): Promise<{ updatedAt: Date; payload: CloudSavePayload }> {
  const currentRows = await db
    .select({ payload: playerSaves.payload })
    .from(playerSaves)
    .where(eq(playerSaves.playerId, playerId))
    .for('update')
    .limit(1);
  const current = currentRows[0]?.payload;
  const nextPayload =
    current && isCloudSavePayload(current)
      ? {
          ...payload,
          // Economic and progression counters are server-owned. Client saves may
          // still update location/UI metadata, but cannot mint currency, items,
          // XP, or reset reward idempotency.
          vitals: {
            ...(objectField(payload, 'vitals') ?? {}),
            ...(objectField(current, 'vitals') ?? {}),
          },
          inventory: current['inventory'],
          gems: current['gems'],
          rewardTransactions: current['rewardTransactions'],
        }
      : payload;
  const updatedAt = new Date();
  await db
    .insert(playerSaves)
    .values({ playerId, payload: nextPayload, updatedAt })
    .onConflictDoUpdate({
      target: playerSaves.playerId,
      set: { payload: nextPayload, updatedAt },
    });
  return { updatedAt, payload: nextPayload };
}

/**
 * Conservative server-side damage budget for one attempt. The browser may
 * report combat progress, but it cannot exceed a budget derived from the
 * authenticated cloud snapshot and elapsed attempt time.
 */
export async function getServerCombatDamageCap(
  db: SocialDb,
  playerId: string,
  elapsedMs: number,
  maxDurationMs: number,
): Promise<number | null> {
  const saved = await getPlayerSave(db, playerId);
  if (!saved) return null;
  const vitals =
    saved.payload.vitals && typeof saved.payload.vitals === 'object'
      ? (saved.payload.vitals as Record<string, unknown>)
      : {};
  const team =
    saved.payload.team && typeof saved.payload.team === 'object'
      ? (saved.payload.team as Record<string, unknown>)
      : {};
  const level =
    typeof vitals.level === 'number' && Number.isFinite(vitals.level)
      ? Math.max(1, Math.min(9999, Math.floor(vitals.level)))
      : 1;
  const collection = Array.isArray(team.collection) ? team.collection : [];
  let mastery = 0;
  const characters = new Set<string>();
  for (const raw of collection) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const row = raw as Record<string, unknown>;
    if (typeof row.characterId === 'string') characters.add(row.characterId);
    if (typeof row.masteryLevel === 'number' && Number.isFinite(row.masteryLevel)) {
      mastery += Math.max(0, Math.min(1_000_000, Math.floor(row.masteryLevel)));
    }
  }
  const damagePerSecond = 1_000 + level * 500 + mastery * 50 + characters.size * 100;
  const seconds = Math.max(1, Math.min(maxDurationMs, Math.max(0, elapsedMs)) / 1_000);
  return Math.floor(damagePerSecond * seconds);
}

export async function getServerPlayerLevel(db: SocialDb, playerId: string): Promise<number> {
  const saved = await getPlayerSave(db, playerId);
  if (!saved) return 1;
  const vitals =
    saved.payload.vitals && typeof saved.payload.vitals === 'object'
      ? (saved.payload.vitals as Record<string, unknown>)
      : {};
  return typeof vitals.level === 'number' && Number.isFinite(vitals.level)
    ? Math.max(1, Math.min(9999, Math.floor(vitals.level)))
    : 1;
}
