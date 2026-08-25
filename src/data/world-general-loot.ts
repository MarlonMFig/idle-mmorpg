/**
 * Loot geral por universo (mundo).
 * Só Naruto está preenchido. Outros mundos ficam vazios até implementação explícita.
 *
 * Roll: chance do tier → no máximo 1 item por peso. Qty 1.
 * Quality de captura não entra aqui.
 */

import { isDevEnvironment } from '@/config/devConfig';
import { getItem } from '@/data/items';
import { getItemSellValue } from '@/data/shop';
import type { NarutoLootTier } from '@/data/naruto-loot-tiers';
import type { AnimeId } from '@/types/anime';

export type WorldId = AnimeId;

export interface WorldGeneralLootEntry {
  itemId: string;
  weight: number;
}

export type WorldGeneralLootPools = Partial<
  Record<WorldId, Record<NarutoLootTier, readonly WorldGeneralLootEntry[]>>
>;

/**
 * Chance do roll geral (independente).
 * Proposta inicial 15/15/14/13/12 estourava P50 T1–T2; frequência reduzida, sellPrice intacto.
 */
export const WORLD_GENERAL_DROP_CHANCE: Partial<Record<WorldId, Record<NarutoLootTier, number>>> = {
  naruto: {
    1: 0.03,
    2: 0.07,
    3: 0.12,
    4: 0.11,
    5: 0.09,
  },
};

/** Assinaturas exclusivas — fora do pool geral. */
export const NARUTO_GENERAL_EXCLUDED_ITEM_IDS: readonly string[] = [
  'item-anime-naruto-presa-ninken',
  'item-anime-naruto-casulo-insetos',
  'item-anime-naruto-cabaca-areia',
  'item-anime-naruto-fragmento-bestial',
  'item-anime-naruto-lente-ocular',
];

const T1: readonly WorldGeneralLootEntry[] = [
  { itemId: 'item-anime-naruto-racao-militar', weight: 25 },
  { itemId: 'item-anime-naruto-bandagem', weight: 25 },
  { itemId: 'item-anime-naruto-kunai-gasta', weight: 20 },
  { itemId: 'item-anime-naruto-shuriken', weight: 20 },
  { itemId: 'item-anime-naruto-fio-aco', weight: 10 },
];

const T2: readonly WorldGeneralLootEntry[] = [
  { itemId: 'item-anime-naruto-pilula-soldado', weight: 18 },
  { itemId: 'item-anime-naruto-papel-chakra', weight: 16 },
  { itemId: 'item-anime-naruto-bolsa-shuriken', weight: 16 },
  { itemId: 'item-anime-naruto-pergaminho-basico', weight: 16 },
  { itemId: 'item-anime-naruto-colete-tatico', weight: 8 },
  { itemId: 'item-anime-naruto-racao-militar', weight: 8 },
  { itemId: 'item-anime-naruto-bandagem', weight: 8 },
  { itemId: 'item-anime-naruto-kunai-gasta', weight: 6 },
  { itemId: 'item-anime-naruto-shuriken', weight: 6 },
  { itemId: 'item-anime-naruto-fio-aco', weight: 4 },
];

const T3: readonly WorldGeneralLootEntry[] = [
  { itemId: 'item-anime-naruto-papel-bomba', weight: 14 },
  { itemId: 'item-anime-naruto-bandana-riscada', weight: 14 },
  { itemId: 'item-anime-naruto-tanto', weight: 8 },
  { itemId: 'item-anime-naruto-frasco-veneno', weight: 6 },
  { itemId: 'item-anime-naruto-fuma-shuriken', weight: 8 },
  { itemId: 'item-anime-naruto-pilula-soldado', weight: 8 },
  { itemId: 'item-anime-naruto-papel-chakra', weight: 7 },
  { itemId: 'item-anime-naruto-bolsa-shuriken', weight: 7 },
  { itemId: 'item-anime-naruto-pergaminho-basico', weight: 7 },
  { itemId: 'item-anime-naruto-colete-tatico', weight: 6 },
  { itemId: 'item-anime-naruto-racao-militar', weight: 5 },
  { itemId: 'item-anime-naruto-bandagem', weight: 5 },
  { itemId: 'item-anime-naruto-kunai-gasta', weight: 4 },
  { itemId: 'item-anime-naruto-shuriken', weight: 4 },
  { itemId: 'item-anime-naruto-fio-aco', weight: 3 },
];

