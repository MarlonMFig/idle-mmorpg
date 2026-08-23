import {
  EVENT_CONDITION_TYPES,
  STATE_CONDITION_TYPES,
  type MissionCondition,
  type MissionWorldSnapshot,
} from '@/types/missions';

export function isEventMissionCondition(type: MissionCondition['type']): boolean {
  return EVENT_CONDITION_TYPES.has(type);
}

export function isStateMissionCondition(type: MissionCondition['type']): boolean {
  return STATE_CONDITION_TYPES.has(type);
}

export function missionTarget(condition: MissionCondition): number {
  if ('value' in condition) return Math.max(1, condition.value);
  return 1;
}

export function evaluateStateCondition(
  condition: MissionCondition,
  world: MissionWorldSnapshot,
): { current: number; required: number; completed: boolean } {
  const required = missionTarget(condition);
  switch (condition.type) {
    case 'playerLevel':
      return { current: world.playerLevel, required, completed: world.playerLevel >= required };
    case 'characterLevel':
      return {
        current: world.maxCharacterLevel,
        required,
        completed: world.maxCharacterLevel >= required,
      };
    case 'characterMastery':
      return { current: world.maxMastery, required, completed: world.maxMastery >= required };
    case 'characterStars':
      return { current: world.maxStars, required, completed: world.maxStars >= required };
    case 'awakeningLevel':
      return { current: world.maxAwakening, required, completed: world.maxAwakening >= required };
    case 'uniqueCharacters':
      return {
        current: world.uniqueCharacters,
        required,
        completed: world.uniqueCharacters >= required,
      };
    case 'lineageSelected':
      return { current: world.hasLineage ? 1 : 0, required: 1, completed: world.hasLineage };
    case 'lineageRank':
      return { current: world.lineageRank, required, completed: world.lineageRank >= required };
    case 'specializationSelected':
      return {
        current: world.hasSpecialization ? 1 : 0,
        required: 1,
        completed: world.hasSpecialization,
      };
    case 'specializationLevel':
      return {
        current: world.specializationLevel,
        required,
        completed: world.hasSpecialization && world.specializationLevel >= required,
      };
    default:
      return { current: 0, required, completed: false };
  }
}
