import { getEnemyHpMultiplier, getForceHuntLevel } from '@/config/devConfig';
import { huntEnemyHpForLevel, huntEnemyXpForLevel } from '@/lib/hunt-enemy-xp';
import type { Decimal } from '@/lib/decimal';
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
export const ENEMY_ATTACK_COOLDOWN_MS = 1150;
/** Fração da speed do monstro ao perseguir (patrol usa ~0.24). */
export const ENEMY_CHASE_SPEED_FACTOR = 0.55;
/** Tempo até o jogador reviver no mapa de caça. */
export const PLAYER_DEATH_RESPAWN_MS = 2800;

/** Inimigos reaparecem rapidamente para manter o fluxo da caça idle. */
export const ENEMY_RESPAWN_MS = 2800;
/** Mapas laterais (spawn esquerda/direita): intervalo entre entradas (não espera a morte). */
export const LATERAL_SIDE_ENEMY_RESPAWN_MS = 800;
/** Quantos inimigos vivos no máximo no mapa lateral (fila continua se houver vaga). */
export const LATERAL_SIDE_MAX_ALIVE = 4;
/** Velocidade extra dos inimigos nos mapas laterais de caça. */
export const LATERAL_SIDE_ENEMY_SPEED_MULT = 1.7;
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

/** HP espelha o gerador WONSR. XP vem de `huntEnemyXpForLevel`. */
export function huntEnemyStatsForLevel(level: number): {
  level: number;
  hp: Decimal;
  xp: number;
} {
  return {
    level,
    hp: huntEnemyHpForLevel(level),
    xp: huntEnemyXpForLevel(level),
  };
}

/**
 * Aplica overlays de DEV (forceHuntLevel / enemyHpMultiplier).
 * Com Test Mode desligado, devolve o catálogo oficial sem mudanças.
 */
export function applyForcedHuntLevels(catalog: HuntCatalog): HuntCatalog {
  const forced = getForceHuntLevel();
  const hpMul = getEnemyHpMultiplier();
  if (forced == null && hpMul === 1) return catalog;
  return {
    ...catalog,
    hunts: catalog.hunts.map((hunt) => ({
      ...hunt,
      requiredLevel: forced ?? hunt.requiredLevel,
      targets: hunt.targets.map((target) => ({
        ...target,
        requiredLevel: forced ?? target.requiredLevel,
        level: target.level,
        hp: Math.round(target.hp * hpMul),
        xp: target.xp,
      })),
    })),
  };
}
