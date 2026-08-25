import { BALANCE, XP_PER_HP, type Rarity } from './balance';
import { Decimal, d } from './decimal';
import type { Zone } from './types';

export function xpToNextLevel(level: number): Decimal {
  const n = Math.max(1, Math.floor(level));
  return d(BALANCE.XP_BASE).mul(Decimal.pow(BALANCE.XP_GROWTH, n - 1));
}

export function rarityDpsMultiplier(rarity: Rarity): number {
  return BALANCE.RARITY_DPS_MULT[rarity];
}

export function prestigeMultiplier(fragments: number): number {
  return 1 + Math.max(0, fragments) * BALANCE.PRESTIGE_BONUS;
}

/** 1.09^(n-1). Mesmo expoente de HP, DPS e força. */
export function combatGrowth(level: number): Decimal {
  const n = Math.max(1, Math.floor(level));
  return Decimal.pow(BALANCE.DPS_GROWTH, n - 1);
}

export function dps(level: number, fragments: number, rarity: Rarity): Decimal {
  return d(BALANCE.DPS_BASE)
    .mul(combatGrowth(level))
    .mul(prestigeMultiplier(fragments))
    .mul(rarityDpsMultiplier(rarity));
}

/**
 * Δ = nivelInimigo - nivelPersonagem.
 * DELTA_BONUS / DELTA_CAP só entram com Δ ≥ 0 (inimigo igual ou mais forte).
 * Com gating de hunt por requiredLevel, o caso típico é Δ ≤ 0.
 * Em DEV, forceHuntLevel ainda reescreve requiredLevel e deixa o level do
 * inimigo intacto — Δ > 0 continua alcançável nesse overlay.
 */
export function difficultyMultiplier(delta: number): number {
  const n = Math.trunc(delta);
  if (n >= 0) {
    return Math.min(BALANCE.DELTA_BONUS ** n, BALANCE.DELTA_CAP);
  }
  return Math.max(BALANCE.DELTA_PENALTY ** n, BALANCE.DELTA_FLOOR);
}

export function xpPerEnemy(enemyHp: Decimal, delta: number): Decimal {
  return enemyHp.mul(XP_PER_HP).mul(difficultyMultiplier(delta));
}

export function xpPerSecondAtDelta(level: number, fragments: number, rarity: Rarity, delta: number): Decimal {
  return dps(level, fragments, rarity).mul(XP_PER_HP).mul(difficultyMultiplier(delta));
}

export function possibleFragments(xpTotalHistoric: Decimal): number {
  if (xpTotalHistoric.lte(0)) return 0;
  const value = Math.floor(xpTotalHistoric.div(BALANCE.PRESTIGE_DIVISOR).sqrt().toNumber());
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function xpShare(slot: 0 | 1 | 2): number {
  return BALANCE.XP_SHARE[slot];
}

/**
 * Chance de selamento cai quando o Δ sobe — custo de empurrar zona alta.
 * Δ negativo não aumenta a chance acima da base (captura não é o farm).
 */
export function sealChance(delta: number): number {
  const n = Math.max(0, Math.trunc(delta));
  const chance = BALANCE.SEAL_CHANCE_BASE / BALANCE.SEAL_DELTA_FACTOR ** n;
  return Math.max(BALANCE.SEAL_CHANCE_MIN, chance);
}

export const ZONES: readonly Zone[] = Object.freeze([
  {
    id: 'calibracao',
    name: 'Calibração Δ+10',
    enemyName: 'Dummy +10',
    levelOffset: BALANCE.DELTA_TARGET,
    enemyHp: d(50),
  },
  {
    id: 'plano',
    name: 'Plano Δ0',
    enemyName: 'Slime',
    levelOffset: 0,
    enemyHp: d(40),
  },
  {
    id: 'plano-x100',
    name: 'Plano Δ0 HP×100',
    enemyName: 'Golem',
    levelOffset: 0,
    enemyHp: d(4000),
  },
]);

export function zoneById(id: string): Zone {
  return ZONES.find((zone) => zone.id === id) ?? ZONES[0];
}

export function enemyLevelFor(zone: Zone, slot0Level: number): number {
  return Math.max(1, Math.floor(slot0Level) + zone.levelOffset);
}