const T4: readonly WorldGeneralLootEntry[] = [
  { itemId: 'item-anime-naruto-selo-elemental', weight: 12 },
  { itemId: 'item-anime-naruto-livro-bingo', weight: 6 },
  { itemId: 'item-anime-naruto-mascara-anbu', weight: 6 },
  { itemId: 'item-anime-naruto-contrato-invocacao', weight: 8 },
  { itemId: 'item-anime-naruto-papel-bomba', weight: 8 },
  { itemId: 'item-anime-naruto-bandana-riscada', weight: 8 },
  { itemId: 'item-anime-naruto-tanto', weight: 6 },
  { itemId: 'item-anime-naruto-frasco-veneno', weight: 5 },
  { itemId: 'item-anime-naruto-fuma-shuriken', weight: 5 },
  { itemId: 'item-anime-naruto-pilula-soldado', weight: 5 },
  { itemId: 'item-anime-naruto-papel-chakra', weight: 5 },
  { itemId: 'item-anime-naruto-bolsa-shuriken', weight: 4 },
  { itemId: 'item-anime-naruto-pergaminho-basico', weight: 4 },
  { itemId: 'item-anime-naruto-colete-tatico', weight: 5 },
  { itemId: 'item-anime-naruto-racao-militar', weight: 3 },
  { itemId: 'item-anime-naruto-bandagem', weight: 3 },
  { itemId: 'item-anime-naruto-kunai-gasta', weight: 3 },
  { itemId: 'item-anime-naruto-shuriken', weight: 3 },
  { itemId: 'item-anime-naruto-fio-aco', weight: 2 },
];

const T5: readonly WorldGeneralLootEntry[] = [
  { itemId: 'item-anime-naruto-pergaminho-selamento', weight: 12 },
  { itemId: 'item-anime-naruto-pergaminho-proibido', weight: 1 },
  { itemId: 'item-anime-naruto-nucleo-chakra', weight: 1 },
  { itemId: 'item-anime-naruto-selo-elemental', weight: 10 },
  { itemId: 'item-anime-naruto-livro-bingo', weight: 5 },
  { itemId: 'item-anime-naruto-mascara-anbu', weight: 5 },
  { itemId: 'item-anime-naruto-contrato-invocacao', weight: 7 },
  { itemId: 'item-anime-naruto-papel-bomba', weight: 10 },
  { itemId: 'item-anime-naruto-bandana-riscada', weight: 10 },
  { itemId: 'item-anime-naruto-tanto', weight: 8 },
  { itemId: 'item-anime-naruto-frasco-veneno', weight: 6 },
  { itemId: 'item-anime-naruto-fuma-shuriken', weight: 8 },
  { itemId: 'item-anime-naruto-pilula-soldado', weight: 8 },
  { itemId: 'item-anime-naruto-papel-chakra', weight: 8 },
  { itemId: 'item-anime-naruto-bolsa-shuriken', weight: 8 },
  { itemId: 'item-anime-naruto-pergaminho-basico', weight: 8 },
  { itemId: 'item-anime-naruto-colete-tatico', weight: 8 },
  { itemId: 'item-anime-naruto-racao-militar', weight: 6 },
  { itemId: 'item-anime-naruto-bandagem', weight: 6 },
  { itemId: 'item-anime-naruto-kunai-gasta', weight: 6 },
  { itemId: 'item-anime-naruto-shuriken', weight: 6 },
  { itemId: 'item-anime-naruto-fio-aco', weight: 4 },
];

export const WORLD_GENERAL_LOOT: WorldGeneralLootPools = {
  naruto: {
    1: T1,
    2: T2,
    3: T3,
    4: T4,
    5: T5,
  },
};

export function getWorldGeneralDropChance(worldId: WorldId, tier: NarutoLootTier): number {
  return WORLD_GENERAL_DROP_CHANCE[worldId]?.[tier] ?? 0;
}

export function getWorldGeneralLootPool(
  worldId: WorldId,
  tier: NarutoLootTier,
): readonly WorldGeneralLootEntry[] {
  return WORLD_GENERAL_LOOT[worldId]?.[tier] ?? [];
}

export function poolWeightTotal(pool: readonly WorldGeneralLootEntry[]): number {
  return pool.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
}

