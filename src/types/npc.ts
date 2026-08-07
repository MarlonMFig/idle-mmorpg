import type { WonsrSpriteFit } from '@/data/wonsr-sprites';
import type { DialogueQuestHook } from '@/types/dialogue';
import type { MapKey } from '@/maps/map-registry';

export interface NpcPosition {
  x: number;
  y: number;
}

/** Definição autoritativa de um NPC. */
export interface NpcDefinition {
  id: string;
  name: string;
  position: NpcPosition;
  /** Chave de textura Phaser / path lógico do sprite. */
  sprite: string;
  /** URL da imagem do sprite quando é uma textura própria (não compartilhada). */
  spriteUrl?: string;
  /** Frame inicial quando `sprite` é uma sheet (ex.: parado virado ao sul). */
  spriteFrame?: number;
  /** Escala e âncora que padronizam a altura do desenho no mundo. */
  spriteFit?: WonsrSpriteFit;
  dialogue: string[];
  /** Chave de textura do ícone de interação. */
  interactionIcon: string;
  /** URL do retrato para a UI de diálogo. */
  portraitUrl: string;
  mapKey: MapKey;
  /** LookType WONSR (referência; sprite atual ainda é compartilhado). */
  lookType?: number;
  /** Reserva para missões futuras. */
  questHook?: DialogueQuestHook;
}
