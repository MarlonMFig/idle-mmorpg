import type { CharacterClanId, CharacterQuality, CharacterStars } from '@/types/character-meta';
import { CHARACTER_CLAN_IDS } from '@/types/character-meta';

/** Estrelas máximas por personagem. */
export const MAX_CHARACTER_STARS = 5 as const;

/** Bônus linear por estrela nos atributos base (não composto). */
export const STAR_BONUS_PER_STAR = 0.02;

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

/** Nível de conta que libera o sistema de Clãs. */
export const CLAN_SYSTEM_UNLOCK_LEVEL = 20;

/**
 * Bônus numérico por clã.
 * `null` = ainda não definido — só estrutura/afinidade.
 */
export const CLAN_BONUS_BY_ID: Record<CharacterClanId, null> = {
  ninja: null,
  shinigami: null,
  pirata: null,
  cacador: null,
  feiticeiro: null,
  guerreiro: null,
};

export const CHARACTER_QUALITY_LABELS: Record<CharacterQuality, string> = {
  D: 'Comum',
  C: 'Incomum',
  B: 'Raro',
  A: 'Épico',
  S: 'Lendário',
  SS: 'Mítico',
  SSS: 'Supremo',
};

export const CHARACTER_QUALITY_RANK_LABELS: Record<CharacterQuality, string> = {
  D: 'Rank D — Comum',
  C: 'Rank C — Incomum',
  B: 'Rank B — Raro',
  A: 'Rank A — Épico',
  S: 'Rank S — Lendário',
  SS: 'Rank SS — Mítico',
  SSS: 'Rank SSS — Supremo',
};

export const CHARACTER_CLAN_LABELS: Record<CharacterClanId, string> = {
  ninja: 'Ninja',
  shinigami: 'Shinigami',
  pirata: 'Pirata',
  cacador: 'Caçador',
  feiticeiro: 'Feiticeiro',
  guerreiro: 'Guerreiro',
};

/** Cores de borda/badge por qualidade (UI). */
export const CHARACTER_QUALITY_COLORS: Record<CharacterQuality, string> = {
  D: '#8b95a1',
  C: '#4caf6a',
  B: '#4a9fff',
  A: '#b06dff',
  S: '#e8b84a',
  SS: '#ff6b9d',
  SSS: '#ff5a4a',
};

/** Cor tema do clã (UI). */
export const CHARACTER_CLAN_COLORS: Record<CharacterClanId, string> = {
  ninja: '#e07040',
  shinigami: '#6aa8ff',
  pirata: '#d4a22a',
  cacador: '#4cce8a',
  feiticeiro: '#b06dff',
  guerreiro: '#e05a5a',
};

/** Ícone monograma curto do clã (fallback texto). */
export const CHARACTER_CLAN_GLYPHS: Record<CharacterClanId, string> = {
  ninja: 'N',
  shinigami: 'S',
  pirata: 'P',
  cacador: 'C',
  feiticeiro: 'F',
  guerreiro: 'G',
};

/** Ícones ilustrados dos clãs (menu / HUD). */
export const CHARACTER_CLAN_ICONS: Record<CharacterClanId, string> = {
  ninja: '/ui/clans/ninja.png',
  shinigami: '/ui/clans/shinigami.png',
  pirata: '/ui/clans/pirata.png',
  cacador: '/ui/clans/cacador.png',
  feiticeiro: '/ui/clans/feiticeiro.png',
  guerreiro: '/ui/clans/guerreiro.png',
};

/** Multiplicador de atributos base: 1 + stars × 0.02 */
export function starAttributeMultiplier(stars: number): number {
  const clamped = Math.max(0, Math.min(MAX_CHARACTER_STARS, Math.floor(stars)));
  return 1 + clamped * STAR_BONUS_PER_STAR;
}

export function clampStars(value: number): CharacterStars {
  const n = Math.max(0, Math.min(MAX_CHARACTER_STARS, Math.floor(value)));
  return n as CharacterStars;
}

export function forgeMaterialCost(quality: CharacterQuality): number | null {
  const cost = FORGE_MATERIAL_COST_BY_QUALITY[quality];
  return cost != null && cost > 0 ? cost : null;
}

export function isAccountClanId(value: unknown): value is CharacterClanId {
  return typeof value === 'string' && (CHARACTER_CLAN_IDS as readonly string[]).includes(value);
}