export function pickWeightedGeneralItem(
  pool: readonly WorldGeneralLootEntry[],
  rng: () => number,
): string | null {
  const total = poolWeightTotal(pool);
  if (total <= 0) return null;
  let cursor = rng() * total;
  for (const entry of pool) {
    if (entry.weight <= 0) continue;
    cursor -= entry.weight;
    if (cursor < 0) return entry.itemId;
  }
  return pool[pool.length - 1]?.itemId ?? null;
}

export function rollWorldGeneralLoot(
  worldId: WorldId | null,
  tier: NarutoLootTier,
  rng: () => number,
): { itemId: string } | null {
  if (!worldId) {
    if (isDevEnvironment()) {
      console.warn('[LOOT] Missing world for general loot', { tier });
    }
    return null;
  }
  const chance = getWorldGeneralDropChance(worldId, tier);
  const pool = getWorldGeneralLootPool(worldId, tier);
  if (chance <= 0 || pool.length === 0) {
    if (worldId !== 'naruto' && isDevEnvironment()) {
      console.warn('[LOOT] No general loot pool for world', { worldId, tier });
    }
    return null;
  }
  if (rng() >= chance) return null;
  const itemId = pickWeightedGeneralItem(pool, rng);
  if (!itemId) return null;
  return { itemId };
}

export function expectedGeneralLootEvPerKill(worldId: WorldId, tier: NarutoLootTier): number {
  const chance = getWorldGeneralDropChance(worldId, tier);
  const pool = getWorldGeneralLootPool(worldId, tier);
  const total = poolWeightTotal(pool);
  if (chance <= 0 || total <= 0) return 0;
  let weighted = 0;
  for (const entry of pool) {
    weighted += (entry.weight / total) * getItemSellValue(entry.itemId);
  }
  return chance * weighted;
}

export interface WorldGeneralLootValidation {
  errors: string[];
  warnings: string[];
}

export function validateWorldGeneralLoot(): WorldGeneralLootValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const excluded = new Set(NARUTO_GENERAL_EXCLUDED_ITEM_IDS);

  for (const worldId of Object.keys(WORLD_GENERAL_LOOT) as WorldId[]) {
    const byTier = WORLD_GENERAL_LOOT[worldId];
    if (!byTier) continue;
    for (const tierKey of [1, 2, 3, 4, 5] as const) {
      const pool = byTier[tierKey];
      if (!pool || pool.length === 0) {
        errors.push(`${worldId} T${tierKey}: pool vazio`);
        continue;
      }
      const seen = new Set<string>();
      let total = 0;
      const evShare: Array<{ itemId: string; share: number }> = [];
      for (const entry of pool) {
        if (!entry.itemId) errors.push(`${worldId} T${tierKey}: itemId vazio`);
        if (seen.has(entry.itemId)) {
          errors.push(`${worldId} T${tierKey}: item duplicado (${entry.itemId})`);
        }
        seen.add(entry.itemId);
        if (entry.weight <= 0) errors.push(`${worldId} T${tierKey} ${entry.itemId}: weight <= 0`);
        if (!getItem(entry.itemId)) errors.push(`${worldId} T${tierKey}: item inexistente (${entry.itemId})`);
        if (excluded.has(entry.itemId)) {
          errors.push(`${worldId} T${tierKey}: item exclusivo no pool geral (${entry.itemId})`);
        }
        const sell = getItemSellValue(entry.itemId);
        if (!(sell > 0)) warnings.push(`${worldId} T${tierKey} ${entry.itemId}: sellPrice inválido (${sell})`);
        total += Math.max(0, entry.weight);
      }
      if (total <= 0) errors.push(`${worldId} T${tierKey}: soma de pesos <= 0`);
      if (total > 0) {
        for (const entry of pool) {
          evShare.push({
            itemId: entry.itemId,
            share: (entry.weight / total) * getItemSellValue(entry.itemId),
          });
        }
        const evSum = evShare.reduce((s, e) => s + e.share, 0);
        if (evSum > 0) {
          const top = [...evShare].sort((a, b) => b.share - a.share)[0];
          if (top && top.share / evSum > 0.45) {
            warnings.push(
              `${worldId} T${tierKey}: ${top.itemId} concentra ${(100 * top.share / evSum).toFixed(1)}% do EV geral`,
            );
          }
        }
      }
    }
  }

  return { errors, warnings };
}
