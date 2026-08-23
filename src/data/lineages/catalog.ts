import type { LineageId } from '@/types/character-meta';
import { LINEAGE_IDS } from '@/types/character-meta';
import {
  LINEAGE_COLORS,
  LINEAGE_GLYPHS,
  LINEAGE_ICONS,
  LINEAGE_LABELS,
} from '@/constants/lineage';

export interface LineageCatalogEntry {
  id: LineageId;
  name: string;
  glyph: string;
  iconSrc: string;
  color: string;
  tags: readonly string[];
  blurb: string;
}

const FLAVOR: Record<LineageId, { tags: readonly string[]; blurb: string }> = {
  ninja: {
    tags: ['Shinobi', 'Jutsu'],
    blurb:
      'Linhagem das técnicas ocultas e da disciplina de vila. Representa o espírito shinobi no campo de caça.',
  },
  shinigami: {
    tags: ['Reiatsu', 'Espada'],
    blurb:
      'Linhagem dos caçadores de almas. Força de vontade e lâmina em equilíbrio no combate e no ritual.',
  },
  pirata: {
    tags: ['Mar', 'Liberdade'],
    blurb:
      'Linhagem dos mares abertos. Aventura, ousadia e tripulação — uma bandeira própria no mundo.',
  },
  cacador: {
    tags: ['Rastreio', 'Presa'],
    blurb:
      'Linhagem dos caçadores especializados. Leitura de terreno, emboscada e foco no alvo certo.',
  },
  feiticeiro: {
    tags: ['Magia', 'Selo'],
    blurb:
      'Linhagem dos cultores de artes arcanas. Conhecimento, selos e poder refinado no campo.',
  },
  guerreiro: {
    tags: ['Força', 'Honra'],
    blurb:
      'Linhagem da linha de frente. Resiliência, ousadia e choque direto no embate corpo a corpo.',
  },
};

/** Catálogo UI das Linhagens. Sem bônus numéricos neste item. */
export const LINEAGE_CATALOG: readonly LineageCatalogEntry[] = LINEAGE_IDS.map((id) => ({
  id,
  name: LINEAGE_LABELS[id],
  glyph: LINEAGE_GLYPHS[id],
  iconSrc: LINEAGE_ICONS[id],
  color: LINEAGE_COLORS[id],
  tags: FLAVOR[id].tags,
  blurb: FLAVOR[id].blurb,
}));

export function getLineageCatalogEntry(id: LineageId): LineageCatalogEntry {
  return LINEAGE_CATALOG.find((entry) => entry.id === id) ?? LINEAGE_CATALOG[0];
}

/** @deprecated use LINEAGE_CATALOG */
export const CLAN_CATALOG = LINEAGE_CATALOG;

/** @deprecated use getLineageCatalogEntry */
export const getClanCatalogEntry = getLineageCatalogEntry;

/** @deprecated use LineageCatalogEntry */
export type ClanCatalogEntry = LineageCatalogEntry;
