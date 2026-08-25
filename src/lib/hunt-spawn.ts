import { spawnWeightForQuality } from '@/constants/capture-rarity';
import { derivePotentialFields } from '@/constants/character-quality-stats';
import { getForceSpawnQuality } from '@/lib/capture-dev';
import { rollCaptureBundle, type CharacterPotential } from '@/lib/raridade-potencial.js';
import { CHARACTER_QUALITIES, type CharacterGrade, type CharacterQuality } from '@/types/character-meta';
import type { EnemyDefinition } from '@/types/enemy';
import type { HuntTarget } from '@/types/hunt';
import { isCharacterQuality } from '@/utils/character-identity';

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
 * Qualidade da instância NÃO é rolada aqui — só após sucesso (`rollCaptureQualityBundle`).
 */
export function pickHuntTargetIndex(
  targets: readonly HuntTarget[],
  spawnIndex: number,
  _rng: SpawnRng = Math.random,
): number {
  if (targets.length <= 0) return 0;
  return spawnIndex % targets.length;
}

/** Pesos de CONFIG.qualidades — aparição / chance de selar, não o resultado da captura. */
export function rollSpawnQualityFromWeights(rng: SpawnRng = Math.random): CharacterQuality {
  const weights = CHARACTER_QUALITIES.map((quality) => spawnWeightForQuality(quality));
  const index = pickWeightedIndex(weights, rng);
  return CHARACTER_QUALITIES[index] ?? 'D';
}

/** Aparição (chance de selar): force DEV > quality no selável > pesos. */
export function resolveAppearanceQuality(
  definition?: EnemyDefinition | null,
  rng: SpawnRng = Math.random,
): CharacterQuality {
  const forced = getForceSpawnQuality();
  if (forced && forced !== 'random') return forced;
  const existing = definition?.sealable?.quality;
  if (isCharacterQuality(existing)) return existing;
  return rollSpawnQualityFromWeights(rng);
}

export type CaptureQualityBundle = {
  quality: CharacterQuality;
  potential: CharacterPotential;
  potentialTotal: number;
  grade: CharacterGrade;
  qualityStatMultiplier: number;
};

/**
 * Chamar SOMENTE depois de attemptCapture confirmar sucesso.
 * O módulo não falha — só escolhe qualidade + potencial.
 */
export function rollCaptureQualityBundle(
  rng: SpawnRng = Math.random,
  _definition?: EnemyDefinition | null,
): CaptureQualityBundle {
  const bundle = rollCaptureBundle({ rng });
  const forced = getForceSpawnQuality();
  if (forced && forced !== 'random') {
    const derived = derivePotentialFields(forced, bundle.potential);
    return { ...derived, quality: forced };
  }
  return {
    quality: bundle.quality,
    potential: bundle.potential,
    potentialTotal: bundle.potentialTotal,
    grade: bundle.grade,
    qualityStatMultiplier: bundle.qualityStatMultiplier,
  };
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
