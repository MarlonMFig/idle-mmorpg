/**
 * Maestria da CharacterInstance — progressão de uso, independente de Level/Stars.
 * Sem bônus de atributo. Somente kills ONLINE.
 */

export const MASTERY_MAX_LEVEL = 100;

/** Default de save legado / captura nova. Sem cálculo retroativo. */
export const MASTERY_DEFAULT_LEVEL = 0;
export const MASTERY_DEFAULT_XP = 0;

/**
 * Custo para sair do nível `level` → `level + 1`:
 * 100 + (masteryLevel × 20)
 */
export const MASTERY_XP_BASE = 100;
export const MASTERY_XP_PER_LEVEL = 20;

/** Teto de Mastery XP por kill (Hunt Lv90+). */
export const MASTERY_XP_PER_KILL_MAX = 10;

/** Offline Simulator nunca concede Maestria. */
export const OFFLINE_MASTERY_XP = 0;

/** Marcos reservados para rewards futuros. Sem bônus automático. */
export const MASTERY_MILESTONES = [10, 25, 50, 75, 100] as const;

export type MasteryMilestone = (typeof MASTERY_MILESTONES)[number];

export const MASTERY_KILLS_PER_HOUR_SCENARIOS = [100, 300, 500, 1000] as const;
export const MASTERY_REPORT_LEVELS = [10, 25, 50, 75, 100] as const;

export function clampMasteryLevel(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MASTERY_DEFAULT_LEVEL;
  return Math.max(0, Math.min(MASTERY_MAX_LEVEL, Math.floor(value)));
}

export function clampMasteryXp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MASTERY_DEFAULT_XP;
  return Math.max(0, Math.floor(value));
}

/**
 * Mastery XP por kill ONLINE, segundo o nível da Hunt.
 * Lv1–9 = 1 … Lv90+ = 10. Sem multiplicadores de Player/VIP/DEV.
 */
export function getMasteryXpPerKill(huntLevel: number): number {
  const level = Math.max(1, Math.floor(Number(huntLevel) || 1));
  return Math.min(MASTERY_XP_PER_KILL_MAX, Math.floor(level / 10) + 1);
}
