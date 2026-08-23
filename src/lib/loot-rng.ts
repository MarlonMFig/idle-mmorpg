/**
 * RNG do Loot Engine. Produção = Math.random.
 * DEV: setLootRngSeed(n) para reproduzir drops.
 */

let lootSeed: number | null = null;
let lootState = 0;

export function setLootRngSeed(seed: number | null): void {
  lootSeed = seed;
  lootState = seed == null ? 0 : seed >>> 0;
}

export function getLootRngSeed(): number | null {
  return lootSeed;
}

function mulberry32(): number {
  lootState |= 0;
  lootState = (lootState + 0x6d2b79f5) | 0;
  let t = Math.imul(lootState ^ (lootState >>> 15), 1 | lootState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function lootRandom(): number {
  if (lootSeed == null) return Math.random();
  return mulberry32();
}
