export type NarutoLootTier = 1 | 2 | 3 | 4 | 5;

/**
 * Chances base de Secondary / Signature por tier de Hunt.
 * Independentes. Fragmento continua em NARUTO_FRAGMENT_EXPECTED_KILLS.
 */
export const LOOT_TIER_ROLL_CHANCES: Record<
  NarutoLootTier,
  { secondary: number; signature: number }
> = {
  1: { secondary: 0.12, signature: 0.03 },
  2: { secondary: 0.12, signature: 0.03 },
  3: { secondary: 0.11, signature: 0.025 },
  4: { secondary: 0.1, signature: 0.02 },
  5: { secondary: 0.09, signature: 0.015 },
};

/** Nível de inimigo representativo da Hunt/tier (simulação econômica). */
export const LOOT_ECONOMY_HUNT_LEVEL: Record<NarutoLootTier, number> = {
  1: 5,
  2: 15,
  3: 25,
  4: 40,
  5: 50,
};

/**
 * Sell NPC de fragmentos de personagem (não confundir com Fragmento de Chakra Bestial).
 * Um valor por tier — sem dezenas de preços arbitrários.
 */
export const NARUTO_FRAGMENT_SELL_BY_TIER: Record<NarutoLootTier, number> = {
  1: 600,
  2: 900,
  3: 1_200,
  4: 1_600,
  5: 2_000,
};

export const NARUTO_GENERIC_FRAGMENT_SELL = NARUTO_FRAGMENT_SELL_BY_TIER[1];

export const LOOT_ECONOMY_P50_TARGET: Record<NarutoLootTier, { min: number; max: number }> = {
  1: { min: 1_500, max: 3_000 },
  2: { min: 3_000, max: 5_000 },
  3: { min: 6_000, max: 10_000 },
  4: { min: 12_000, max: 18_000 },
  5: { min: 25_000, max: 40_000 },
};
