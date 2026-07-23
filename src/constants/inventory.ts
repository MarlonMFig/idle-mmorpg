export const INVENTORY_SLOT_COUNT = 40;
export const INVENTORY_COLUMNS = 8;

export const EQUIP_SLOT_ORDER = [
  'bandana',
  'weapon',
  'clothing',
  'gloves',
  'boots',
  'accessory',
] as const;

export const EQUIP_SLOT_LABELS: Record<(typeof EQUIP_SLOT_ORDER)[number], string> = {
  bandana: 'Bandana',
  weapon: 'Arma',
  clothing: 'Roupa',
  gloves: 'Luvas',
  boots: 'Botas',
  accessory: 'Acessório',
};

export const LOOT_PICKUP_RANGE = 36;
