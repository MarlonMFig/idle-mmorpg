import type { Decimal } from '@/lib/decimal';
import type {
  CharacterGrade,
  CharacterPotential,
  CharacterQuality,
  CharacterStars,
  LineageId,
} from '@/types/character-meta';
import type { StarterCharacterId } from '@/types/player-creation';

/** Personagem na coleção (starter ou selado). Instância única do jogador. */
export interface SealedCharacter {
  /** instanceId — UUID persistente. Nunca usar characterId aqui. */
  id: string;
  /**
   * ID da CharacterDefinition (catálogo). Várias instâncias compartilham.
   */
  characterId: string;
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
  /** Componentes 1–20 por atributo primário. Fonte do multiplier. */
  potential: CharacterPotential;
  /** Soma dos componentes. Cache derivado. */
  potentialTotal: number;
  /** Grau derivado do potencial. */
  grade: CharacterGrade;
  /**
   * Multiplicador de stats primários derivado do potencial (cache).
   * Se houver potential, recalcular — este valor não é fonte da verdade.
   */
  qualityStatMultiplier: number;
  /** Estrelas; teto por raridade (getMaxStarsForRarity). */
  stars: CharacterStars;
  /**
   * Afinidade de Linhagem — derivada de CharacterDefinition quando possível.
   * Mantida no save por compatibilidade; preferir getInstanceLineageId().
   */
  lineageId: LineageId;
  /** @deprecated use lineageId — aceito em saves legados. */
  clanId?: LineageId;
  /** Nível da instância (captura = Nv.1). */
  level: number;
  /** XP atual rumo ao próximo nível. */
  xp: Decimal;
  /** Maestria desta cópia (0–100). Independente de Level/Stars. */
  masteryLevel: number;
  /** XP de Maestria rumo ao próximo nível. 0 no máximo. */
  masteryXp: number;
  /** Despertar desta cópia (0–3). Independente de Level/Stars/Maestria. */
  awakeningLevel: number;
  isFavorite: boolean;
  isLocked: boolean;
  /** Epoch ms. Ausente = save legado. */
  obtainedAt?: number;
}

/** Alias oficial: CharacterInstance = cópia do jogador. */
export type CharacterInstance = SealedCharacter;

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
