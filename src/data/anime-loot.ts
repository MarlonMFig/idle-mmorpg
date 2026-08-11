import {
  ANIME_MATERIAL_TRIO,
  NARUTO_LOOT_POOLS,
} from '@/data/anime-items';
import type { AnimeId } from '@/types/anime';
import type { ItemRarity, LootDropEntry } from '@/types/loot';

/**
 * Quantidade de Moeda de Cobre garantida ao matar (nível do alvo).
 * Separada da tabela de materiais — vai direto pro inventário.
 */
export function copperRewardForKill(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level) || 1);
  const coinMax = Math.max(2, Math.min(25, Math.ceil(safeLevel / 3)));
  return 1 + Math.floor(Math.random() * coinMax);
}

/** Chance por item tal que P(≥1 drop na pool) ≈ tierChance. */
function perItemChance(poolSize: number, tierChance: number): number {
  if (poolSize <= 0) return 0;
  const p = 1 - Math.pow(1 - Math.min(0.95, tierChance), 1 / poolSize);
  return Math.min(0.55, Math.max(0.01, p));
}

function poolToEntries(
  itemIds: readonly string[],
  rarity: ItemRarity,
  tierChance: number,
  quantityMax: number,
): LootDropEntry[] {
  const chance = perItemChance(itemIds.length, tierChance);
  return itemIds.map((itemId) => ({
    itemId,
    chance,
    quantityMin: 1,
    quantityMax,
    rarity,
  }));
}

/** Tabela de caça Naruto: pool completa por raridade. */
export function buildNarutoHuntLoot(level: number): LootDropEntry[] {
  const commonMax = Math.max(1, Math.min(4, Math.ceil(level / 20)));
  const uncommonMax = Math.max(1, Math.min(2, Math.ceil(level / 40)));
  const uncommonChance = Math.min(0.42, 0.18 + level * 0.002);
  const rareChance = Math.min(0.28, 0.06 + level * 0.0018);
  const epicChance = Math.min(0.12, 0.02 + level * 0.001);
  const legendaryChance = Math.min(0.05, 0.006 + level * 0.0004);
  const mythicChance = Math.min(0.02, 0.002 + level * 0.00015);

  return [
    ...poolToEntries(NARUTO_LOOT_POOLS.common, 'common', 0.72, commonMax),
    ...poolToEntries(
      NARUTO_LOOT_POOLS.uncommon,
      'uncommon',
      uncommonChance,
      uncommonMax,
    ),
    ...poolToEntries(NARUTO_LOOT_POOLS.rare, 'rare', rareChance, 1),
    ...poolToEntries(NARUTO_LOOT_POOLS.epic, 'epic', epicChance, 1),
    ...poolToEntries(NARUTO_LOOT_POOLS.legendary, 'legendary', legendaryChance, 1),
    ...poolToEntries(NARUTO_LOOT_POOLS.mythic, 'mythic', mythicChance, 1),
  ];
}

/**
 * Tabela de drop de caça por anime + nível do alvo (materiais da franquia).
 * Cobre é concedido em `handleEnemyKill` via `copperRewardForKill`.
 */
export function buildAnimeHuntLoot(animeId: AnimeId, level: number): LootDropEntry[] {
  if (animeId === 'naruto') {
    return buildNarutoHuntLoot(level);
  }

  const mats = ANIME_MATERIAL_TRIO[animeId];
  const commonMax = Math.max(1, Math.min(4, Math.ceil(level / 20)));
  const uncommonMax = Math.max(1, Math.min(2, Math.ceil(level / 40)));
  const rareChance = Math.min(0.28, 0.05 + level * 0.0018);

  return [
    {
      itemId: mats.common,
      chance: 0.55,
      quantityMin: 1,
      quantityMax: commonMax,
      rarity: 'common',
    },
    {
      itemId: mats.uncommon,
      chance: Math.min(0.38, 0.12 + level * 0.002),
      quantityMin: 1,
      quantityMax: uncommonMax,
      rarity: 'uncommon',
    },
    {
      itemId: mats.rare,
      chance: rareChance,
      quantityMin: 1,
      quantityMax: 1,
      rarity: 'rare',
    },
  ];
}
