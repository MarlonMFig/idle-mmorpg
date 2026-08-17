import type { SkillElement } from '@/types/skill';

export const SKILL_HOTBAR_SIZE = 4;

/** Progressão padrão das quatro técnicas de cada personagem. */
export const CHARACTER_SKILL_LEVELS = [1, 5, 15, 30] as const;

/**
 * TEST ONLY: libera todo jutsu no nível 1 (easy revert: set `false`).
 * Aplicado em `SKILL_DEFINITIONS`, então cobre hotbar, tooltips e combate.
 */
export const FORCE_ALL_SKILLS_LEVEL_1 = true;
export const CHARACTER_SKILL_COOLDOWNS_MS = [5500, 7000, 9000, 12000] as const;
export const CHARACTER_SKILL_DAMAGE = [24, 36, 58, 88] as const;
export const CHARACTER_SKILL_AREA_RADIUS = 96;

/** Alcance padrão se a skill não definir `range`. */
export const SKILL_DEFAULT_RANGE = 96;

export const SKILL_ELEMENT_LABELS: Record<SkillElement, string> = {
  fire: 'Fogo',
  water: 'Água',
  wind: 'Vento',
  earth: 'Terra',
  lightning: 'Raio',
  yin: 'Yin',
  yang: 'Yang',
  neutral: 'Neutro',
};

/** Cores Phaser / CSS por elemento. */
export const SKILL_ELEMENT_COLOR: Record<SkillElement, number> = {
  fire: 0xe85d04,
  water: 0x3d8bfd,
  wind: 0x7dd3a8,
  earth: 0xb08968,
  lightning: 0xf4d35e,
  yin: 0x9b5de5,
  yang: 0xf7f3e3,
  neutral: 0xb0b0b0,
};

export const SKILL_ELEMENT_CSS: Record<SkillElement, string> = {
  fire: '#e85d04',
  water: '#3d8bfd',
  wind: '#7dd3a8',
  earth: '#b08968',
  lightning: '#f4d35e',
  yin: '#9b5de5',
  yang: '#f7f3e3',
  neutral: '#b0b0b0',
};

/** Teclas 1–4 da hotbar (display). */
export const SKILL_HOTBAR_KEY_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4'] as const;
