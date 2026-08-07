import type { ItemBonuses } from '@/types/attributes';
import type { EquipSlot, ItemRarity } from '@/types/loot';

/** Escala ataque OTX → strength idle. */
export function scaleAttackToStrength(attack: number): number {
  if (attack <= 0) return 0;
  return Math.max(1, Math.min(12, Math.round(attack / 20)));
}

/** Escala armor+defense OTX → defense idle. */
export function scaleArmorToDefense(armor: number, defense = 0): number {
  const raw = armor + defense;
  if (raw <= 0) return 0;
  return Math.max(1, Math.min(10, Math.round(raw / 2) || 1));
}

export function rarityFromWonsrName(name: string): ItemRarity {
  if (/\[L\]/i.test(name)) return 'epic';
  if (/\[E\]/i.test(name)) return 'rare';
  if (/\[R\]/i.test(name)) return 'uncommon';
  return 'common';
}

/** Remove prefixos de raridade OTX do nome exibido. */
export function cleanWonsrItemName(name: string): string {
  return name.replace(/^\[[NERL\-]\]\s*/i, '').trim();
}

export function mapWonsrSlot(
  slotType: string,
  weaponType: string,
): EquipSlot | undefined {
  const weapon = weaponType.toLowerCase();
  if (weapon && weapon !== 'shield') return 'weapon';

  switch (slotType.toLowerCase()) {
    case 'head':
      return 'bandana';
    case 'body':
      return 'clothing';
    case 'legs':
      return 'clothing';
    case 'feet':
      return 'boots';
    case 'necklace':
    case 'ring':
      return 'accessory';
    default:
      return undefined;
  }
}

export function bonusesFromWonsrStats(input: {
  attack: number;
  armor: number;
  defense: number;
  attributes?: Record<string, string>;
}): ItemBonuses | undefined {
  const bonuses: ItemBonuses = {};
  const strength = scaleAttackToStrength(input.attack);
  const defense = scaleArmorToDefense(input.armor, input.defense);
  if (strength > 0) bonuses.strength = strength;
  if (defense > 0) bonuses.defense = defense;

  const speed = Number(input.attributes?.speed ?? 0);
  if (Number.isFinite(speed) && speed > 0) {
    bonuses.speed = Math.max(5, Math.min(25, Math.round(speed / 10)));
  }

  const hp = Number(input.attributes?.maxhitpoints ?? input.attributes?.health ?? 0);
  if (Number.isFinite(hp) && hp > 0) {
    bonuses.hp = Math.max(5, Math.min(40, Math.round(hp / 50)));
  }

  const accuracy = Number(input.attributes?.accuracy ?? 0);
  if (Number.isFinite(accuracy) && accuracy > 0) {
    bonuses.accuracy = Math.max(1, Math.min(10, Math.round(accuracy)));
  }

  return Object.keys(bonuses).length > 0 ? bonuses : undefined;
}
