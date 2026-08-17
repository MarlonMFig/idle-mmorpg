import type { WonsrDirection, WonsrSpriteFit } from '@/data/wonsr-sprites';
import type { MapKey } from '@/maps/map-registry';
import type { LootDropEntry } from '@/types/loot';

export interface EnemySpawn {
  x: number;
  y: number;
}

/** Animação de caminhada direcional (sheets WONSR) ou lateral curada. */
export interface EnemyWalkAnimation {
  directions: WonsrDirection[];
  /** direção → chave da animação de walk. */
  anims: Partial<Record<WonsrDirection, string>>;
  /** direção → frame parado (fase 0). */
  idleFrames: Partial<Record<WonsrDirection, number>>;
  /**
   * Sheet só de perfil (direita canônica): espelha no west.
   * Suporta idle/walk em texturas separadas.
   */
  lateral?: boolean;
  idleTextureKey?: string;
  walkTextureKey?: string;
  idleAnimKey?: string;
  walkAnimKey?: string;
  /** Hit reaction (play once). */
  hurtTextureKey?: string;
  hurtAnimKey?: string;
  /** Death (play once, hold last frame). */
  deathTextureKey?: string;
  deathAnimKey?: string;
  /**
   * Combo / ataque lateral (play once). Cicla `attackAnimKeys` a cada golpe.
   * Texturas em paralelo com o mesmo índice.
   */
  attackAnimKeys?: string[];
  attackTextureKeys?: string[];
}

/** @deprecated use LootDropEntry — mantido como alias. */
export type EnemyLootEntry = LootDropEntry;

/** Identidade selável propagada a partir do HuntTarget. */
export interface EnemySealableIdentity {
  /** Chave estável na coleção (sourceId da caça). */
  characterId: string;
  sourceId: string;
  name: string;
  lookType: number;
  /** Nível da caça (catálogo), independente de FORCE_HUNT_LEVEL no combate. */
  level?: number;
}

/** Definição autoritativa de um monstro. */
export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  level: number;
  xp: number;
  loot: LootDropEntry[];
  spawn: EnemySpawn;
  speed: number;
  chaseRadius: number;
  sprite: string;
  /** Frame opcional quando `sprite` aponta para um atlas Phaser. */
  spriteFrame?: string | number;
  /** Animação direcional quando o sprite é uma sheet de outfit WONSR. */
  walk?: EnemyWalkAnimation;
  /** Escala e âncora que padronizam a altura do desenho no mundo. */
  spriteFit?: WonsrSpriteFit;
  mapKey: MapKey;
  /** Presente quando o alvo da caça pode ser selado. */
  sealable?: EnemySealableIdentity;
  /** Sem auto-respawn (duelo sequencial). */
  noRespawn?: boolean;
  /** Override do ENEMY_RESPAWN_MS (ex.: mapa de teste farm). */
  respawnMs?: number;
}

export interface EnemyRuntimeStats {
  hp: number;
  hpMax: number;
  level: number;
  xp: number;
}
