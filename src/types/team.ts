import type { StarterCharacterId } from '@/types/player-creation';

/** Personagem na coleção (starter ou selado em caça). */
export interface SealedCharacter {
  /** Chave estável na coleção (starter id ou sourceId da caça). */
  id: string;
  name: string;
  lookType: number;
  /** Origem WONSR; null para starters curados. */
  sourceId: string | null;
  /** Se for um dos três starters, mantém o pack curado. */
  starterId: StarterCharacterId | null;
  /** Preview na HUD / inventário. */
  previewUrl: string;
}

export interface TeamState {
  /** Todos os personagens obtidos (sem duplicata por id/lookType). */
  collection: SealedCharacter[];
  /** Até 3 ids da coleção. */
  teamIds: string[];
  /** Membro que luta / aparece no mundo. */
  activeId: string | null;
  inventoryTab: 'items' | 'characters';
}
