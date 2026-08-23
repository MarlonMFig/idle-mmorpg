/**
 * Combat Energy (Item 41) — recurso universal de combate.
 *
 * Skills consomem Energia.
 * Recuperação = regeneração passiva (tempo) + bônus por Basic Attack hit confirmado.
 *
 * Balance defaults (conservadores / fáceis de retocar):
 * - maxEnergy 100
 * - defaultSkillEnergyCost 40
 * - energyGainPerBasicHit 10
 * - energyRegenPerSecond 5 — ~8s de 0→40 sem basic; basic acelera
 */

export const COMBAT_ENERGY = {
  maxEnergy: 100,
  /** Custo padrão quando a Skill não define energyCost/chakraCost. */
  defaultSkillEnergyCost: 40,
  /** Recuperação por hit confirmado de Basic Attack (não Skill). */
  energyGainPerBasicHit: 10,
  /** Regeneração passiva por segundo de tempo de combate (não por frame). */
  energyRegenPerSecond: 5,
} as const;

export type CombatEnergyConfig = typeof COMBAT_ENERGY;

/** Ganho passivo puro (sem clamp) — útil em testes. */
export function computePassiveEnergyGain(
  deltaSeconds: number,
  regenPerSecond: number = COMBAT_ENERGY.energyRegenPerSecond,
): number {
  if (!(deltaSeconds > 0) || !(regenPerSecond > 0)) return 0;
  return regenPerSecond * deltaSeconds;
}
