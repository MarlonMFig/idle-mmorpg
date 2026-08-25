import { BALANCE, XP_PER_HP } from '@/anime-idle/balance';
import { combatGrowth } from '@/anime-idle/formulas';
import { qualityStatMidpoint } from '@/constants/character-quality-stats';
import { BASE_ATTRIBUTES, LEVEL_ATTRIBUTE_GROWTH } from '@/constants/attributes';
import { Decimal, d } from '@/lib/decimal';

/** Espelha `PLAYER_ATTACK_COOLDOWN_MS` / `LATERAL_SIDE_ENEMY_RESPAWN_MS` (evita ciclo combat ↔ XP). */
const BASIC_ATTACK_MS = 380;
const MIN_SPAWN_CYCLE_MS = 800;

/**
 * Curva suave de tempo acumulado Lv1 → L, calibrada em:
 * T(10) ≈ 5 min e T(50) ≈ 60 min.
 * Os demais checkpoints (20/30/40) emergem da parábola — não são tabelados.
 *
 * T(n) = A*(n-1) + B*(n-1)^2
 */
const T10 = 5;
const T50 = 60;
const N10 = 9;
const N50 = 49;
const B =
  (T50 - (N50 * T10) / N10) / (N50 * N50 - (N50 * N10 * N10) / N10);
const A = T10 / N10 - B * N10;

/** Se a simulação 1→50 sair da faixa 54–66, ajustar só este fator. */
export const HUNT_ENEMY_XP_TIME_SCALE = 0.974;

export const LEGACY_HUNT_ENEMY_XP_LINEAR = 3.5;
export const LEGACY_HUNT_ENEMY_XP_BASE = 10;

export function legacyHuntEnemyXp(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return Math.round(LEGACY_HUNT_ENEMY_XP_BASE + safe * LEGACY_HUNT_ENEMY_XP_LINEAR);
}

/** HP oficial do inimigo de caça: HP_BASE * HP_GROWTH^(n-1). */
export function huntEnemyHpForLevel(level: number): Decimal {
  const n = Math.max(1, Math.floor(level));
  return d(BALANCE.HP_BASE).mul(Decimal.pow(BALANCE.HP_GROWTH, n - 1));
}

/**
 * ATK do inimigo acompanha o HP linear do jogador (não o DPS 1.09^n).
 * Assim a ficha fica em centenas/milhares e os hits-para-morrer ~ HP_BASE/ATK_BASE.
 */
export function huntEnemyAtkForLevel(level: number): Decimal {
  const n = Math.max(1, Math.floor(level));
  const playerHp = BASE_ATTRIBUTES.hp + LEVEL_ATTRIBUTE_GROWTH.hp * (n - 1);
  return Decimal.max(
    d(2),
    d(BALANCE.ENEMY_ATK_BASE).mul(playerHp).div(BASE_ATTRIBUTES.hp),
  );
}

/**
 * Kills/min determinístico: starter Common (D, midpoint), sem skills.
 * cycle = max(TTK básico, intervalo mínimo de spawn lateral).
 */
export function estimateHuntKillsPerMinute(playerLevel: number, enemyHp: number | Decimal): number {
  const level = Math.max(1, Math.floor(playerLevel));
  const hp = Decimal.max(d(1), d(enemyHp));
  const baseAtk = d(BASE_ATTRIBUTES.strength).mul(combatGrowth(level));
  const atk = Decimal.max(d(1), baseAtk.mul(qualityStatMidpoint('D')).floor());
  const hits = Math.max(1, Math.ceil(hp.div(atk).toNumber()));
  const ttkMs = hits * BASIC_ATTACK_MS;
  const cycleMs = Math.max(ttkMs, MIN_SPAWN_CYCLE_MS);
  return 60_000 / cycleMs;
}

export function estimatedMinutesToReachLevel(targetLevel: number): number {
  const n = Math.max(1, Math.floor(targetLevel)) - 1;
  return Math.max(0, A * n + B * n * n);
}

export function estimatedMinutesForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return Math.max(
    1 / 60,
    estimatedMinutesToReachLevel(safe + 1) - estimatedMinutesToReachLevel(safe),
  );
}

/**
 * XP de catálogo em Δ = 0 (hp × XP_POR_HP).
 * O kill real aplica dificuldade(Δ) em `computeHuntKillXp`.
 */
export function huntEnemyXpForLevel(level: number): number {
  const hp = huntEnemyHpForLevel(level);
  return Math.max(1, Math.round(hp.mul(XP_PER_HP).toNumber()));
}
