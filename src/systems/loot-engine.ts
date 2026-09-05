/**
 * Loot Engine — única camada de resolução de drops.
 *
 * Online, offline e DEV Inspector usam `resolveLoot`.
 * Capture/selamento NÃO passa daqui.
 * Guild Boss (`guild-store` copperReward) permanece fora — integração futura.
 *
 * Chance: 0–1. Não rebalanceia tabelas.
 */

import { isDevMode } from '@/config/devConfig';
import {
  copperRewardForKill,
  isNarutoLootTarget,
  resolveNarutoLootCharacterId,
  rollNarutoCharacterLoot,
} from '@/data/anime-loot';
import { hasNarutoLootProfile } from '@/data/naruto-loot-tiers';
import { getItem, getItemDefinition } from '@/data/items';
import { lootRandom } from '@/lib/loot-rng';
import { guildCopperBonusMultiplier, guildLootBonusMultiplier, vipEmptyLootRerollChance } from '@/lib/progression-bonuses';
import { applyVillageBonus } from '@/lib/village-bonuses';
import { heritageCombatExtras } from '@/lib/heritage-runtime';
import type { Enemy } from '@/entities/enemy';
import type { LootDropEntry, RewardItem, RewardResult, RolledLoot } from '@/types/loot';

export interface LootResolveInput {
  kills: number;
  enemyLevel: number;
  table?: readonly LootDropEntry[];
  naruto?: { lookType?: number | null; characterId?: string | null };
  includeCopper?: boolean;
  copperMultiplier?: number;
  rng?: () => number;
}

export function normalizeLootEntry(entry: LootDropEntry): {
  itemId: string;
  chance: number;
  quantityMin: number;
  quantityMax: number;
} {
  const quantityMin = Math.max(1, Math.floor(entry.minQuantity ?? entry.quantityMin ?? 1));
  const quantityMax = Math.max(quantityMin, Math.floor(entry.maxQuantity ?? entry.quantityMax ?? quantityMin));
  return { itemId: entry.itemId, chance: entry.chance, quantityMin, quantityMax };
}

export function effectiveDropChance(baseChance: number): number {
  const villageAdjusted = applyVillageBonus(baseChance, 'lootDropChance');
  const heritageBonus = 1 + (heritageCombatExtras().dropChancePercent ?? 0);
  const chance = Math.min(1, Math.max(0, villageAdjusted * heritageBonus * guildLootBonusMultiplier()));
  const reroll = vipEmptyLootRerollChance();
  if (reroll <= 0) return chance;
  return chance + (1 - chance) * reroll * chance;
}

export function sampleBinomial(n: number, p: number, rng: () => number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n < 12_000) {
    let hits = 0;
    for (let i = 0; i < n; i += 1) {
      if (rng() <= p) hits += 1;
    }
    return hits;
  }
  const fail = 1 - p;
  if (fail <= 0) return n;
  const logFail = Math.log(fail);
  let hits = 0;
  let index = 0;
  while (index < n) {
    const u = Math.max(Number.EPSILON, rng());
    index += Math.floor(Math.log(u) / logFail) + 1;
    if (index <= n) hits += 1;
  }
  return hits;
}

function rollQuantity(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function addItem(map: Map<string, number>, itemId: string, quantity: number): void {
  if (quantity <= 0) return;
  map.set(itemId, (map.get(itemId) ?? 0) + quantity);
}

function toResult(copper: number, map: Map<string, number>): RewardResult {
  return {
    copper: Math.max(0, Math.floor(copper)),
    items: [...map.entries()].map(([itemId, quantity]) => ({ itemId, quantity })),
  };
}

export function mergeRewardResults(...parts: RewardResult[]): RewardResult {
  const map = new Map<string, number>();
  let copper = 0;
  for (const part of parts) {
    copper += part.copper;
    for (const item of part.items) addItem(map, item.itemId, item.quantity);
  }
  return toResult(copper, map);
}

function resolveTableKills(
  table: readonly LootDropEntry[],
  kills: number,
  rng: () => number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const raw of table) {
    const entry = normalizeLootEntry(raw);
    const p = effectiveDropChance(entry.chance);
    const hits = sampleBinomial(kills, p, rng);
    let quantity = 0;
    for (let i = 0; i < hits; i += 1) {
      quantity += rollQuantity(entry.quantityMin, entry.quantityMax, rng);
    }
    addItem(map, entry.itemId, quantity);
  }
  return map;
}

