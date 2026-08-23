/**
 * Centro de Cura (Item 42) — Copper sink no Hub.
 *
 * Auditoria de economia (provisória):
 * - Poção HP: 40 Copper (cura parcial in-hunt)
 * - Poção concentrada / ultra: 120 / 300
 * - Revive in-hunt: 350
 * - Scroll selamento: 25
 * - Loot de Hunt: dezenas de Copper por kill
 *
 * Meta: full heal no Hub mais barato que spam de poções + Revive,
 * mas nunca gratuito; KO (missingHp = hpMax) custa o máximo da faixa.
 */

export const MEDIC_CONFIG = {
  /**
   * Custo mínimo quando há HP faltante (> 0).
   * ~1 scroll / pouco abaixo de 1 poção básica.
   */
  minimumCost: 25,
  /** Parcela fixa somada ao custo por HP. */
  baseCost: 10,
  /**
   * Copper por ponto de HP faltante (antes de min/max).
   * 100 HP faltando ≈ 45 Copper (base+ratio), entre poção e Revive.
   */
  costPerMissingHp: 0.35,
  /**
   * Teto — abaixo de Revive (350) e próximo da Ultra potion (300).
   * Evita sinks absurdos em HP alto late-game.
   */
  maximumCost: 280,
} as const;

export type MedicConfig = typeof MEDIC_CONFIG;
