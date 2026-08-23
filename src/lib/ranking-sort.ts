import { getBossDefinition } from '@/data/bosses/boss-registry';
import { getRankingCategory } from '@/data/ranking/ranking-categories';
import { profilePrimaryValue } from '@/lib/ranking-metrics';
import type {
  RankingCategoryId,
  RankingEntry,
  RankingPlayerProfile,
  RankingQuery,
  RankingSortDirection,
  RankingTieBreakerId,
} from '@/types/ranking';
import type { LineageId } from '@/types/character-meta';

function tieValue(profile: RankingPlayerProfile, key: RankingTieBreakerId, bossId?: string | null): number | string {
  switch (key) {
    case 'totalXp':
      return profile.totalXp;
    case 'playerLevel':
      return profile.playerLevel;
    case 'onlineKills':
      return profile.onlineKills;
    case 'uniqueCharacters':
      return profile.uniqueCharacters;
    case 'collectionRarityScore':
      return profile.collectionRarityScore;
    case 'accountPower':
      return profile.accountPower;
    case 'lineageRank':
      return profile.lineageRank;
    case 'specializationLevel':
      return profile.specializationLevel;
    case 'lineageOnlineKills':
      return profile.lineageOnlineKills;
    case 'bossTimeMs':
      return profile.bossBest[bossId ?? '']?.bestTimeMs ?? Number.POSITIVE_INFINITY;
    case 'bossDamage':
      return profile.bossBest[bossId ?? '']?.bestDamage ?? 0;
    case 'nickname':
      return profile.nickname.toLowerCase();
    default:
      return 0;
  }
}

function compareTie(
  a: RankingPlayerProfile,
  b: RankingPlayerProfile,
  keys: readonly RankingTieBreakerId[],
  bossId?: string | null,
): number {
  for (const key of keys) {
    const av = tieValue(a, key, bossId);
    const bv = tieValue(b, key, bossId);
    if (typeof av === 'string' && typeof bv === 'string') {
      if (av < bv) return -1;
      if (av > bv) return 1;
      continue;
    }
    const an = Number(av);
    const bn = Number(bv);
    // tempos: menor é melhor (já tratado no primary ASC); nos ties de time, menor ganha
    if (key === 'bossTimeMs') {
      if (an < bn) return -1;
      if (an > bn) return 1;
      continue;
    }
    if (an > bn) return -1;
    if (an < bn) return 1;
  }
  return 0;
}

function comparePrimary(
  a: number,
  b: number,
  direction: RankingSortDirection,
): number {
  if (direction === 'asc') {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  if (a > b) return -1;
  if (a < b) return 1;
  return 0;
}

export function filterProfiles(
  profiles: readonly RankingPlayerProfile[],
  categoryId: RankingCategoryId,
  lineageFilter: LineageId | 'all' = 'all',
  bossId?: string | null,
): RankingPlayerProfile[] {
  let list = [...profiles];
  if (categoryId === 'lineage') {
    list = list.filter((p) => p.lineageId != null);
    if (lineageFilter !== 'all') {
      list = list.filter((p) => p.lineageId === lineageFilter);
    }
  }
  if (categoryId === 'boss') {
    const def = bossId ? getBossDefinition(bossId) : null;
    const mode = def?.rankingMode ?? 'fastestKill';
    if (!bossId || mode === 'none') return [];
    list = list.filter((p) => {
      const best = p.bossBest[bossId];
      if (!best) return false;
      if (mode === 'fastestKill') return best.victory && best.bestTimeMs != null;
      return best.bestDamage > 0;
    });
  }
  return list;
}

export function sortProfiles(
  profiles: readonly RankingPlayerProfile[],
  categoryId: RankingCategoryId,
  bossId?: string | null,
): Array<{ profile: RankingPlayerProfile; value: number }> {
  const cat = getRankingCategory(categoryId);
  if (!cat) return [];
  const def = bossId ? getBossDefinition(bossId) : null;
  const mode = def?.rankingMode ?? 'fastestKill';
  const direction: RankingSortDirection =
    categoryId === 'boss' && mode === 'highestDamage' ? 'desc' : cat.sortDirection;

  const scored: Array<{ profile: RankingPlayerProfile; value: number }> = [];
  for (const profile of profiles) {
    const value = profilePrimaryValue(profile, cat.metric, { bossId, rankingMode: mode });
    if (value == null || !Number.isFinite(value)) continue;
    scored.push({ profile, value });
  }

  scored.sort((a, b) => {
    const primary = comparePrimary(a.value, b.value, direction);
    if (primary !== 0) return primary;
    return compareTie(a.profile, b.profile, cat.tieBreakers, bossId);
  });
  return scored;
}

export function assignRanks(
  scored: Array<{ profile: RankingPlayerProfile; value: number }>,
  categoryId: RankingCategoryId,
  bossId?: string | null,
): RankingEntry[] {
  return scored.map((row, index) => {
    const p = row.profile;
    const entry: RankingEntry = {
      playerId: p.playerId,
      nickname: p.nickname,
      value: row.value,
      rank: index + 1,
      titleId: p.equippedTitleId,
      lineageId: p.lineageId,
      metadata: {
        playerLevel: p.playerLevel,
      },
    };
    if (categoryId === 'lineage') {
      entry.metadata.specializationLevel = p.specializationLevel;
      entry.metadata.lineageRank = p.lineageRank;
    }
    if (categoryId === 'boss' && bossId) {
      const best = p.bossBest[bossId];
      entry.metadata.bossId = bossId;
      entry.metadata.bossTimeMs = best?.bestTimeMs ?? null;
      entry.metadata.bossDamage = best?.bestDamage ?? 0;
    }
    return entry;
  });
}

export function buildBoardFromProfiles(
  profiles: readonly RankingPlayerProfile[],
  query: RankingQuery,
  localPlayerId: string | null,
): {
  entries: RankingEntry[];
  totalEntries: number;
  myRank: number | null;
  myEntry: RankingEntry | null;
} {
  const page = Math.max(0, query.page ?? 0);
  const pageSize = Math.max(1, query.pageSize ?? 100);
  const filtered = filterProfiles(
    profiles,
    query.categoryId,
    query.lineageFilter ?? 'all',
    query.bossId,
  );
  const scored = sortProfiles(filtered, query.categoryId, query.bossId);
  const ranked = assignRanks(scored, query.categoryId, query.bossId);
  const top = ranked.slice(0, 100);
  const pageEntries = top.slice(page * pageSize, page * pageSize + pageSize);

  let myRank: number | null = null;
  let myEntry: RankingEntry | null = null;
  if (localPlayerId) {
    const found = ranked.find((row) => row.playerId === localPlayerId);
    if (found) {
      myRank = found.rank;
      myEntry = found;
    }
  }

  return {
    entries: pageEntries,
    totalEntries: ranked.length,
    myRank,
    myEntry,
  };
}
