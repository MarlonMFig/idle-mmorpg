/**
 * Anime Idle World — Design System tokens (TS mirrors of CSS variables).
 * Prefer CSS vars in styles; use these for typed props / showcase.
 */

export const AIW_UI_SCALES = [0.8, 0.9, 1, 1.1, 1.2] as const;
export type AiwUiScale = (typeof AIW_UI_SCALES)[number];

export const AIW_DEFAULT_UI_SCALE: AiwUiScale = 1;

export const AIW_SPACING = {
  2: 'var(--aiw-space-2)',
  4: 'var(--aiw-space-4)',
  6: 'var(--aiw-space-6)',
  8: 'var(--aiw-space-8)',
  12: 'var(--aiw-space-12)',
  16: 'var(--aiw-space-16)',
  20: 'var(--aiw-space-20)',
  24: 'var(--aiw-space-24)',
  32: 'var(--aiw-space-32)',
  48: 'var(--aiw-space-48)',
} as const;

export const AIW_RADIUS = {
  sm: 'var(--aiw-radius-sm)',
  md: 'var(--aiw-radius-md)',
  lg: 'var(--aiw-radius-lg)',
  pill: 'var(--aiw-radius-pill)',
} as const;

export const AIW_Z = {
  world: 'var(--aiw-z-world)',
  hud: 'var(--aiw-z-hud)',
  window: 'var(--aiw-z-window)',
  modal: 'var(--aiw-z-modal)',
  tooltip: 'var(--aiw-z-tooltip)',
  notification: 'var(--aiw-z-notification)',
  dev: 'var(--aiw-z-dev)',
} as const;

export const AIW_MOTION = {
  fast: 'var(--aiw-motion-fast)',
  normal: 'var(--aiw-motion-normal)',
  slow: 'var(--aiw-motion-slow)',
  ease: 'var(--aiw-ease)',
} as const;

export const AIW_ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type AiwIconSize = keyof typeof AIW_ICON_SIZES;

/** Official rarity / quality presentation (visual only). */
export type AiwRarityId = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export const AIW_RARITY: Record<
  AiwRarityId,
  { id: AiwRarityId; label: string; quality: AiwRarityId; cssVar: string }
> = {
  D: { id: 'D', label: 'Comum', quality: 'D', cssVar: 'var(--aiw-rarity-d)' },
  C: { id: 'C', label: 'Incomum', quality: 'C', cssVar: 'var(--aiw-rarity-c)' },
  B: { id: 'B', label: 'Raro', quality: 'B', cssVar: 'var(--aiw-rarity-b)' },
  A: { id: 'A', label: 'Épico', quality: 'A', cssVar: 'var(--aiw-rarity-a)' },
  S: { id: 'S', label: 'Lendário', quality: 'S', cssVar: 'var(--aiw-rarity-s)' },
  SS: { id: 'SS', label: 'Mítico', quality: 'SS', cssVar: 'var(--aiw-rarity-ss)' },
  SSS: { id: 'SSS', label: 'Supremo', quality: 'SSS', cssVar: 'var(--aiw-rarity-sss)' },
};

export type AiwTextTone = 'default' | 'muted' | 'disabled' | 'accent' | 'danger' | 'success';
export type AiwTextSize =
  | 'caption'
  | 'small'
  | 'body'
  | 'body-strong'
  | 'subtitle'
  | 'title'
  | 'display';
