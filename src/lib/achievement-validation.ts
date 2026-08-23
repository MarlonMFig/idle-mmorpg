import { ACHIEVEMENT_CATEGORIES } from '@/types/achievements';
import { listAchievementDefinitions } from '@/data/achievements/achievement-registry';
import { listTitleDefinitions, getTitleDefinition } from '@/data/achievements/title-registry';
import type { AchievementDefinition, TitleDefinition } from '@/types/achievements';

const VALID_CONDITION_TYPES = new Set([
  'playerLevel',
  'onlineKills',
  'uniqueCharacters',
  'characterStars',
  'characterMastery',
  'awakeningLevel',
  'hasLineage',
  'lineageRank',
  'hasSpecialization',
  'specializationLevel',
  'guildMembership',
  'huntProgress',
]);

const VALID_REWARD_TYPES = new Set(['copper', 'title']);

export function validateAchievementCatalog(): string[] {
  const warnings: string[] = [];
  const ids = new Set<string>();
  const categorySet = new Set<string>(ACHIEVEMENT_CATEGORIES);

  for (const def of listAchievementDefinitions()) {
    if (ids.has(def.id)) {
      warnings.push(`[AchievementValidation] ID duplicado: ${def.id}`);
    }
    ids.add(def.id);
    if (!categorySet.has(def.category)) {
      warnings.push(`[AchievementValidation] ${def.id} category inválida: ${def.category}`);
    }
    if (!VALID_CONDITION_TYPES.has(def.condition.type)) {
      warnings.push(`[AchievementValidation] ${def.id} condition inválida: ${def.condition.type}`);
    }
    for (const reward of def.rewards) {
      if (!VALID_REWARD_TYPES.has(reward.type)) {
        warnings.push(`[AchievementValidation] ${def.id} reward inválida: ${reward.type}`);
      }
      if (reward.type === 'title' && !getTitleDefinition(reward.id)) {
        warnings.push(`[AchievementValidation] ${def.id} titleId inexistente: ${reward.id}`);
      }
    }
    if (def.previousAchievementId && !ids.has(def.previousAchievementId)) {
      // previous may be defined later — check at end
    }
  }

  for (const def of listAchievementDefinitions()) {
    if (def.previousAchievementId && !ids.has(def.previousAchievementId)) {
      warnings.push(
        `[AchievementValidation] ${def.id} previousAchievementId inexistente: ${def.previousAchievementId}`,
      );
    }
  }

  const titleIds = new Set<string>();
  for (const title of listTitleDefinitions()) {
    if (titleIds.has(title.id)) {
      warnings.push(`[TitleValidation] ID duplicado: ${title.id}`);
    }
    titleIds.add(title.id);
    if ('stats' in title && (title as TitleDefinition & { stats?: unknown }).stats != null) {
      warnings.push(`[TitleValidation] ${title.id} não pode ter stats de combate.`);
    }
  }

  return warnings;
}
