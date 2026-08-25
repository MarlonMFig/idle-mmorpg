import { resolveQualityStatMultiplier } from '@/constants/character-quality-stats';
import type { CharacterQuality } from '@/types/character-meta';
import type { SealedCharacter } from '@/types/team';
import { computePlayerAttributes } from '@/utils/attributes';
import { roundAttributeForDisplay } from '@/utils/star-bonus';
import type { AttributeValues, PlayerAttributes } from '@/types/attributes';

type InstanceStatSource = Pick<
  SealedCharacter,
  'level' | 'stars' | 'quality' | 'qualityStatMultiplier' | 'characterId' | 'awakeningLevel'
> &
  Partial<Pick<SealedCharacter, 'potential'>>;

/** Resolver oficial de CharacterInstance → atributos (mesma pipeline do combate). */
export function computeInstanceAttributes(
  instance: InstanceStatSource,
  levelOverride?: number,
): PlayerAttributes {
  return computePlayerAttributes({
    level: Math.max(1, levelOverride ?? instance.level ?? 1),
    stars: instance.stars,
    quality: instance.quality,
    qualityStatMultiplier: resolveQualityStatMultiplier(
      instance.quality,
      instance.qualityStatMultiplier,
      instance.potential,
    ),
    characterId: instance.characterId,
    awakeningLevel: instance.awakeningLevel,
  });
}

export function computeInstanceTotals(
  instance: InstanceStatSource,
  levelOverride?: number,
): AttributeValues {
  return computeInstanceAttributes(instance, levelOverride).totals;
}

export function estimateInstanceCombatPower(
  instance: InstanceStatSource,
  levelOverride?: number,
): number {
  const level = Math.max(1, levelOverride ?? instance.level ?? 1);
  const t = computeInstanceTotals(instance, level);
  return Math.round(
    t.strength * 3 +
      t.defense * 2 +
      t.hp / 10 +
      t.speed * 2 +
      level * 25 +
      (instance.awakeningLevel ?? 0) * 300,
  );
}

export function displayPrimaryStat(value: number): number {
  return roundAttributeForDisplay(value);
}

export type { CharacterQuality };
