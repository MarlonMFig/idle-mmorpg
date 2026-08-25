import {
  getNarutoCharacterTier,
  getNarutoFragmentChance,
  getNarutoLootRollChances,
  listNarutoTierCharacterIds,
  NARUTO_CHARACTER_LOOT,
  narutoFragmentItemId,
  type NarutoLootTier,
} from '@/data/naruto-loot-tiers';
import {
  expectedGeneralLootEvPerKill,
  getWorldGeneralDropChance,
  getWorldGeneralLootPool,
  poolWeightTotal,
  type WorldId,
} from '@/data/world-general-loot';
import { getItem } from '@/data/items';
import { getItemSellValue } from '@/data/shop';
import { huntEnemyHpForLevel, estimateHuntKillsPerMinute } from '@/lib/hunt-enemy-xp';
import {
  LOOT_ECONOMY_HUNT_LEVEL,
  NARUTO_FRAGMENT_SELL_BY_TIER,
} from '@/constants/loot-economy';
import { resolveLoot } from '@/systems/loot-engine';

export function expectedCopperPerKill(enemyLevel: number): number {
  const safe = Math.max(1, Math.floor(enemyLevel) || 1);
  const coinMax = Math.max(2, Math.min(25, Math.ceil(safe / 3)));
  return (coinMax + 1) / 2;
}

export function killsPerHourForHuntLevel(level: number): number {
  const hp = huntEnemyHpForLevel(level);
  return estimateHuntKillsPerMinute(level, hp) * 60;
}

export interface CharacterLootEconomyRow {
  characterId: string;
  tier: NarutoLootTier;
  secondaryItemId: string;
  secondaryName: string;
  secondaryChance: number;
  secondarySell: number;
  secondaryEv: number;
  signatureItemId: string;
  signatureName: string;
  signatureChance: number;
  signatureSell: number;
  signatureEv: number;
  fragmentItemId: string;
  fragmentChance: number;
  fragmentSell: number;
  fragmentEv: number;
  generalEv: number;
  copperPerKill: number;
  lootEvPerKill: number;
  economicEvPerKill: number;
  killsPerHour: number;
  expectedPerHour: number;
}

export function inspectWorldGeneralLoot(worldId: WorldId, tier: NarutoLootTier) {
  const chance = getWorldGeneralDropChance(worldId, tier);
  const pool = getWorldGeneralLootPool(worldId, tier);
  const total = poolWeightTotal(pool);
  const rows = pool.map((entry) => {
    const normalized = total > 0 ? entry.weight / total : 0;
    const sell = getItemSellValue(entry.itemId);
    return {
      itemId: entry.itemId,
      name: getItem(entry.itemId)?.name ?? entry.itemId,
      weight: entry.weight,
      normalized,
      sellPrice: sell,
      evIfGeneralHits: normalized * sell,
      evPerKill: chance * normalized * sell,
    };
  });
  return {
    worldId,
    tier,
    dropChance: chance,
    pool,
    rows,
    expectedEvPerKill: expectedGeneralLootEvPerKill(worldId, tier),
  };
}

export function analyzeCharacterLootEconomy(characterId: string): CharacterLootEconomyRow | null {
  const profile = NARUTO_CHARACTER_LOOT[characterId];
  const tier = getNarutoCharacterTier(characterId);
  if (!profile || tier == null) return null;
  const chances = getNarutoLootRollChances(tier);
  const huntLevel = LOOT_ECONOMY_HUNT_LEVEL[tier];
  const kph = killsPerHourForHuntLevel(huntLevel);
  const copper = expectedCopperPerKill(huntLevel);
  const secondarySell = getItemSellValue(profile.secondaryItemId);
  const signatureSell = getItemSellValue(profile.signatureItemId);
  const fragmentChance = getNarutoFragmentChance(tier);
  const fragmentSell = NARUTO_FRAGMENT_SELL_BY_TIER[tier];
  const secondaryEv = chances.secondary * secondarySell;
  const signatureEv = chances.signature * signatureSell;
  const fragmentEv = fragmentChance * fragmentSell;
  const generalEv = expectedGeneralLootEvPerKill('naruto', tier);
  const lootEv = secondaryEv + signatureEv + fragmentEv + generalEv;
  return {
    characterId,
    tier,
    secondaryItemId: profile.secondaryItemId,
    secondaryName: getItem(profile.secondaryItemId)?.name ?? profile.secondaryItemId,
    secondaryChance: chances.secondary,
    secondarySell,
    secondaryEv,
    signatureItemId: profile.signatureItemId,
    signatureName: getItem(profile.signatureItemId)?.name ?? profile.signatureItemId,
    signatureChance: chances.signature,
    signatureSell,
    signatureEv,
    fragmentItemId: narutoFragmentItemId(characterId),
    fragmentChance,
    fragmentSell,
    fragmentEv,
    generalEv,
    copperPerKill: copper,
    lootEvPerKill: lootEv,
    economicEvPerKill: lootEv + copper,
    killsPerHour: kph,
    expectedPerHour: (lootEv + copper) * kph,
  };
}

