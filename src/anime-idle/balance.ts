/**
 * Único ponto de balanceamento do Anime Idle World.
 * Nenhum destes números deve ser copiado em outro arquivo.
 *
 * Ritmo: XP_GROWTH / RATE_GROWTH ≈ 1.018 — o tempo por nível dobra a cada ~38 níveis.
 *
 * XP/s é emergente: (dps / hpInimigo) * xpPorInimigo.
 * Amarrar XP ao HP cancela o HP e deixa a curva lisa; sem o multiplicador de Δ
 * o XP/s ficaria idêntico em toda zona. Por isso:
 *   xpPorInimigo = hp * XP_POR_HP * multDificuldade(Δ)
 * Subir (Δ > 0) é suave e tem TETO — senão o ótimo vira sempre empurrar ao máximo.
 * Descer (Δ < 0) é íngreme e tem PISO — farmar zona confortável não pode ser viável.
 *
 * A curva foi calibrada em DELTA_ALVO = +10 (mult ≈ 1,48). Se o Δ médio real
 * divergir, ajuste RATE_BASE e DPS_BASE juntos: XP_POR_HP = RATE_BASE / DPS_BASE.
 *
 * DPS_GROWTH TEM que ser igual a RATE_GROWTH. XP/s de base = dps * XP_POR_HP.
 */
export const BALANCE = Object.freeze({
  XP_BASE: 360,
  XP_GROWTH: 1.11,
  /** 0.9 × DPS_BASE — XP_POR_HP = RATE_BASE / DPS_BASE. */
  RATE_BASE: 6.075,
  RATE_GROWTH: 1.09,
  DPS_BASE: 6.75,
  DPS_GROWTH: 1.09,
  HP_BASE: 63,
  HP_GROWTH: 1.09,
  /** Golpe básico do inimigo no nível 1 (antes: floor(5+1.65)). */
  ENEMY_ATK_BASE: 6,
  DELTA_BONUS: 1.04,
  DELTA_CAP: 2.5,
  DELTA_PENALTY: 1.12,
  DELTA_FLOOR: 0.05,
  DELTA_TARGET: 10,
  XP_SHARE: Object.freeze([1.0, 0.3, 0.1] as const),
  PRESTIGE_DIVISOR: 2e7,
  PRESTIGE_BONUS: 0.02,
  MAX_DT_SECONDS: 7 * 24 * 60 * 60,
  MAX_LEVEL_ITERS: 50_000,
  SEAL_CHANCE_BASE: 0.08,
  SEAL_CHANCE_MIN: 0.005,
  SEAL_DELTA_FACTOR: 1.08,
  RARITY_DPS_MULT: Object.freeze({
    C: 1,
    R: 1.15,
    SR: 1.35,
    SSR: 1.6,
  }),
} as const);

export type Rarity = keyof typeof BALANCE.RARITY_DPS_MULT;

if (BALANCE.DPS_GROWTH !== BALANCE.RATE_GROWTH) {
  throw new Error('DPS_GROWTH deve ser idêntico a RATE_GROWTH — a curva de XP/s quebra em silêncio.');
}
if (BALANCE.HP_GROWTH !== BALANCE.DPS_GROWTH) {
  throw new Error('HP_GROWTH deve ser idêntico a DPS_GROWTH — TTK explode ou colapsa em silêncio.');
}

/** RATE_BASE / DPS_BASE. Não digitar 1.2 solto. */
export const XP_PER_HP = BALANCE.RATE_BASE / BALANCE.DPS_BASE;
