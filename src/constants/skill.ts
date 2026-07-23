import type { SkillElement } from '@/types/skill';

export const SKILL_HOTBAR_SIZE = 2;

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

/** Teclas 1–2 da hotbar (display). */
export const SKILL_HOTBAR_KEY_CODES = ['Digit1', 'Digit2'] as const;
