/**
 * Subset curado do catálogo WONSR (items.json) — valores já escalados para idle.
 * Não carrega o JSON completo no bundle; só estes ids entram no inventário/equip.
 */
import type { ItemDefinition } from '@/types/loot';
import {
  bonusesFromWonsrStats,
  cleanWonsrItemName,
  mapWonsrSlot,
  rarityFromWonsrName,
} from '@/data/wonsr-item-bridge';

interface WonsrEquipSeed {
  clientId: number;
  name: string;
  attack: number;
  defense: number;
  armor: number;
  slotType: string;
  weaponType: string;
  stackable?: boolean;
  attributes?: Record<string, string>;
  /** Override de slot quando o XML OTX veio sem slottype. */
  forceSlot?: ItemDefinition['equipSlot'];
}

function toItem(seed: WonsrEquipSeed): ItemDefinition {
  const id = `wonsr-item-${seed.clientId}`;
  const equipSlot =
    seed.forceSlot ?? mapWonsrSlot(seed.slotType, seed.weaponType);
  return {
    id,
    name: cleanWonsrItemName(seed.name),
    rarity: rarityFromWonsrName(seed.name),
    stackMax: seed.stackable ? 999 : 1,
    equipSlot,
    bonuses: bonusesFromWonsrStats(seed),
  };
}

const SEEDS: readonly WonsrEquipSeed[] = [
  {
    clientId: 12295,
    name: 'Elite Kunai',
    attack: 100,
    defense: 0,
    armor: 0,
    slotType: '',
    weaponType: 'sword',
  },
  {
    clientId: 2383,
    name: 'Bandit Sword',
    attack: 200,
    defense: 0,
    armor: 0,
    slotType: '',
    weaponType: 'sword',
  },
  {
    clientId: 2480,
    name: '[-]Konoha ForeHead',
    attack: 0,
    defense: 0,
    armor: 0,
    slotType: 'head',
    weaponType: '',
    attributes: { accuracy: '5' },
  },
  {
    clientId: 2339,
    name: 'damaged ForeHead',
    attack: 0,
    defense: 0,
    armor: 5,
    slotType: 'head',
    weaponType: '',
    forceSlot: 'bandana',
  },
  {
    clientId: 2485,
    name: '[N]Naruto Gennin Shirt',
    attack: 0,
    defense: 0,
    armor: 1,
    slotType: 'body',
    weaponType: '',
  },
  {
    clientId: 12446,
    name: '[N]Kiba Gennin Shirt',
    attack: 0,
    defense: 0,
    armor: 5,
    slotType: 'body',
    weaponType: '',
  },
  {
    clientId: 10411,
    name: '[N]Gennin Boots',
    attack: 0,
    defense: 0,
    armor: 0,
    slotType: 'feet',
    weaponType: '',
    attributes: { speed: '80' },
  },
  {
    clientId: 12317,
    name: '[N]Speed Boots',
    attack: 0,
    defense: 0,
    armor: 0,
    slotType: 'feet',
    weaponType: '',
    attributes: { speed: '150' },
  },
  {
    clientId: 2148,
    name: 'Coin',
    attack: 0,
    defense: 0,
    armor: 0,
    slotType: '',
    weaponType: '',
    stackable: true,
  },
];

export const WONSR_EQUIP_ITEMS: readonly ItemDefinition[] = SEEDS.map(toItem);

/** Kit inicial shinobi (Folha) a partir do subset WONSR. */
export const WONSR_STARTER_LOADOUT: readonly { itemId: string; quantity: number }[] = [
  { itemId: 'wonsr-item-12295', quantity: 1 }, // Elite Kunai
  { itemId: 'wonsr-item-2480', quantity: 1 }, // Konoha ForeHead
  { itemId: 'wonsr-item-2485', quantity: 1 }, // Gennin Shirt
  { itemId: 'wonsr-item-10411', quantity: 1 }, // Gennin Boots
  { itemId: 'item-shinobi-gloves', quantity: 1 }, // local (WONSR sem gloves)
  { itemId: 'item-lucky-charm', quantity: 1 }, // local accessory
  { itemId: 'wonsr-item-2148', quantity: 10 }, // Coin
  { itemId: 'item-copper-coin', quantity: 999999 }, // Moeda de Cobre (loja)
] as const;
