/**
 * Compat: selamento aponta para o Capture Engine.
 * Não duplicar fórmula aqui.
 */
export {
  attemptCapture,
  getCaptureChance,
  getSealingScrollConfig,
  isEnemySealable,
  pickSelectedSealingScroll,
  pickSealingScroll,
  simulateCaptureBatch,
  toSealAttemptResult,
  type CaptureResult,
  type CaptureChanceBreakdown,
  type SealAttemptResult,
  type SealRng,
} from '@/systems/capture-engine';

import {
  attemptCapture,
  toSealAttemptResult,
  type SealAttemptResult,
  type SealRng,
} from '@/systems/capture-engine';
import type { EnemyDefinition } from '@/types/enemy';

export interface TrySealEnemyOptions {
  manual?: boolean;
}

export function trySealEnemy(
  definition: EnemyDefinition,
  rng: SealRng = Math.random,
  options?: TrySealEnemyOptions,
): SealAttemptResult {
  return toSealAttemptResult(
    attemptCapture({
      target: definition,
      source: options?.manual ? 'manual' : 'auto',
      attemptKey: definition.id,
      rng,
    }),
  );
}

/** Analytics agora entram no Capture Engine. Mantido como no-op seguro. */
export function recordSealAnalytics(_seal: SealAttemptResult): void {
  /* engine registra */
}
