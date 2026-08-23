import { isDevMode } from '@/config/devConfig';
import type { CharacterQuality } from '@/types/character-meta';

export type CaptureForceMode = 'off' | 'success' | 'failure';
export type ForceSpawnQuality = CharacterQuality | 'random';

let forceMode: CaptureForceMode = 'off';
let forceSpawnQuality: ForceSpawnQuality = 'random';

export function setCaptureForceMode(mode: CaptureForceMode): void {
  forceMode = isDevMode() ? mode : 'off';
}

export function getCaptureForceMode(): CaptureForceMode {
  return isDevMode() ? forceMode : 'off';
}

/** Somente DEV. Não persiste no save. */
export function setForceSpawnQuality(quality: ForceSpawnQuality): void {
  forceSpawnQuality = isDevMode() ? quality : 'random';
}

export function getForceSpawnQuality(): ForceSpawnQuality | null {
  return isDevMode() ? forceSpawnQuality : null;
}
