import type { LineageId } from '@/types/character-meta';
import {
  LINEAGE_RANK_COUNT,
  LINEAGE_SPECIALIZATION_COUNT,
  LINEAGE_SPECIALIZATION_LEVEL_COUNT,
  type LineagePowerBudget,
} from '@/types/lineage';

/**
 * Regra de balanceamento estrutural (Item 20).
 * Documentada aqui e validada em lineage-validation.ts.
 */
export const LINEAGE_TEMPLATE_RULES = {
  ranks: LINEAGE_RANK_COUNT,
  specializations: LINEAGE_SPECIALIZATION_COUNT,
  specializationLevels: LINEAGE_SPECIALIZATION_LEVEL_COUNT,
} as const;

/** Orçamento máximo teórico — igual para todas as Linhagens. */
export const LINEAGE_DEFAULT_POWER_BUDGET_MAX = 100;

export const LINEAGE_POWER_BUDGET: LineagePowerBudget = {
  maxTotal: LINEAGE_DEFAULT_POWER_BUDGET_MAX,
};

/** Nível de conta que libera escolha de Linhagem. */
export const LINEAGE_SYSTEM_UNLOCK_LEVEL = 20;

export const LINEAGE_LABELS: Record<LineageId, string> = {
  ninja: 'Ninja',
  shinigami: 'Shinigami',
  pirata: 'Pirata',
  cacador: 'Caçador',
  feiticeiro: 'Feiticeiro',
  guerreiro: 'Guerreiro',
};

export const LINEAGE_COLORS: Record<LineageId, string> = {
  ninja: '#e07040',
  shinigami: '#6aa8ff',
  pirata: '#d4a22a',
  cacador: '#4cce8a',
  feiticeiro: '#b06dff',
  guerreiro: '#e05a5a',
};

export const LINEAGE_GLYPHS: Record<LineageId, string> = {
  ninja: 'N',
  shinigami: 'S',
  pirata: 'P',
  cacador: 'C',
  feiticeiro: 'F',
  guerreiro: 'G',
};

export const LINEAGE_ICONS: Record<LineageId, string> = {
  ninja: '/ui/clans/ninja.png',
  shinigami: '/ui/clans/shinigami.png',
  pirata: '/ui/clans/pirata.png',
  cacador: '/ui/clans/cacador.png',
  feiticeiro: '/ui/clans/feiticeiro.png',
  guerreiro: '/ui/clans/guerreiro.png',
};

export const LINEAGE_SPECIALIZATION_SLOT_LABELS = {
  specializationA: 'Caminho A',
  specializationB: 'Caminho B',
  specializationC: 'Caminho C',
} as const;
