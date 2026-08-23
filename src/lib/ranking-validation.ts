import { getBossDefinition, listBossDefinitions } from '@/data/bosses/boss-registry';
import { listRankingCategories } from '@/data/ranking/ranking-categories';
import { RANKING_CATEGORY_IDS, type RankingTieBreakerId } from '@/types/ranking';

const METRICS = new Set([
  'accountPower',
  'playerLevel',
  'totalMastery',
  'uniqueCharacters',
  'onlineKills',
  'lineageComposite',
  'bossBest',
]);

const TIE_BREAKERS = new Set<RankingTieBreakerId>([
  'totalXp',
  'playerLevel',
  'onlineKills',
  'uniqueCharacters',
  'collectionRarityScore',
  'accountPower',
  'lineageRank',
  'specializationLevel',
  'lineageOnlineKills',
  'bossTimeMs',
  'bossDamage',
  'nickname',
]);

const SORT = new Set(['asc', 'desc']);
const BOSS_MODES = new Set(['fastestKill', 'highestDamage', 'none']);

export function validateRankingCatalog(): string[] {
  const warnings: string[] = [];
  const ids = new Set<string>();
  for (const cat of listRankingCategories()) {
    if (ids.has(cat.id)) warnings.push(`[RankingValidation] category duplicada: ${cat.id}`);
    ids.add(cat.id);
    if (!(RANKING_CATEGORY_IDS as readonly string[]).includes(cat.id)) {
      warnings.push(`[RankingValidation] id desconhecido: ${cat.id}`);
    }
    if (!METRICS.has(cat.metric)) warnings.push(`[RankingValidation] ${cat.id} metric inválida`);
    if (!SORT.has(cat.sortDirection)) {
      warnings.push(`[RankingValidation] ${cat.id} sortDirection inválido`);
    }
    if (!cat.tieBreakers.length) {
      warnings.push(`[RankingValidation] ${cat.id} sem tieBreakers`);
    }
    for (const tb of cat.tieBreakers) {
      if (!TIE_BREAKERS.has(tb)) {
        warnings.push(`[RankingValidation] ${cat.id} tieBreaker inválido: ${tb}`);
      }
    }
  }
  for (const id of RANKING_CATEGORY_IDS) {
    if (!ids.has(id)) warnings.push(`[RankingValidation] falta categoria ${id}`);
  }
  for (const boss of listBossDefinitions()) {
    const mode = boss.rankingMode ?? 'none';
    if (!BOSS_MODES.has(mode)) {
      warnings.push(`[RankingValidation] boss ${boss.id} rankingMode inválido`);
    }
    if (!getBossDefinition(boss.id)) {
      warnings.push(`[RankingValidation] boss registry inconsistente: ${boss.id}`);
    }
  }
  return warnings;
}
