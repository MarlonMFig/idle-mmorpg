import type { EquipSlot, ItemBonuses } from '@/types/attributes';

export type { EquipSlot } from '@/types/attributes';

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export interface ItemDefinition {
  id: string;
  name: string;
  rarity: ItemRarity;
  /** Máximo por stack no inventário. */
  stackMax: number;
  /** Ícone em /public (png ou svg). */
  iconSrc?: string;
  /** Se definido, o item pode ser equipado nesse slot. */
  equipSlot?: EquipSlot;
  /** Bônus aplicados ao equipar. */
  bonuses?: ItemBonuses;
}

/** Entrada da tabela de drop de um inimigo. */
export interface LootDropEntry {
  itemId: string;
  chance: number;
  quantityMin: number;
  quantityMax: number;
  rarity: ItemRarity;
}

export interface RolledLoot {
  itemId: string;
  name: string;
  quantity: number;
  rarity: ItemRarity;
}

export interface GroundLootData {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  rarity: ItemRarity;
  x: number;
  y: number;
}
