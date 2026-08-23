import { getItem } from '@/data/items';
import {
  DAILY_MISSION_POOL,
  JOURNEY_MISSIONS,
  WEEKLY_MISSION_POOL,
  getMissionDefinition,
  listMissionDefinitions,
} from '@/data/missions/mission-registry';
import { huntRequiredLevel } from '@/lib/mission-eligibility';
import {
  EVENT_CONDITION_TYPES,
  MISSION_TAGS,
  MISSION_TYPES,
  STATE_CONDITION_TYPES,
  type MissionDefinition,
} from '@/types/missions';

const FORBIDDEN_CONDITION_TYPES = new Set([
  'completeHunt',
  'huntsCompleted',
  'finishHunt',
  'clearHunt',
  'huntVictory',
]);

export function validateMissionCatalog(): string[] {
  const warnings: string[] = [];
  const ids = new Set<string>();
  const typeSet = new Set<string>(MISSION_TYPES);
  const tagSet = new Set<string>(MISSION_TAGS);

  for (const def of listMissionDefinitions()) {
    if (ids.has(def.id)) warnings.push(`[MissionValidation] ID duplicado: ${def.id}`);
    ids.add(def.id);
    if (!typeSet.has(def.type)) {
      warnings.push(`[MissionValidation] ${def.id} type inválido: ${def.type}`);
    }
    if (!tagSet.has(def.tag)) {
      warnings.push(`[MissionValidation] ${def.id} tag inválida: ${def.tag}`);
    }
    if (FORBIDDEN_CONDITION_TYPES.has(def.condition.type)) {
      warnings.push(`[MissionValidation] ${def.id} condição proibida (Hunt infinita): ${def.condition.type}`);
    }
    if (
      !EVENT_CONDITION_TYPES.has(def.condition.type) &&
      !STATE_CONDITION_TYPES.has(def.condition.type)
    ) {
      warnings.push(`[MissionValidation] ${def.id} condition inválida: ${def.condition.type}`);
    }
    if (def.type === 'daily' && !DAILY_MISSION_POOL.some((row) => row.id === def.id)) {
      // journey/weekly ok
    }
    if (def.condition.type === 'onlineKillsInHunt') {
      if (huntRequiredLevel(def.condition.huntId) == null) {
        warnings.push(`[MissionValidation] ${def.id} huntId desconhecido: ${def.condition.huntId}`);
      }
    }
    if (def.eligibility?.requiresHuntId && huntRequiredLevel(def.eligibility.requiresHuntId) == null) {
      warnings.push(
        `[MissionValidation] ${def.id} eligibility.requiresHuntId inválido: ${def.eligibility.requiresHuntId}`,
      );
    }
    for (const reward of def.rewards) {
      if (reward.type === 'copper' && !(reward.amount > 0)) {
        warnings.push(`[MissionValidation] ${def.id} copper inválido`);
      }
      if (reward.type === 'item' && !getItem(reward.id)) {
        warnings.push(`[MissionValidation] ${def.id} item inexistente: ${reward.id}`);
      }
    }
    if (def.nextMissionId && def.type !== 'journey') {
      warnings.push(`[MissionValidation] ${def.id} nextMissionId só é válido em journey`);
    }
    if (def.nextMissionId && !ids.has(def.nextMissionId) && !getMissionDefinition(def.nextMissionId)) {
      // checked after full pass
    }
  }

  for (const def of listMissionDefinitions()) {
    if (def.nextMissionId && !ids.has(def.nextMissionId)) {
      warnings.push(`[MissionValidation] ${def.id} nextMissionId inexistente: ${def.nextMissionId}`);
    }
  }

  warnings.push(...validateJourneyChain());
  return warnings.filter((row) => !row.includes('só é válido') || true);
}

function validateJourneyChain(): string[] {
  const warnings: string[] = [];
  const byId = new Map(JOURNEY_MISSIONS.map((row) => [row.id, row]));
  const seen = new Set<string>();
  let current: MissionDefinition | undefined = JOURNEY_MISSIONS[0];
  let steps = 0;
  while (current) {
    if (seen.has(current.id)) {
      warnings.push(`[MissionValidation] loop na Jornada em ${current.id}`);
      break;
    }
    seen.add(current.id);
    steps += 1;
    if (steps > JOURNEY_MISSIONS.length + 2) {
      warnings.push('[MissionValidation] cadeia da Jornada excedeu o catálogo');
      break;
    }
    const nextId = current.nextMissionId;
    if (!nextId) break;
    const next = byId.get(nextId);
    if (!next) {
      warnings.push(`[MissionValidation] Jornada next inexistente: ${nextId}`);
      break;
    }
    current = next;
  }
  if (seen.size !== JOURNEY_MISSIONS.length) {
    warnings.push(
      `[MissionValidation] Jornada não visita todas as etapas (${seen.size}/${JOURNEY_MISSIONS.length})`,
    );
  }
  for (const def of WEEKLY_MISSION_POOL) {
    if (def.type !== 'weekly') warnings.push(`[MissionValidation] ${def.id} no pool weekly com type ${def.type}`);
  }
  for (const def of DAILY_MISSION_POOL) {
    if (def.type !== 'daily') warnings.push(`[MissionValidation] ${def.id} no pool daily com type ${def.type}`);
  }
  return warnings;
}

export function catalogHasCompleteHuntCondition(): boolean {
  return listMissionDefinitions().some((def) => FORBIDDEN_CONDITION_TYPES.has(def.condition.type));
}
