import type { CharacterClanId } from '@/types/character-meta';
import { CHARACTER_CLAN_IDS } from '@/types/character-meta';
import {
  CHARACTER_CLAN_COLORS,
  CHARACTER_CLAN_GLYPHS,
  CHARACTER_CLAN_ICONS,
  CHARACTER_CLAN_LABELS,
} from '@/constants/character-progression';

export interface ClanCatalogEntry {
  id: CharacterClanId;
  name: string;
  glyph: string;
  iconSrc: string;
  color: string;
  /** Tags curtas de identidade (sabor de mundo; sem bônus numérico). */
  tags: readonly string[];
  blurb: string;
}

/**
 * Catálogo UI dos clãs de conta.
 * Bônus de combate ainda `null` em CLAN_BONUS_BY_ID — não inventar %.
 */
export const CLAN_CATALOG: readonly ClanCatalogEntry[] = CHARACTER_CLAN_IDS.map((id) => {
  const flavor: Record<
    CharacterClanId,
    { tags: readonly string[]; blurb: string }
  > = {
    ninja: {
      tags: ['Shinobi', 'Jutsu'],
      blurb:
        'Clã das técnicas ocultas e da disciplina de vila. Representa o espírito shinobi no campo de caça.',
    },
    shinigami: {
      tags: ['Reiatsu', 'Espada'],
      blurb:
        'Clã dos caçadores de almas. Força de vontade e lâmina em equilíbrio no combate e no ritual.',
    },
    pirata: {
      tags: ['Mar', 'Liberdade'],
      blurb:
        'Clã dos mares abertos. Aventura, ousadia e tripulação — uma bandeira própria no mundo.',
    },
    cacador: {
      tags: ['Rastreio', 'Presa'],
      blurb:
        'Clã dos caçadores especializados. Leitura de terreno, emboscada e foco no alvo certo.',
    },
    feiticeiro: {
      tags: ['Magia', 'Selo'],
      blurb:
        'Clã dos cultores de artes arcanas. Conhecimento, selos e poder refinado no campo.',
    },
    guerreiro: {
      tags: ['Força', 'Honra'],
      blurb:
        'Clã da linha de frente. Resiliência, ousadia e choque direto no embate corpo a corpo.',
    },
  };

  return {
    id,
    name: CHARACTER_CLAN_LABELS[id],
    glyph: CHARACTER_CLAN_GLYPHS[id],
    iconSrc: CHARACTER_CLAN_ICONS[id],
    color: CHARACTER_CLAN_COLORS[id],
    tags: flavor[id].tags,
    blurb: flavor[id].blurb,
  };
});

export function getClanCatalogEntry(id: CharacterClanId): ClanCatalogEntry {
  const found = CLAN_CATALOG.find((entry) => entry.id === id);
  if (!found) {
    return CLAN_CATALOG[0];
  }
  return found;
}
