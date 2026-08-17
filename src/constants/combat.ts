import type { HuntCatalog } from '@/types/hunt';

/** Combate idle — alcance de busca, ataque básico e respawn. */
export const PLAYER_ATTACK_RANGE = 52;
export const PLAYER_ATTACK_COOLDOWN_MS = 380;
/** Intervalo mínimo entre jutsus da hotbar (idle). */
export const PLAYER_JUTSU_GAP_MS = 4000;

/** Distância máxima para a IA procurar inimigos no mapa. */
export const IDLE_AGGRO_RANGE = 2400;

/** Inimigo → jogador: alcance do golpe corpo a corpo. */
export const ENEMY_ATTACK_RANGE = 44;
/** Intervalo entre golpes do inimigo. */
export const ENEMY_ATTACK_COOLDOWN_MS = 1200;
/** Fração da speed do monstro ao perseguir (patrol usa ~0.24). */
export const ENEMY_CHASE_SPEED_FACTOR = 0.55;
/** Tempo até o jogador reviver no mapa de caça. */
export const PLAYER_DEATH_RESPAWN_MS = 2800;

/** Inimigos reaparecem rapidamente para manter o fluxo da caça idle. */
export const ENEMY_RESPAWN_MS = 2800;
/** Mapas laterais (spawn esquerda/direita): renascimento mais rápido. */
export const LATERAL_SIDE_ENEMY_RESPAWN_MS = 1800;
/** Velocidade extra dos inimigos nos mapas laterais de caça. */
export const LATERAL_SIDE_ENEMY_SPEED_MULT = 1.3;
/** Corpo caído some antes do respawn (estilo idle MMO do vídeo ref.). */
export const ENEMY_CORPSE_MS = 900;
/**
 * Nameplate compacto na caça: moldura pixel + faixa de vida legível.
 * Antes: 28×4 + nome multi-linha com nível → empilhava e parecia “shatter”.
 */
export const ENEMY_HP_BAR_WIDTH = 42;
export const ENEMY_HP_BAR_HEIGHT = 5;
/** Espessura do contorno ao redor da trilha (px). */
export const ENEMY_HP_BAR_BORDER = 1;
/** Brilho superior sobre a vida (altura em px). */
export const ENEMY_HP_BAR_GLOSS_H = 1;
/** Espaço entre o topo do sprite e o fundo do nome. */
export const NAMEPLATE_GAP_PX = 5;
/** Espaço entre a barra de HP e o topo do nome. */
export const NAMEPLATE_BAR_GAP_PX = 4;

/** Bônus temporário de 1000% (10x) para testar a progressão até o nível 30. */
export const COMBAT_TEST_XP_MULTIPLIER = 110;

/**
 * TEST ONLY: force every hunt to this level end-to-end (easy revert: set `null`).
 * Covers: hunt requiredLevel (unlock + list "Nv"), target requiredLevel/level, HP, XP.
 * Apply via `applyForcedHuntLevels` at every catalog load (UI + spawns).
 * When set, HP and XP use the same curve as generate-wonsr-hunts.js.
 */
export const FORCE_HUNT_LEVEL: number | null = 1;

/** @deprecated Prefer FORCE_HUNT_LEVEL — kept as alias for older imports. */
export const FORCE_HUNT_ENEMY_LEVEL = FORCE_HUNT_LEVEL;

/** Stats curve mirrored from `scripts/generate-wonsr-hunts.js` → normalizedStats. */
export function huntEnemyStatsForLevel(level: number): {
  level: number;
  hp: number;
  xp: number;
} {
  return {
    level,
    hp: Math.round(45 + level * 16 + Math.pow(level, 1.18) * 2),
    xp: Math.round(10 + level * 3.5),
  };
}

/**
 * TEST ONLY: multiplica o HP de todo alvo de caça (easy revert: set `1`).
 * Aplicado junto de `applyForcedHuntLevels`, então vale para UI e spawns.
 */
export const TEST_ENEMY_HP_MULTIPLIER: number = 2;

/**
 * Rewrites all hunt + target levels when FORCE_HUNT_LEVEL is set and applies
 * TEST_ENEMY_HP_MULTIPLIER. Pure (returns a new catalog); no-op when neither
 * test flag is active.
 */
export function applyForcedHuntLevels(catalog: HuntCatalog): HuntCatalog {
  const forced = FORCE_HUNT_LEVEL;
  const hpMul = TEST_ENEMY_HP_MULTIPLIER;
  if (forced == null && hpMul === 1) return catalog;
  const stats = forced == null ? null : huntEnemyStatsForLevel(forced);
  return {
    ...catalog,
    hunts: catalog.hunts.map((hunt) => ({
      ...hunt,
      requiredLevel: forced ?? hunt.requiredLevel,
      targets: hunt.targets.map((target) => ({
        ...target,
        requiredLevel: forced ?? target.requiredLevel,
        level: stats?.level ?? target.level,
        hp: Math.round((stats?.hp ?? target.hp) * hpMul),
        xp: stats?.xp ?? target.xp,
      })),
    })),
  };
}
