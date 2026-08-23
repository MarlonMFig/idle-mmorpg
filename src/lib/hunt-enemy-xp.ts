import { qualityStatMidpoint } from '@/constants/character-quality-stats';
import { BASE_ATTRIBUTES, LEVEL_ATTRIBUTE_GROWTH } from '@/constants/attributes';
import { getXpRequiredForLevel } from '@/lib/player-progression';

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

/** HP oficial do inimigo de caça (espelha `huntEnemyStatsForLevel`). */
export function huntEnemyHpForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  return Math.round(45 + safe * 16 + Math.pow(safe, 1.18) * 2);
}

/**
 * Kills/min determinístico: starter Common (D, midpoint), sem skills.
 * cycle = max(TTK básico, intervalo mínimo de spawn lateral).
 */
export function estimateHuntKillsPerMinute(playerLevel: number, enemyHp: number): number {
  const level = Math.max(1, Math.floor(playerLevel));
  const baseAtk = BASE_ATTRIBUTES.strength + LEVEL_ATTRIBUTE_GROWTH.strength * Math.max(0, level - 1);
  const atk = Math.max(1, Math.floor(baseAtk * qualityStatMidpoint('D')));
  const hits = Math.max(1, Math.ceil(Math.max(1, enemyHp) / atk));
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
 * XP base por kill (antes de level-gap, VIP e stage).
 * 1–49: calibração para a curva de tempo.
 * 50+: continua a reta legado a partir do valor de Lv49 (sem cliff / sem meta 50+).
 */
export function huntEnemyXpForLevel(level: number): number {
  const safe = Math.max(1, Math.floor(level));
  if (safe >= 50) {
    const at49 = huntEnemyXpForLevel(49);
    return Math.max(
      1,
      Math.round((at49 * legacyHuntEnemyXp(safe)) / legacyHuntEnemyXp(49)),
    );
  }
  const kpm = estimateHuntKillsPerMinute(safe, huntEnemyHpForLevel(safe));
  const minutes = estimatedMinutesForLevel(safe);
  const need = getXpRequiredForLevel(safe);
  const raw = need / (minutes * Math.max(0.25, kpm) * HUNT_ENEMY_XP_TIME_SCALE);
  return Math.max(1, Math.round(raw));
}
