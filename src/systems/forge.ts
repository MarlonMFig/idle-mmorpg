import { maxStarsForQuality } from '@/constants/aiw-quality';
import { forgeMaterialCost } from '@/constants/character-progression';
import type { SealedCharacter } from '@/types/team';

export type ForgeEligibilityReason =
  | 'ok'
  | 'target-missing'
  | 'max-stars'
  | 'quality-not-configured'
  | 'not-enough-materials';

export interface ForgePlan {
  reason: ForgeEligibilityReason;
  target?: SealedCharacter;
  materialIds: string[];
  cost: number;
}

/**
 * Materiais elegíveis para forja: mesmo personagem (characterKey), mesma quality,
 * não é o alvo, não está na equipe, não favorito, não bloqueado.
 */
export function listEligibleForgeMaterials(params: {
  target: SealedCharacter;
  collection: SealedCharacter[];
  teamIds: readonly string[];
}): SealedCharacter[] {
  const team = new Set(params.teamIds);
  return params.collection.filter((entry) => {
    if (entry.id === params.target.id) return false;
    if (entry.characterKey !== params.target.characterKey) return false;
    if (entry.quality !== params.target.quality) return false;
    if (team.has(entry.id)) return false;
    if (entry.isFavorite || entry.isLocked) return false;
    return true;
  });
}

export function planForgeStar(params: {
  targetId: string;
  collection: SealedCharacter[];
  teamIds: readonly string[];
  preferredMaterialIds?: readonly string[];
}): ForgePlan {
  const target = params.collection.find((entry) => entry.id === params.targetId);
  if (!target) {
    return { reason: 'target-missing', materialIds: [], cost: 0 };
  }

  const cost = forgeMaterialCost(target.quality);
  if (cost == null) {
    return { reason: 'quality-not-configured', target, materialIds: [], cost: 0 };
  }

  if (target.stars >= maxStarsForQuality(target.quality)) {
    return { reason: 'max-stars', target, materialIds: [], cost };
  }

  const eligible = listEligibleForgeMaterials({
    target,
    collection: params.collection,
    teamIds: params.teamIds,
  });

  let materialIds: string[] = [];
  if (params.preferredMaterialIds?.length) {
    const eligibleIds = new Set(eligible.map((entry) => entry.id));
    materialIds = params.preferredMaterialIds.filter((id) => eligibleIds.has(id));
  }
  if (materialIds.length < cost) {
    const used = new Set(materialIds);
    for (const entry of eligible) {
      if (used.has(entry.id)) continue;
      materialIds.push(entry.id);
      used.add(entry.id);
      if (materialIds.length >= cost) break;
    }
  }

  materialIds = materialIds.slice(0, cost);
  if (materialIds.length < cost) {
    return { reason: 'not-enough-materials', target, materialIds, cost };
  }

  return { reason: 'ok', target, materialIds, cost };
}
