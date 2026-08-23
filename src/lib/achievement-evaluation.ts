import { listAchievementDefinitions } from '@/data/achievements/achievement-registry';
import type {
  AchievementCondition,
  AchievementDefinition,
  AchievementWorldSnapshot,
} from '@/types/achievements';

export interface AchievementConditionProgress {
  current: number;
  required: number;
  completed: boolean;
}

export function evaluateCondition(
  condition: AchievementCondition,
  world: AchievementWorldSnapshot,
): AchievementConditionProgress {
  switch (condition.type) {
    case 'playerLevel':
      return {
        current: world.playerLevel,
        required: condition.value,
        completed: world.playerLevel >= condition.value,
      };
    case 'onlineKills':
      return {
        current: world.onlineKills,
        required: condition.value,
        completed: world.onlineKills >= condition.value,
      };
    case 'uniqueCharacters':
      return {
        current: world.uniqueCharacters,
        required: condition.value,
        completed: world.uniqueCharacters >= condition.value,
      };
    case 'characterStars':
      return {
        current: world.maxStars,
        required: condition.minStars,
        completed: world.maxStars >= condition.minStars,
      };
    case 'characterMastery':
      return {
        current: world.maxMastery,
        required: condition.masteryLevel,
        completed: world.maxMastery >= condition.masteryLevel,
      };
    case 'awakeningLevel':
      return {
        current: world.maxAwakening,
        required: condition.awakeningLevel,
        completed: world.maxAwakening >= condition.awakeningLevel,
      };
    case 'hasLineage':
      return {
        current: world.hasLineage ? 1 : 0,
        required: 1,
        completed: world.hasLineage,
      };
    case 'lineageRank': {
      const lineageOk = !condition.lineageId || world.lineageId === condition.lineageId;
      const current = lineageOk ? world.lineageRank : 0;
      return {
        current,
        required: condition.rank,
        completed: lineageOk && world.lineageRank >= condition.rank,
      };
    }
    case 'hasSpecialization':
      return {
        current: world.hasSpecialization ? 1 : 0,
        required: 1,
        completed: world.hasSpecialization,
      };
    case 'specializationLevel': {
      const lineageOk = !condition.lineageId || world.lineageId === condition.lineageId;
      const keyOk =
        !condition.specializationKey || world.specializationKey === condition.specializationKey;
      const current = lineageOk && keyOk ? world.specializationLevel : 0;
      return {
        current,
        required: condition.level,
        completed: lineageOk && keyOk && world.specializationLevel >= condition.level,
      };
    }
    case 'guildMembership':
      return {
        current: world.inGuild ? 1 : 0,
        required: 1,
        completed: world.inGuild,
      };
    case 'huntProgress':
      return {
        current: world.huntsCompleted,
        required: condition.value,
        completed: world.huntsCompleted >= condition.value,
      };
    default:
      return { current: 0, required: 1, completed: false };
  }
}

export type AchievementTrigger =
  | 'all'
  | 'playerLevel'
  | 'onlineKills'
  | 'collection'
  | 'characterProgress'
  | 'lineage'
  | 'guild';

function matchesTrigger(def: AchievementDefinition, trigger: AchievementTrigger): boolean {
  if (trigger === 'all') return true;
  const t = def.condition.type;
  switch (trigger) {
    case 'playerLevel':
      return t === 'playerLevel';
    case 'onlineKills':
      return t === 'onlineKills';
    case 'collection':
      return t === 'uniqueCharacters';
    case 'characterProgress':
      return t === 'characterStars' || t === 'characterMastery' || t === 'awakeningLevel';
    case 'lineage':
      return (
        t === 'hasLineage' ||
        t === 'lineageRank' ||
        t === 'hasSpecialization' ||
        t === 'specializationLevel'
      );
    case 'guild':
      return t === 'guildMembership';
    default:
      return true;
  }
}

export function listAchievementsForTrigger(trigger: AchievementTrigger): AchievementDefinition[] {
  return listAchievementDefinitions().filter((def) => matchesTrigger(def, trigger));
}
