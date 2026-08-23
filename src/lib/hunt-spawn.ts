import { spawnWeightForQuality } from '@/constants/capture-rarity';
import { rollQualityStatMultiplier } from '@/constants/character-quality-stats';
import { getForceSpawnQuality } from '@/lib/capture-dev';
import { CHARACTER_QUALITIES, type CharacterQuality } from '@/types/character-meta';
import type { HuntTarget } from '@/types/hunt';

export type SpawnRng = () => number;

export function pickWeightedIndex(weights: readonly number[], rng: SpawnRng): number {
  const safe = weights.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = safe.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  let roll = rng() * total;
  for (let i = 0; i < safe.length; i += 1) {
    roll -= safe[i]!;
    if (roll < 0) return i;
  }
  return safe.length - 1;
}

/**
 * Hunt escolhe o personagem (pool do mapa).
 * Qualidade NÃO é rolada aqui — só após sucesso de captura (`rollCaptureQualityBundle`).
 */
export function pickHuntTargetIndex(
  targets: readonly HuntTarget[],
  spawnIndex: number,
  _rng: SpawnRng = Math.random,
): number {
  if (targets.length <= 0) return 0;
  return spawnIndex % targets.length;
}

/** Tabela de pesos (inalterada) — usada na captura, não no spawn da Hunt. */
export function rollSpawnQualityFromWeights(rng: SpawnRng = Math.random): CharacterQuality {
  const weights = CHARACTER_QUALITIES.map((quality) => spawnWeightForQuality(quality));
  const index = pickWeightedIndex(weights, rng);
  return CHARACTER_QUALITIES[index] ?? 'D';
}

/**
 * Quality RNG oficial: somente após capture success.
 * Force DEV (`getForceSpawnQuality`) aplica neste momento, não no inimigo da Hunt.
 */
export function rollCaptureQualityBundle(rng: SpawnRng = Math.random): {
  quality: CharacterQuality;
  qualityStatMultiplier: number;
} {
  const forced = getForceSpawnQuality();
  const quality =
    forced && forced !== 'random' ? forced : rollSpawnQualityFromWeights(rng);
  return { quality, qualityStatMultiplier: rollQualityStatMultiplier(quality, rng) };
}

export function emptyQualityCounts(): Record<CharacterQuality, number> {
  return { D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0 };
}

export function simulateSpawnQualityCounts(
  n: number,
  rng: SpawnRng = Math.random,
): Record<CharacterQuality, number> {
  const counts = emptyQualityCounts();
  for (let i = 0; i < n; i += 1) {
    counts[rollSpawnQualityFromWeights(rng)] += 1;
  }
  return counts;
}
