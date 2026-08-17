/** Elementos de jutsu / habilidade. */
export type SkillElement =
  'fire' | 'water' | 'wind' | 'earth' | 'lightning' | 'yin' | 'yang' | 'neutral';

/**
 * Tipo de animação visual no Phaser.
 * Novos jutsus reutilizam estas chaves ou adicionam handlers em SkillVfx.
 */
export type SkillAnimationKind =
  'burst' | 'projectile' | 'slash' | 'aura' | 'beam' | 'character' | 'heal' | 'sprite';

export interface SkillAnimationDef {
  kind: SkillAnimationKind;
  /** Cor da VFX (hex Phaser). Se omitido, usa a cor do elemento. */
  tint?: number;
  durationMs?: number;
  scale?: number;
  /** Textura Phaser usada quando `kind` for `sprite`. */
  textureKey?: string;
  /** Quantidade de frames da textura usada quando `kind` for `sprite`. */
  frames?: number;
}

/**
 * Definição estática de uma habilidade (catálogo).
 * Preparado para dezenas de jutsus — só adicionar em `data/skills`.
 */
export interface SkillDefinition {
  id: string;
  name: string;
  element: SkillElement;
  /** Efeito principal. Ausente mantém o comportamento legado de dano. */
  effect?: 'damage' | 'heal';
  /** Nível do jogador necessário para usar a habilidade. */
  requiredLevel?: number;
  /** Cooldown em milissegundos. */
  cooldownMs: number;
  /** Dano base da habilidade. */
  damage: number;
  /** Fração do HP máximo restaurada quando `effect` for `heal` (0–1). */
  healPercent?: number;
  /** Caminho do ícone (public/). */
  icon: string;
  animation: SkillAnimationDef;
  /** Alcance em pixels (default no constants). */
  range?: number;
  /**
   * Avança o caster até o alvo durante o cast (lunge/dash de contato).
   * O dano deve ocorrer no fim do dash (use hitDelay perto do impulso).
   */
  dashToTarget?: boolean;
  /**
   * Distância de parada do dash (px). Default ~alcance de ataque básico.
   * Só usado com `dashToTarget`.
   */
  contactRange?: number;
  /**
   * Momento (ms do cast) em que o deslocamento começa.
   * Sem valor: lunge curto no final (estilo Raikiri).
   * Com valor: investida prolongada até o hitDelay (corrida / Chidori / Kyūbi).
   */
  dashStartMs?: number;
  /**
   * Duração do deslocamento (ms). Default:
   * - com `dashStartMs`: hitDelay − dashStartMs
   * - sem: ~16% do hitDelay (clamp 160–360)
   */
  dashDurationMs?: number;
  /** Raio do dano em área; ausente significa alvo único. */
  areaRadius?: number;
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
