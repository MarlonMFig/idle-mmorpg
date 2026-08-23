/**
 * Shared boss damage commit math (Guild Boss + World Boss).
 * acceptedDamage = min(submitted, remainingHp); never negative HP.
 */

export function computeAcceptedBossDamage(
  submittedDamage: number,
  currentHp: number,
): number {
  if (!(currentHp > 0)) return 0;
  const raw = Math.max(0, Math.floor(submittedDamage));
  if (!Number.isFinite(raw)) return 0;
  return Math.min(raw, currentHp);
}

export function applyAcceptedBossDamage(
  currentHp: number,
  acceptedDamage: number,
): { currentHp: number; defeated: boolean } {
  const hp = Math.max(0, Math.floor(currentHp) - Math.max(0, Math.floor(acceptedDamage)));
  return { currentHp: hp, defeated: hp <= 0 };
}