export interface PercentileSummary {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  average: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[idx] ?? 0;
}

export function summarizeSamples(samples: number[]): PercentileSummary {
  const sorted = [...samples].sort((a, b) => a - b);
  const average = sorted.length === 0 ? 0 : sorted.reduce((s, n) => s + n, 0) / sorted.length;
  return {
    p10: percentile(sorted, 10),
    p25: percentile(sorted, 25),
    p50: percentile(sorted, 50),
    p75: percentile(sorted, 75),
    p90: percentile(sorted, 90),
    average,
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function simulateLootHourValue(params: {
  characterId: string;
  hours?: number;
  seed?: number;
}): { samples: number[]; summary: PercentileSummary; copper: number[]; lootSell: number[] } {
  const hours = Math.max(1, Math.floor(params.hours ?? 1));
  const row = analyzeCharacterLootEconomy(params.characterId);
  if (!row) {
    return { samples: [], summary: summarizeSamples([]), copper: [], lootSell: [] };
  }
  const rng = mulberry32(params.seed ?? 1);
  const kills = Math.max(1, Math.round(row.killsPerHour));
  const samples: number[] = [];
  const copper: number[] = [];
  const lootSell: number[] = [];
  for (let h = 0; h < hours; h += 1) {
    const result = resolveLoot({
      kills,
      enemyLevel: LOOT_ECONOMY_HUNT_LEVEL[row.tier],
      naruto: { characterId: params.characterId },
      copperMultiplier: 1,
      rng,
    });
    let sell = 0;
    for (const item of result.items) {
      sell += getItemSellValue(item.itemId) * item.quantity;
    }
    copper.push(result.copper);
    lootSell.push(sell);
    samples.push(result.copper + sell);
  }
  return { samples, summary: summarizeSamples(samples), copper, lootSell };
}

export function simulateTierHourValue(params: {
  tier: NarutoLootTier;
  hours?: number;
  seed?: number;
}): PercentileSummary & { copperAverage: number; lootAverage: number } {
  const ids = listNarutoTierCharacterIds().filter((id) => getNarutoCharacterTier(id) === params.tier);
  const hours = Math.max(1, Math.floor(params.hours ?? 10_000));
  const rng = mulberry32(params.seed ?? 20260823 + params.tier);
  const samples: number[] = [];
  let copperSum = 0;
  let lootSum = 0;
  const huntLevel = LOOT_ECONOMY_HUNT_LEVEL[params.tier];
  const kills = Math.max(1, Math.round(killsPerHourForHuntLevel(huntLevel)));
  for (let h = 0; h < hours; h += 1) {
    const characterId = ids[h % ids.length]!;
    const result = resolveLoot({
      kills,
      enemyLevel: huntLevel,
      naruto: { characterId },
      copperMultiplier: 1,
      rng,
    });
    let sell = 0;
    for (const item of result.items) {
      sell += getItemSellValue(item.itemId) * item.quantity;
    }
    copperSum += result.copper;
    lootSum += sell;
    samples.push(result.copper + sell);
  }
  return {
    ...summarizeSamples(samples),
    copperAverage: hours > 0 ? copperSum / hours : 0,
    lootAverage: hours > 0 ? lootSum / hours : 0,
  };
}

