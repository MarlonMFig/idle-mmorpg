import { LINEAGE_SPECIALIZATION_UNLOCK_RANK } from '@/constants/lineage-rank-requirements';
import { LINEAGE_SYSTEM_UNLOCK_LEVEL } from '@/constants/lineage';
import { buildMissionWorldSnapshot } from '@/lib/mission-snapshot';
import type { MissionDefinition, MissionWorldSnapshot } from '@/types/missions';

/** Hunts conhecidas no catálogo inicial — eligibility sem carregar JSON. */
export const HUNT_REQUIRED_LEVEL: Record<string, number> = {
  'hunt-teste-farm-wonsr': 1,
  'wonsr-hunt-001': 1,
  'wonsr-hunt-006': 10,
};

export function huntRequiredLevel(huntId: string): number | null {
  return HUNT_REQUIRED_LEVEL[huntId] ?? null;
}

export function isMissionEligible(
  def: MissionDefinition,
  world: MissionWorldSnapshot = buildMissionWorldSnapshot(),
): boolean {
  const el = def.eligibility;
  if (!el) return true;

  if (el.minimumPlayerLevel != null && world.playerLevel < el.minimumPlayerLevel) {
    return false;
  }
  if (el.requiresLineage && !world.hasLineage) return false;
  if (el.requiresSpecialization && !world.hasSpecialization) return false;

  if (el.requiresFeature === 'lineage' && world.playerLevel < LINEAGE_SYSTEM_UNLOCK_LEVEL) {
    return false;
  }
  if (el.requiresFeature === 'specialization') {
    if (!world.hasLineage || world.lineageRank < LINEAGE_SPECIALIZATION_UNLOCK_RANK) return false;
  }
  if (el.requiresFeature === 'awakening') {
    if (world.maxCharacterLevel < 20 || world.maxMastery < 25) return false;
  }

  if (el.requiresHuntId) {
    const required = huntRequiredLevel(el.requiresHuntId);
    if (required == null) return false;
    if (world.playerLevel < required) return false;
  }

  if (def.condition.type === 'onlineKillsInHunt') {
    const required = huntRequiredLevel(def.condition.huntId);
    if (required == null || world.playerLevel < required) return false;
  }

  if (def.condition.type === 'lineageCompatibleKills' && !world.hasLineage) return false;

  return true;
}