function resolveNarutoKills(
  naruto: NonNullable<LootResolveInput['naruto']>,
  kills: number,
  rng: () => number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < kills; i += 1) {
    const rolled = rollNarutoCharacterLoot(naruto, rng);
    for (const drop of rolled) addItem(map, drop.itemId, drop.quantity);
  }
  return map;
}

function defaultCopperMultiplier(): number {
  return guildCopperBonusMultiplier();
}

export function resolveLoot(input: LootResolveInput): RewardResult {
  const kills = Math.max(0, Math.floor(input.kills));
  const rng = input.rng ?? lootRandom;
  const includeCopper = input.includeCopper !== false;
  const copperMult = input.copperMultiplier ?? defaultCopperMultiplier();

  let copper = 0;
  if (includeCopper && kills > 0) {
    for (let i = 0; i < kills; i += 1) {
      copper += copperRewardForKill(input.enemyLevel, rng);
    }
    copper = Math.floor(copper * copperMult);
  }

  const naruto = input.naruto;
  const useNaruto = Boolean(
    naruto &&
      (hasNarutoLootProfile(resolveNarutoLootCharacterId(naruto)) ||
        isNarutoLootTarget({
          lookType: naruto.lookType,
          sourceId: naruto.characterId,
        })),
  );

  const items = useNaruto
    ? resolveNarutoKills(naruto!, kills, rng)
    : resolveTableKills(input.table ?? [], kills, rng);

  return toResult(copper, items);
}

export function resolveLootFromEnemy(enemy: Enemy, kills = 1, rng?: () => number): RewardResult {
  const seal = enemy.definition.sealable;
  const naruto = seal
    ? { lookType: seal.lookType, characterId: seal.characterId }
    : undefined;
  return resolveLoot({
    kills,
    enemyLevel: enemy.stats.level,
    table: enemy.definition.loot,
    naruto,
    rng,
  });
}

export function rewardItemsToRolled(items: readonly RewardItem[]): RolledLoot[] {
  return items.map((item) => {
    const def = getItemDefinition(item.itemId);
    return {
      itemId: item.itemId,
      name: def?.name ?? item.itemId,
      quantity: item.quantity,
      rarity: def?.rarity ?? 'common',
    };
  });
}

export function lootTableIdForHunt(huntId: string): string {
  return `hunt:${huntId}`;
}

export function validateLootTable(table: LootTableLike, label: string): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, number>();
  table.entries.forEach((raw, index) => {
    const entry = normalizeLootEntry(raw);
    const key = `${label}[${index}] ${entry.itemId}`;
    const rawMin = raw.minQuantity ?? raw.quantityMin ?? 1;
    const rawMax = raw.maxQuantity ?? raw.quantityMax ?? rawMin;
    if (!getItem(entry.itemId)) warnings.push(`${key}: itemId inexistente`);
    if (!Number.isFinite(raw.chance) || raw.chance < 0 || raw.chance > 1) {
      warnings.push(`${key}: chance inválida (${String(raw.chance)})`);
    }
    if (rawMin > rawMax) warnings.push(`${key}: min > max`);
    if (rawMin <= 0) warnings.push(`${key}: quantity <= 0`);
    seen.set(entry.itemId, (seen.get(entry.itemId) ?? 0) + 1);
  });
  for (const [itemId, count] of seen) {
    if (count > 1) warnings.push(`${label}: entry duplicada de ${itemId} (${count}×) — pode ser intencional`);
  }
  return warnings;
}

interface LootTableLike {
  entries: readonly LootDropEntry[];
}

export function warnLootIssues(warnings: string[]): void {
  if (typeof window === 'undefined' || !isDevMode() || warnings.length === 0) return;
  for (const line of warnings) console.warn(`[Loot] ${line}`);
}
