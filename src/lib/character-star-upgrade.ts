import { STAR_UPGRADE_CAP_BY_QUALITY, STAR_UPGRADE_COSTS, type CharacterStarUpgradeCost } from '@/constants/character-star-upgrade';
import { narutoFragmentItemId, narutoSignatureItemIds } from '@/data/naruto-loot-tiers';
import { inventoryStore } from '@/stores/inventory-store';
import type { CharacterQuality } from '@/types/character-meta';
import type { SealedCharacter } from '@/types/team';

export interface CharacterStarResources {
  copies: number;
  fragments: number;
  signature: number;
}

export interface CharacterStarUpgradeCheck {
  canUpgrade: boolean;
  cost: CharacterStarUpgradeCost | null;
  resources: CharacterStarResources;
  missing: Array<'copies' | 'fragments' | 'signature'>;
  maxStars: number;
}

export function getStarCapForQuality(quality: CharacterQuality): number {
  return STAR_UPGRADE_CAP_BY_QUALITY[quality] ?? 0;
}

export function calculateStarredStat(baseValue: number, stars: number): number {
  return baseValue * (1 + 0.1 * Math.max(0, Math.floor(stars)));
}

export function getNextStarCost(quality: CharacterQuality, currentStars: number): CharacterStarUpgradeCost | null {
  const costs = STAR_UPGRADE_COSTS[quality] ?? [];
  const index = Math.max(0, Math.floor(currentStars));
  return costs[index] ?? null;
}

export function buildOwnedCopiesMap(
  collection: readonly SealedCharacter[],
): Record<string, Partial<Record<CharacterQuality, number>>> {
  const out: Record<string, Partial<Record<CharacterQuality, number>>> = {};
  for (const entry of collection) {
    const bucket = (out[entry.characterId] ??= {});
    bucket[entry.quality] = (bucket[entry.quality] ?? 0) + 1;
  }
  return out;
}

export function getCharacterStarResources(
  target: Pick<SealedCharacter, 'id' | 'characterId' | 'quality'>,
  collection: readonly SealedCharacter[],
): CharacterStarResources {
  const copies = collection.filter(
    (entry) =>
      entry.id !== target.id &&
      entry.characterId === target.characterId &&
      entry.quality === target.quality,
  ).length;
  const fragments = inventoryStore.countItem(narutoFragmentItemId(target.characterId));
  const signature = narutoSignatureItemIds(target.characterId).reduce(
    (sum, itemId) => sum + inventoryStore.countItem(itemId),
    0,
  );
  return { copies, fragments, signature };
}

export function canUpgradeCharacterStar(
  target: Pick<SealedCharacter, 'id' | 'characterId' | 'quality' | 'stars'>,
  collection: readonly SealedCharacter[],
): CharacterStarUpgradeCheck {
  const maxStars = getStarCapForQuality(target.quality);
  const cost = getNextStarCost(target.quality, target.stars);
  const resources = getCharacterStarResources(target, collection);
  if (!cost || target.stars >= maxStars) {
    return {
      canUpgrade: false,
      cost: null,
      resources,
      missing: [],
      maxStars,
    };
  }
  const missing: Array<'copies' | 'fragments' | 'signature'> = [];
  if (resources.copies < cost.copies) missing.push('copies');
  if (resources.fragments < cost.fragments) missing.push('fragments');
  if (resources.signature < cost.signature) missing.push('signature');
  return {
    canUpgrade: missing.length === 0,
    cost,
    resources,
    missing,
    maxStars,
  };
}
