import { getMaxStarsForRarity } from '@/config/gameConfig';
import { canUpgradeCharacterStar, type CharacterStarUpgradeCheck } from '@/lib/character-star-upgrade';
import type { SealedCharacter } from '@/types/team';

export type ForgeEligibilityReason =
  | 'ok'
  | 'target-missing'
  | 'max-stars'
  | 'stars-unavailable'
  | 'not-enough-resources';

export interface ForgePlan extends CharacterStarUpgradeCheck {
  reason: ForgeEligibilityReason;
  target?: SealedCharacter;
}

const EMPTY_CHECK: CharacterStarUpgradeCheck = {
  canUpgrade: false,
  cost: null,
  resources: { copies: 0, fragments: 0, signature: 0 },
  missing: [],
  maxStars: 0,
};

export function planForgeStar(params: {
  targetId?: string;
  targetInstanceId?: string;
  collection: SealedCharacter[];
  teamIds?: readonly string[];
}): ForgePlan {
  void params.teamIds;
  const targetId = params.targetInstanceId ?? params.targetId ?? '';
  const target = params.collection.find((entry) => entry.id === targetId);
  if (!target) {
    return { reason: 'target-missing', ...EMPTY_CHECK };
  }

  const check = canUpgradeCharacterStar(target, params.collection);
  const starCap = getMaxStarsForRarity(target.quality);
  if (starCap <= 0) {
    return { reason: 'stars-unavailable', target, ...check };
  }
  if (!check.cost || target.stars >= check.maxStars) {
    return { reason: 'max-stars', target, ...check };
  }
  if (check.canUpgrade) {
    return { reason: 'ok', target, ...check };
  }
  return { reason: 'not-enough-resources', target, ...check };
}
