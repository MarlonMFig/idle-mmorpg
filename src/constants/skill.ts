import type { SkillElement } from '@/types/skill';

import { shouldForceAllSkillsLevel1 } from '@/config/devConfig';

export const SKILL_HOTBAR_SIZE = 4;

/** Progressão padrão das quatro técnicas de cada personagem. */
export const CHARACTER_SKILL_LEVELS = [1, 5, 15, 30] as const;

/**
 * TEST ONLY: libera todo jutsu no nível 1 quando o Test Mode está ligado.
 * Fonte: `DEV_FLAGS.forceAllSkillsLevel1`.
 */
export const FORCE_ALL_SKILLS_LEVEL_1 = shouldForceAllSkillsLevel1();
export const CHARACTER_SKILL_COOLDOWNS_MS = [5500, 7000, 9000, 12000] as const;
export const CHARACTER_SKILL_DAMAGE = [24, 36, 58, 88] as const;
export const CHARACTER_SKILL_AREA_RADIUS = 96;

/** Alcance padrão se a skill não definir `range`. */
export const SKILL_DEFAULT_RANGE = 96;

export const SKILL_ELEMENT_LABELS: Record<SkillElement, string> = {
  physical: 'Físico',
  fire: 'Fogo',
  water: 'Água',
  wind: 'Vento',
  earth: 'Terra',
  lightning: 'Raio',
  ice: 'Gelo',
  dark: 'Trevas',
  light: 'Luz',
  energy: 'Energia',
  magic: 'Magia',
  yin: 'Yin',
  yang: 'Yang',
  neutral: 'Neutro',
};

/** Cores Phaser / CSS por elemento. */
export const SKILL_ELEMENT_COLOR: Record<SkillElement, number> = {
  physical: 0xc4c4c4,
  fire: 0xe85d04,
  water: 0x3d8bfd,
  wind: 0x7dd3a8,
  earth: 0xb08968,
  lightning: 0xf4d35e,
  ice: 0x9bd0f5,
  dark: 0x5c4d7a,
  light: 0xf3e9a6,
  energy: 0x7ec8ff,
  magic: 0xc084fc,
  yin: 0x9b5de5,
  yang: 0xf7f3e3,
  neutral: 0xb0b0b0,
};

export const SKILL_ELEMENT_CSS: Record<SkillElement, string> = {
  physical: '#c4c4c4',
  fire: '#e85d04',
  water: '#3d8bfd',
  wind: '#7dd3a8',
  earth: '#b08968',
  lightning: '#f4d35e',
  ice: '#9bd0f5',
  dark: '#5c4d7a',
  light: '#f3e9a6',
  energy: '#7ec8ff',
  magic: '#c084fc',
  yin: '#9b5de5',
  yang: '#f7f3e3',
  neutral: '#b0b0b0',
};

/** Teclas 1–4 da hotbar (display). */
export const SKILL_HOTBAR_KEY_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4'] as const;
