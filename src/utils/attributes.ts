import { combatGrowth } from '@/anime-idle/formulas';
import {
  ATTRIBUTE_ORDER,
  ATTRIBUTE_SHORT_LABELS,
  BASE_ATTRIBUTES,
  LEVEL_ATTRIBUTE_GROWTH,
} from '@/constants/attributes';
import type {
  AttributeBuff,
  AttributeId,
  AttributeModifiers,
  AttributeValues,
  PlayerAttributes,
} from '@/types/attributes';
import type { LineageSpecializationModifiers } from '@/types/lineage';
import { applyQualityToPrimaryBase, resolveQualityStatMultiplier } from '@/constants/character-quality-stats';
import type { CharacterPotential, CharacterQuality } from '@/types/character-meta';
import { applyStarBonusToBase } from '@/utils/star-bonus';
import { getAwakeningStatModifiers } from '@/lib/awakening-rewards';
import { getLineageSpecializationStatModifiers } from '@/lib/lineage-specialization-modifiers';

export function emptyModifiers(): AttributeModifiers {
  return {};
}

export function createZeroValues(): AttributeValues {
  return {
    hp: 0,
    strength: 0,
    defense: 0,
    speed: 0,
    accuracy: 0,
    critical: 0,
  };
}

export function cloneValues(values: AttributeValues): AttributeValues {
  return { ...values };
}

/** Soma modificadores parciais em um acumulador completo. */
export function addModifiers(target: AttributeValues, modifiers: AttributeModifiers): void {
  for (const id of ATTRIBUTE_ORDER) {
    const value = modifiers[id];
    if (value) target[id] += value;
  }
}

export function sumModifiers(...layers: AttributeModifiers[]): AttributeModifiers {
  const total = createZeroValues();
  for (const layer of layers) addModifiers(total, layer);
  const result: AttributeModifiers = {};
  for (const id of ATTRIBUTE_ORDER) {
    if (total[id] !== 0) result[id] = total[id];
  }
  return result;
}

export function levelModifiersFor(level: number, starredBase: AttributeValues): AttributeModifiers {
  if (level <= 1) return {};
  const steps = Math.max(0, level - 1);
  const result: AttributeModifiers = {};
  for (const id of ATTRIBUTE_ORDER) {
    if (id === 'strength') {
      const grown = starredBase[id] * combatGrowth(level).toNumber() - starredBase[id];
      if (grown !== 0) result[id] = grown;
      continue;
    }
    const growth = LEVEL_ATTRIBUTE_GROWTH[id] * steps;
    if (growth !== 0) result[id] = growth;
  }
  return result;
}

export function sumBuffModifiers(buffs: readonly AttributeBuff[], now = Date.now()): AttributeModifiers {
  const active = buffs.filter((buff) => buff.expiresAt == null || buff.expiresAt > now);
  return sumModifiers(...active.map((buff) => buff.modifiers));
}

/**
 * Compõe atributos na ordem oficial:
 * Base → Stars → Level → Quality (HP/ATK/DEF, uma vez) → Awakening → Lineage → Buffs.
 * Qualidade vem da CharacterInstance, nunca da CharacterDefinition.
 */
export function computePlayerAttributes(input: {
  level: number;
  stars?: number;
  quality?: CharacterQuality | null;
  qualityStatMultiplier?: number | null;
  potential?: CharacterPotential | null;
  buffs?: readonly AttributeBuff[];
  now?: number;
  characterId?: string | null;
  awakeningLevel?: number;
  lineageModifiers?: LineageSpecializationModifiers;
}): PlayerAttributes {
  const stars = input.stars ?? 0;
  const base = applyStarBonusToBase(cloneValues(BASE_ATTRIBUTES), stars);
  const level = levelModifiersFor(input.level, base);
  const buffList = input.buffs ?? [];
  const buffs = sumBuffModifiers(buffList, input.now);

  const progressed = createZeroValues();
  addModifiers(progressed, base);
  addModifiers(progressed, level);
  const afterQuality = applyQualityToPrimaryBase(
    progressed,
    resolveQualityStatMultiplier(input.quality, input.qualityStatMultiplier, input.potential),
    { quality: input.quality, potential: input.potential },
  );
  const awakening = getAwakeningStatModifiers(
    afterQuality,
    input.characterId ?? null,
    input.awakeningLevel ?? 0,
  );

  const afterAwakening = createZeroValues();
  addModifiers(afterAwakening, afterQuality);
  addModifiers(afterAwakening, awakening);
  let lineage: AttributeModifiers = {};
  try {
    lineage = getLineageSpecializationStatModifiers(
      afterAwakening,
      input.characterId ?? null,
      input.lineageModifiers,
    );
  } catch {
    lineage = {};
  }

  const totals = createZeroValues();
  addModifiers(totals, afterQuality);
  addModifiers(totals, awakening);
  addModifiers(totals, lineage);
  addModifiers(totals, buffs);

  return {
    totals,
    base,
    level,
    awakening,
    lineage,
    buffs,
    activeBuffs: buffList.filter(
      (buff) => buff.expiresAt == null || buff.expiresAt > (input.now ?? Date.now()),
    ),
  };
}

export function formatModifierLine(modifiers: AttributeModifiers): string {
  const parts: string[] = [];
  for (const id of ATTRIBUTE_ORDER) {
    const value = modifiers[id];
    if (!value) continue;
    const sign = value > 0 ? '+' : '';
    parts.push(`${ATTRIBUTE_SHORT_LABELS[id]} ${sign}${value}`);
  }
  return parts.join(' · ');
}

export function getAttributeValue(attributes: PlayerAttributes, id: AttributeId): number {
  return attributes.totals[id];
}
