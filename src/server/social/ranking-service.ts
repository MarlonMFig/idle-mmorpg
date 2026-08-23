import type { SocialDb } from '@/server/db/client';
import { rankingSnapshots } from '@/server/db/schema';
import { buildBoardFromProfiles } from '@/lib/ranking-sort';
import type {
  RankingBoardResult,
  RankingPlayerProfile,
  RankingQuery,
} from '@/types/ranking';
import { RANKING_TOP_LIMIT } from '@/types/ranking';
import { LINEAGE_IDS, type LineageId } from '@/types/character-meta';
import { SocialError } from '@/server/social/errors';

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseLineageId(value: unknown): LineageId | null {
  return typeof value === 'string' && (LINEAGE_IDS as readonly string[]).includes(value)
    ? (value as LineageId)
    : null;
}

export function validateRankingProfile(
  raw: unknown,
  expectedPlayerId: string,
): RankingPlayerProfile {
  if (!raw || typeof raw !== 'object') {
    throw new SocialError('VALIDATION', 'Profile inválido.');
  }
  const p = raw as Record<string, unknown>;
  if (p.playerId !== expectedPlayerId) {
    throw new SocialError('FORBIDDEN', 'playerId do profile não corresponde à sessão.', 403);
  }
  const nickname = typeof p.nickname === 'string' ? p.nickname.trim().slice(0, 24) : '';
  if (!nickname) throw new SocialError('VALIDATION', 'nickname obrigatório.');

  const bossBest =
    p.bossBest && typeof p.bossBest === 'object' && !Array.isArray(p.bossBest)
      ? (p.bossBest as RankingPlayerProfile['bossBest'])
      : {};

  return {
    playerId: expectedPlayerId,
    nickname,
    playerLevel: clampInt(p.playerLevel, 1, 9999, 1),
    levelXp: clampInt(p.levelXp, 0, 1_000_000_000, 0),
    totalXp: clampInt(p.totalXp, 0, Number.MAX_SAFE_INTEGER, 0),
    accountPower: clampInt(p.accountPower, 0, 1_000_000_000, 0),
    accountPowerProvisional: p.accountPowerProvisional !== false,
    totalMastery: clampInt(p.totalMastery, 0, 1_000_000, 0),
    uniqueCharacters: clampInt(p.uniqueCharacters, 0, 100_000, 0),
    collectionRarityScore: clampInt(p.collectionRarityScore, 0, 1_000_000_000, 0),
    onlineKills: clampInt(p.onlineKills, 0, 1_000_000_000, 0),
    lineageId: parseLineageId(p.lineageId),
    lineageRank: clampInt(p.lineageRank, 0, 99, 0),
    specializationId: typeof p.specializationId === 'string' ? p.specializationId : null,
    specializationLevel: clampInt(p.specializationLevel, 0, 99, 0),
    lineageOnlineKills: clampInt(p.lineageOnlineKills, 0, 1_000_000_000, 0),
    equippedTitleId: typeof p.equippedTitleId === 'string' ? p.equippedTitleId : null,
    bossBest,
  };
}

function rowToProfile(row: typeof rankingSnapshots.$inferSelect): RankingPlayerProfile {
  return {
    playerId: row.playerId,
    nickname: row.nickname,
    playerLevel: row.playerLevel,
    levelXp: row.levelXp,
    totalXp: Number(row.totalXp),
    accountPower: row.accountPower,
    accountPowerProvisional: row.accountPowerProvisional,
    totalMastery: row.totalMastery,
    uniqueCharacters: row.uniqueCharacters,
    collectionRarityScore: row.collectionRarityScore,
    onlineKills: row.onlineKills,
    lineageId: (row.lineageId as RankingPlayerProfile['lineageId']) ?? null,
    lineageRank: row.lineageRank,
    specializationId: row.specializationId,
    specializationLevel: row.specializationLevel,
    lineageOnlineKills: row.lineageOnlineKills,
    equippedTitleId: row.equippedTitleId,
    bossBest: (row.bossBest as RankingPlayerProfile['bossBest']) ?? {},
  };
}

export async function upsertRankingSnapshot(
  db: SocialDb,
  profile: RankingPlayerProfile,
): Promise<void> {
  const values = {
    playerId: profile.playerId,
    nickname: profile.nickname,
    playerLevel: profile.playerLevel,
    levelXp: profile.levelXp,
    totalXp: profile.totalXp,
    accountPower: profile.accountPower,
    accountPowerProvisional: profile.accountPowerProvisional,
    totalMastery: profile.totalMastery,
    uniqueCharacters: profile.uniqueCharacters,
    collectionRarityScore: profile.collectionRarityScore,
    onlineKills: profile.onlineKills,
    lineageId: profile.lineageId,
    lineageRank: profile.lineageRank,
    specializationId: profile.specializationId,
    specializationLevel: profile.specializationLevel,
    lineageOnlineKills: profile.lineageOnlineKills,
    equippedTitleId: profile.equippedTitleId,
    bossBest: profile.bossBest,
    updatedAt: new Date(),
  };
  await db
    .insert(rankingSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: rankingSnapshots.playerId,
      set: values,
    });
}

export async function listRankingProfiles(db: SocialDb): Promise<RankingPlayerProfile[]> {
  const rows = await db.select().from(rankingSnapshots);
  return rows.map(rowToProfile);
}

export async function getRankingBoard(
  db: SocialDb,
  query: RankingQuery,
  viewerId?: string | null,
): Promise<RankingBoardResult> {
  const started = Date.now();
  const profiles = await listRankingProfiles(db);
  const pageSize = Math.min(RANKING_TOP_LIMIT, Math.max(1, query.pageSize ?? RANKING_TOP_LIMIT));
  const page = Math.max(0, query.page ?? 0);
  const built = buildBoardFromProfiles(profiles, { ...query, page, pageSize }, viewerId ?? null);
  return {
    categoryId: query.categoryId,
    entries: built.entries,
    totalEntries: built.totalEntries,
    page,
    pageSize,
    myRank: built.myRank,
    myEntry: built.myEntry,
    refreshedAt: Date.now(),
    queryMs: Date.now() - started,
    empty: built.totalEntries === 0,
  };
}

export async function getPlayerRank(
  db: SocialDb,
  query: RankingQuery,
  playerId: string,
): Promise<number | null> {
  const board = await getRankingBoard(db, { ...query, page: 0, pageSize: RANKING_TOP_LIMIT }, playerId);
  return board.myRank;
}
