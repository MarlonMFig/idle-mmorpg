import type { AttributeId, AttributeValues } from '@/types/attributes';

/** Ordem de exibição na UI. */
export const ATTRIBUTE_ORDER: readonly AttributeId[] = [
  'hp',
  'strength',
  'defense',
  'speed',
  'accuracy',
  'critical',
] as const;

export const ATTRIBUTE_LABELS: Record<AttributeId, string> = {
  hp: 'HP',
  strength: 'Força',
  defense: 'Defesa',
  speed: 'Velocidade',
  accuracy: 'Precisão',
  critical: 'Crítico',
};

/** Labels curtos para painéis compactos. */
export const ATTRIBUTE_SHORT_LABELS: Record<AttributeId, string> = {
  hp: 'HP',
  strength: 'FOR',
  defense: 'DEF',
  speed: 'VEL',
  accuracy: 'PRE',
  critical: 'CRT',
};

/** Atributos base (nível 1, sem equipamento/buffs). */
export const BASE_ATTRIBUTES: AttributeValues = {
  hp: 100,
  strength: 12,
  defense: 2,
  speed: 120,
  accuracy: 80,
  critical: 5,
};

/** Crescimento por nível (camada `level`). */
export const LEVEL_ATTRIBUTE_GROWTH: AttributeValues = {
  hp: 10,
  strength: 1,
  defense: 1,
  speed: 0,
  accuracy: 0,
  critical: 0,
};
