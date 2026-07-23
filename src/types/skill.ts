/** Elementos de jutsu / habilidade. */
export type SkillElement =
  | 'fire'
  | 'water'
  | 'wind'
  | 'earth'
  | 'lightning'
  | 'yin'
  | 'yang'
  | 'neutral';

/**
 * Tipo de animação visual no Phaser.
 * Novos jutsus reutilizam estas chaves ou adicionam handlers em SkillVfx.
 */
export type SkillAnimationKind = 'burst' | 'projectile' | 'slash' | 'aura' | 'beam' | 'character';

export interface SkillAnimationDef {
  kind: SkillAnimationKind;
  /** Cor da VFX (hex Phaser). Se omitido, usa a cor do elemento. */
  tint?: number;
  durationMs?: number;
  scale?: number;
}

/**
 * Definição estática de uma habilidade (catálogo).
 * Preparado para dezenas de jutsus — só adicionar em `data/skills`.
 */
export interface SkillDefinition {
  id: string;
  name: string;
  element: SkillElement;
  /** Cooldown em milissegundos. */
  cooldownMs: number;
  /** Dano base da habilidade. */
  damage: number;
  /** Caminho do ícone (public/). */
  icon: string;
  animation: SkillAnimationDef;
  /** Alcance em pixels (default no constants). */
  range?: number;
  description?: string;
}

export type HotbarSlot = string | null;

export interface SkillsState {
  /** Skills conhecidas (ids do catálogo). */
  knownIds: string[];
  /** Barra de atalhos — tamanho fixo. */
  hotbar: HotbarSlot[];
  /** Timestamp (Date.now) em que cada skill fica pronta. */
  cooldownReadyAt: Record<string, number>;
  /** Pedido de cast pendente (React/teclado → Phaser). */
  pendingCastId: string | null;
}
