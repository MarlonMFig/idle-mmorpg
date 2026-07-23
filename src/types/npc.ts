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
  dialogue: string[];
  /** Chave de textura do ícone de interação. */
  interactionIcon: string;
  /** URL do retrato para a UI de diálogo. */
  portraitUrl: string;
  mapKey: MapKey;
  /** Reserva para missões futuras. */
  questHook?: DialogueQuestHook;
}
