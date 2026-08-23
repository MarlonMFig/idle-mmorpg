import type { CharacterPack, CharacterSkillAnimDef, SpriteSheetDef } from '@/data/character-packs';
import type { LineageId } from '@/types/character-meta';
import type { CharacterAwakeningConfig } from '@/constants/character-awakening';
import type { SkillDefinition, SkillHitSpec } from '@/types/skill';

/**
 * Universo / franquia do personagem.
 * Pastas futuras: `src/data/characters/<universe>/` (migração gradual).
 */
export type CharacterUniverse =
  | 'naruto'
  | 'dragon-ball'
  | 'bleach'
  | 'black-clover'
  | 'one-piece'
  | 'kenshin'
  | 'jujutsu'
  | 'hunter'
  | 'other';

/**
 * Slots de animação padronizados. Nenhum é obrigatório:
 * o engine usa fallback (ex.: combo3 → combo2 → attack; idle → walk).
 */
export type CharacterAnimSlot =
  | 'idle'
  | 'walk'
  | 'attack'
  | 'combo1'
  | 'combo2'
  | 'combo3'
  | 'hurt'
  | 'death'
  | 'special1'
  | 'special2'
  | 'special3';

export const CHARACTER_ANIM_SLOTS: readonly CharacterAnimSlot[] = [
  'idle',
  'walk',
  'attack',
  'combo1',
  'combo2',
  'combo3',
  'hurt',
  'death',
  'special1',
  'special2',
  'special3',
] as const;

/** Alias estável da folha que o Phaser já lê (tamanho por animação, não grade global). */
export type AnimationDefinition = SpriteSheetDef;

/**
 * VFX reutilizável. Campos reais do engine (`fx` em CharacterSkillAnimDef).
 * Escala/offset são da configuração visual — o Combat Engine não precisa mudar.
 */
export interface VfxDefinition {
  id: string;
  asset: SpriteSheetDef;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  spawnPoint?: 'caster' | 'target';
  durationMs?: number;
  independentScale?: boolean;
}

/**
 * Vista unificada de um personagem cadastrado.
 * Não substitui `SealedCharacter` (instância na coleção) nem `HuntTarget`.
 * Todos referenciam o mesmo `id` permanente.
 */
export interface CharacterDefinition {
  /** ID permanente do pack (`naruto-classic`, `kakashi`, `gaara`, …). Não mudar. */
  id: string;
  universe: CharacterUniverse;
  /** Afinidade de Linhagem (CharacterDefinition — não duplicar na instância). */
  lineageId: LineageId;
  lookTypes: readonly number[];
  active: boolean;
  /** Pack visual + skillAnims + hotbar (fonte atual). */
  pack: CharacterPack;
  skillIds: readonly string[];
  /**
   * Requisitos/rewards específicos deste personagem.
   * O nível atual permanece na CharacterInstance.
   * Ausente = usa config global (DEV: disponível).
   */
  awakeningConfig?: CharacterAwakeningConfig;
}

export interface CharacterSkillBinding {
  skill: SkillDefinition;
  animation?: CharacterSkillAnimDef;
  vfx?: VfxDefinition | null;
  /** Impactos: `skill.hits` ou um único hit no `hitDelayMs` da animação. */
  hits: readonly SkillHitSpec[];
}
