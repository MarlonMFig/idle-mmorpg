import type { CombatAffinityFields } from '@/data/damage-elements';
import type { CaptureEnemyTier } from '@/constants/capture-system';
import type { CharacterQuality } from '@/types/character-meta';
import type { WonsrDirection, WonsrSpriteFit } from '@/data/wonsr-sprites';
import type { MapKey } from '@/maps/map-registry';
import type { LootDropEntry } from '@/types/loot';
import type { Decimal } from '@/lib/decimal';

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
  /** Nível da caça (catálogo). */
  level?: number;
  /**
   * Legado: quality NÃO é rolada no spawn e NÃO afeta combate.
   * Captura ignora este campo e rola após sucesso.
   */
  quality?: CharacterQuality;
  qualityStatMultiplier?: number;
  /** ETAPA 1 do spec de captura (comum/elite/raro/chefe). Qualidade não entra. */
  captureTier?: CaptureEnemyTier;
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
  /**
   * Hunt: HP vem de `63 * 1.09^(nível-1)`, não do JSON.
   * Boss / dummy / mapa solto: usa `hp` explícito.
   */
  combatHpFromLevel?: boolean;
  /** Sem auto-respawn (duelo sequencial). */
  noRespawn?: boolean;
  /** Override do ENEMY_RESPAWN_MS (ex.: mapa de teste farm). */
  respawnMs?: number;
  /**
   * melee = Hunt padrão.
   * external = persegue, mas ataques vêm de outro sistema (Boss AI).
   */
  aiMode?: 'melee' | 'external';
  /** Habilidades WONSR (XML) usadas no golpe contra o jogador. */
  skills?: EnemySkill[];
  /** Mesma estrutura de players. Ausente = vazio. */
  resistances?: CombatAffinityFields['resistances'];
  immunities?: CombatAffinityFields['immunities'];
  statusResistances?: CombatAffinityFields['statusResistances'];
  statusImmunities?: CombatAffinityFields['statusImmunities'];
}

export interface EnemySkill {
  name: string;
  intervalMs: number;
  min: number;
  max: number;
  /** Alcance em tiles do XML WONSR. */
  range: number;
  element: string;
  effectId?: string;
  missileId?: string;
}

export interface EnemyRuntimeStats {
  hp: Decimal;
  hpMax: Decimal;
  level: number;
  xp: number;
}
