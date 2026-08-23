import type { RankingCategoryDefinition } from '@/types/ranking';

/**
 * Registry central de categorias.
 * Sort e tie-breakers vivem aqui — a UI não ordena.
 */
export const RANKING_CATEGORIES: readonly RankingCategoryDefinition[] = [
  {
    id: 'general',
    name: 'Geral',
    metric: 'accountPower',
    sortDirection: 'desc',
    tieBreakers: ['playerLevel', 'totalXp', 'onlineKills', 'nickname'],
    formatter: 'power',
  },
  {
    id: 'level',
    name: 'Level',
    metric: 'playerLevel',
    sortDirection: 'desc',
    tieBreakers: ['totalXp', 'nickname'],
    formatter: 'level',
  },
  {
    id: 'power',
    name: 'Poder',
    metric: 'accountPower',
    sortDirection: 'desc',
    tieBreakers: ['playerLevel', 'totalXp', 'nickname'],
    formatter: 'power',
  },
  {
    id: 'mastery',
    name: 'Maestria',
    metric: 'totalMastery',
    sortDirection: 'desc',
    tieBreakers: ['uniqueCharacters', 'playerLevel', 'nickname'],
    formatter: 'mastery',
  },
  {
    id: 'collection',
    name: 'Coleção',
    metric: 'uniqueCharacters',
    sortDirection: 'desc',
    tieBreakers: ['collectionRarityScore', 'playerLevel', 'nickname'],
    formatter: 'collection',
  },
  {
    id: 'kills',
    name: 'Kills',
    metric: 'onlineKills',
    sortDirection: 'desc',
    tieBreakers: ['playerLevel', 'totalXp', 'nickname'],
    formatter: 'kills',
  },
  {
    id: 'lineage',
    name: 'Linhagem',
    metric: 'lineageComposite',
    sortDirection: 'desc',
    tieBreakers: ['lineageRank', 'specializationLevel', 'lineageOnlineKills', 'nickname'],
    formatter: 'lineage',
  },
  {
    id: 'boss',
    name: 'Boss',
    metric: 'bossBest',
    sortDirection: 'asc',
    tieBreakers: ['bossTimeMs', 'bossDamage', 'nickname'],
    formatter: 'bossTime',
  },
];

export function getRankingCategory(id: string): RankingCategoryDefinition | null {
  return RANKING_CATEGORIES.find((row) => row.id === id) ?? null;
}

export function listRankingCategories(): readonly RankingCategoryDefinition[] {
  return RANKING_CATEGORIES;
}
