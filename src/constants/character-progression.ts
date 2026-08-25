import { GAME_LIMITS, getMaxStarsForRarity, getRarityColor, getRarityLabel } from '@/config/gameConfig';
import type { LineageId, CharacterQuality, CharacterStars } from '@/types/character-meta';
import { LINEAGE_IDS, CHARACTER_QUALITIES } from '@/types/character-meta';
import {
  LINEAGE_SYSTEM_UNLOCK_LEVEL,
  LINEAGE_LABELS,
  LINEAGE_COLORS,
  LINEAGE_GLYPHS,
  LINEAGE_ICONS,
} from '@/constants/lineage';

export const MAX_CHARACTER_STARS = GAME_LIMITS.absoluteMaxStars;

/** Reexport spec: +2% por estrela e helpers de qualidade. */
export {
  STAR_BONUS_PER_LEVEL,
  FRAGMENTS_PER_STAR,
  getMaxStarsForRarity,
  maxStarsForQuality,
  startingStarsForQuality,
  starAttributeMultiplier,
} from '@/constants/aiw-quality';

/** Stats primários × qualityStatMultiplier derivado do potencial. */

/**
 * Melhoria de dano da habilidade especial em 3★.
 * `null` = ainda não definido — não aplicar no combate.
 */
export const STAR_3_SPECIAL_DAMAGE_BONUS: number | null = null;

/**
 * Benefício extra em 5★.
 * `null` = ainda não definido — não implementar passiva inventada.
 */
export const STAR_5_EXTRA_BENEFIT: null = null;

/**
 * Custo da Forja: material count por qualidade.
 * Só Comum (D) está definido. Demais ranks: indisponível.
 */
export const FORGE_MATERIAL_COST_BY_QUALITY: Partial<Record<CharacterQuality, number>> = {
  D: 20,
};

/** Qualidade natural ao obter personagem (selo / starter) neste momento. */
export const DEFAULT_OBTAIN_QUALITY: CharacterQuality = 'D';

/** @deprecated use LINEAGE_SYSTEM_UNLOCK_LEVEL */
export const CLAN_SYSTEM_UNLOCK_LEVEL = LINEAGE_SYSTEM_UNLOCK_LEVEL;

/**
 * Bônus numérico por Linhagem.
 * `null` = ainda não definido — só estrutura/afinidade.
 */
export const LINEAGE_BONUS_BY_ID: Record<LineageId, null> = {
  ninja: null,
  shinigami: null,
  pirata: null,
  cacador: null,
  feiticeiro: null,
  guerreiro: null,
};

/** @deprecated use LINEAGE_BONUS_BY_ID */
export const CLAN_BONUS_BY_ID = LINEAGE_BONUS_BY_ID;

export const CHARACTER_QUALITY_LABELS: Record<CharacterQuality, string> = Object.fromEntries(
  CHARACTER_QUALITIES.map((quality) => [quality, getRarityLabel(quality)]),
) as Record<CharacterQuality, string>;

export const CHARACTER_QUALITY_RANK_LABELS: Record<CharacterQuality, string> = Object.fromEntries(
  CHARACTER_QUALITIES.map((quality) => [
    quality,
    `Rank ${quality} — ${getRarityLabel(quality)}`,
  ]),
) as Record<CharacterQuality, string>;

export const CHARACTER_LINEAGE_LABELS = LINEAGE_LABELS;

/** @deprecated use LINEAGE_LABELS */
export const CHARACTER_CLAN_LABELS = LINEAGE_LABELS;

/** Cores de borda/badge por qualidade (spec central). */
export const CHARACTER_QUALITY_COLORS: Record<CharacterQuality, string> = Object.fromEntries(
  CHARACTER_QUALITIES.map((quality) => [quality, getRarityColor(quality)]),
) as Record<CharacterQuality, string>;

/** Cor tema da Linhagem (UI). */
export const CHARACTER_LINEAGE_COLORS = LINEAGE_COLORS;

/** @deprecated use LINEAGE_COLORS */
export const CHARACTER_CLAN_COLORS = LINEAGE_COLORS;

export const CHARACTER_LINEAGE_GLYPHS = LINEAGE_GLYPHS;

/** @deprecated use LINEAGE_GLYPHS */
export const CHARACTER_CLAN_GLYPHS = LINEAGE_GLYPHS;

export const CHARACTER_LINEAGE_ICONS = LINEAGE_ICONS;

/** @deprecated use LINEAGE_ICONS */
export const CHARACTER_CLAN_ICONS = LINEAGE_ICONS;


export function clampStars(value: number, quality: CharacterQuality = 'D'): CharacterStars {
  const cap = getMaxStarsForRarity(quality);
  const n = Math.max(0, Math.min(cap, Math.floor(value)));
  return n as CharacterStars;
}

export function forgeMaterialCost(quality: CharacterQuality): number | null {
  const cost = FORGE_MATERIAL_COST_BY_QUALITY[quality];
  return cost != null && cost > 0 ? cost : null;
}

export function isAccountLineageId(value: unknown): value is LineageId {
  return typeof value === 'string' && (LINEAGE_IDS as readonly string[]).includes(value);
}

/** @deprecated use isAccountLineageId */
export const isAccountClanId = isAccountLineageId;
