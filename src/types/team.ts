import type {
  CharacterClanId,
  CharacterQuality,
  CharacterStars,
} from '@/types/character-meta';
import type { StarterCharacterId } from '@/types/player-creation';

/** Personagem na coleção (starter ou selado em caça). Instância única. */
export interface SealedCharacter {
  /** ID de instância na bag (UUID). */
  id: string;
  /**
   * Identidade de forja: cópias do mesmo personagem compartilham o key
   * (tipicamente `look:<lookType>`).
   */
  characterKey: string;
  name: string;
  lookType: number;
  /** Origem WONSR; null para starters curados. */
  sourceId: string | null;
  /** Se for um dos três starters, mantém o pack curado. */
  starterId: StarterCharacterId | null;
  /** Preview na HUD / inventário. */
  previewUrl: string;
  /** Qualidade natural imutável. */
  quality: CharacterQuality;
  /** Estrelas 0–5 (forja). */
  stars: CharacterStars;
  /** Afinidade de clã fixa do personagem. */
  clanId: CharacterClanId;
  isFavorite: boolean;
  isLocked: boolean;
}

export interface TeamState {
  /** Todos os personagens obtidos (duplicatas permitidas para forja). */
  collection: SealedCharacter[];
  /** Até 3 ids de instância da coleção. */
  teamIds: string[];
  /** Membro que luta / aparece no mundo. */
  activeId: string | null;
  inventoryTab: 'items' | 'characters' | 'forge';
  /** Janela de Equipe/Box aberta. */
  isOpen: boolean;
}
