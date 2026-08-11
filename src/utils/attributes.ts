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
import { applyStarBonusToBase } from '@/utils/star-bonus';

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

export function levelModifiersFor(level: number): AttributeModifiers {
  if (level <= 1) return {};
  const steps = level - 1;
  const result: AttributeModifiers = {};
  for (const id of ATTRIBUTE_ORDER) {
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
 * Compõe atributos: base×estrelas + nível + buffs.
 * Equipamento removido do jogo.
 */
export function computePlayerAttributes(input: {
  level: number;
  stars?: number;
  buffs?: readonly AttributeBuff[];
  now?: number;
}): PlayerAttributes {
  const baseRaw = cloneValues(BASE_ATTRIBUTES);
  const stars = input.stars ?? 0;
  const base = applyStarBonusToBase(baseRaw, stars);
  const level = levelModifiersFor(input.level);
  const buffList = input.buffs ?? [];
  const buffs = sumBuffModifiers(buffList, input.now);

  const totals = createZeroValues();
  addModifiers(totals, base);
  addModifiers(totals, level);
  addModifiers(totals, buffs);

  return {
    totals,
    base,
    level,
    equipment: {},
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
