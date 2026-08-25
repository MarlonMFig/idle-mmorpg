export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type ItemType = 'copper' | 'potion' | 'concentrated_potion' | 'ultra_potion' | 'scroll' | 'revive' | 'chest';

export interface ItemReward {
  id: string;
  name: string;
  count: number;
  type: ItemType;
  rarity: ItemRarity;
  description: string;
  color: string;
  glowColor: string;
}

export interface DayReward {
  day: number;
  title: string;
  subtitle?: string;
  items: ItemReward[];
  isGrandReward?: boolean;
  note?: string;
}

export type DayStatus = 'claimed' | 'available' | 'locked' | 'missed';

export interface PlayerInventory {
  copper: number;
  potions: number;
  concentratedPotions: number;
  ultraPotions: number;
  scrolls: number;
  revives: number;
  chests: number;
}
