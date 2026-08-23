/** Regras de captura/selamento — valores oficiais atuais, sem rebalancear. */

export const CAPTURE_INITIAL_LEVEL = 1;
export const CAPTURE_INITIAL_XP = 0;
export const CAPTURE_INITIAL_STARS = 0;

export function clampCaptureChance(chance: number): number {
  if (!Number.isFinite(chance)) return 0;
  return Math.min(1, Math.max(0, chance));
}

export function formatCapturePercent(chance: number): string {
  return `${Math.round(clampCaptureChance(chance) * 100)}%`;
}
