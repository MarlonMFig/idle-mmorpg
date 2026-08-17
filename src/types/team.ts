import type { CharacterClanId, CharacterQuality, CharacterStars } from '@/types/character-meta';
import type { CharacterPotential } from '@/types/potential';
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
  /** Estrelas 0–8 (teto por qualidade). */
  stars: CharacterStars;
  /** Potencial (IVs) rolado no desbloqueio. */
  potential?: CharacterPotential;
  /** Afinidade de clã fixa do personagem. */
  clanId: CharacterClanId;
  /** Nível próprio (selado herda o da caça; starter começa em 1). */
  level: number;
  /** XP atual rumo ao próximo nível. */
  xp: number;
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
  /** Janela de Equipe/Box aberta. */
  isOpen: boolean;
}
