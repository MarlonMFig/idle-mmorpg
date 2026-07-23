import { ENEMY_TEXTURE_KEY } from '@/constants/enemy';
import { MAP_KEYS } from '@/maps/map-registry';
import type { EnemyDefinition } from '@/types/enemy';

/** Monstros por mapa (fonte do EnemyManager). */
export const ENEMY_DEFINITIONS: readonly EnemyDefinition[] = [
  {
    id: 'enemy-leaf-slime-1',
    name: 'Slime da Folha',
    hp: 30,
    level: 1,
    xp: 8,
    loot: [
      {
        itemId: 'item-slime-gel',
        chance: 0.7,
        quantityMin: 1,
        quantityMax: 2,
        rarity: 'common',
      },
      {
        itemId: 'item-copper-coin',
        chance: 0.45,
        quantityMin: 1,
        quantityMax: 3,
        rarity: 'common',
      },
      {
        itemId: 'item-lucky-charm',
        chance: 0.08,
        quantityMin: 1,
        quantityMax: 1,
        rarity: 'rare',
      },
    ],
    spawn: { x: 180, y: 520 },
    speed: 55,
    chaseRadius: 96,
    sprite: ENEMY_TEXTURE_KEY,
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'enemy-leaf-slime-2',
    name: 'Slime da Folha',
    hp: 30,
    level: 1,
    xp: 8,
    loot: [
      {
        itemId: 'item-slime-gel',
        chance: 0.7,
        quantityMin: 1,
        quantityMax: 2,
        rarity: 'common',
      },
      {
        itemId: 'item-chakra-shard',
        chance: 0.08,
        quantityMin: 1,
        quantityMax: 1,
        rarity: 'rare',
      },
    ],
    spawn: { x: 560, y: 200 },
    speed: 55,
    chaseRadius: 96,
    sprite: ENEMY_TEXTURE_KEY,
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'enemy-forest-wolf-1',
    name: 'Lobo da Floresta',
    hp: 55,
    level: 3,
    xp: 18,
    loot: [
      {
        itemId: 'item-wolf-fang',
        chance: 0.55,
        quantityMin: 1,
        quantityMax: 1,
        rarity: 'uncommon',
      },
      {
        itemId: 'item-copper-coin',
        chance: 0.6,
        quantityMin: 2,
        quantityMax: 5,
        rarity: 'common',
      },
    ],
    spawn: { x: 420, y: 180 },
    speed: 80,
    chaseRadius: 140,
    sprite: ENEMY_TEXTURE_KEY,
    mapKey: MAP_KEYS.forest,
  },
  {
    id: 'enemy-forest-wolf-2',
    name: 'Lobo da Floresta',
    hp: 55,
    level: 3,
    xp: 18,
    loot: [
      {
        itemId: 'item-wolf-fang',
        chance: 0.55,
        quantityMin: 1,
        quantityMax: 1,
        rarity: 'uncommon',
      },
      {
        itemId: 'item-chakra-shard',
        chance: 0.12,
        quantityMin: 1,
        quantityMax: 1,
        rarity: 'rare',
      },
    ],
    spawn: { x: 560, y: 480 },
    speed: 80,
    chaseRadius: 140,
    sprite: ENEMY_TEXTURE_KEY,
    mapKey: MAP_KEYS.forest,
  },
  {
    id: 'enemy-academy-dummy-1',
    name: 'Boneco de Treino',
    hp: 40,
    level: 2,
    xp: 5,
    loot: [
      {
        itemId: 'item-wood-scrap',
        chance: 0.9,
        quantityMin: 1,
        quantityMax: 3,
        rarity: 'common',
      },
    ],
    spawn: { x: 220, y: 220 },
    speed: 0,
    chaseRadius: 0,
    sprite: ENEMY_TEXTURE_KEY,
    mapKey: MAP_KEYS.academy,
  },
] as const;

export function getEnemiesForMap(mapKey: string): EnemyDefinition[] {
  return ENEMY_DEFINITIONS.filter((enemy) => enemy.mapKey === mapKey);
}
