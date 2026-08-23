import type { LineageId } from '@/types/character-meta';

/**
 * Template universal de Linhagem (Item 20).
 *
 * TODAS as Linhagens possuem obrigatoriamente:
 * - 4 ranks (graduação)
 * - 3 especializações
 * - 4 níveis por especialização
 * - mesmo powerBudget.maxTotal
 *
 * Conteúdo temático difere; quantidade de progressão é igual.
 */

export const LINEAGE_RANK_COUNT = 4 as const;
export const LINEAGE_SPECIALIZATION_COUNT = 3 as const;
export const LINEAGE_SPECIALIZATION_LEVEL_COUNT = 4 as const;

export type LineageRankIndex = 1 | 2 | 3 | 4;
export type LineageSpecializationSlot = 'specializationA' | 'specializationB' | 'specializationC';
export type LineageSpecializationLevelIndex = 1 | 2 | 3 | 4;

export type LineageSpecializationRole = 'offensive' | 'defensive' | 'utility' | 'mixed';

export const LINEAGE_MODIFIER_IDS = [
  'attackPercent',
  'hpPercent',
  'defensePercent',
  'skillDamagePercent',
  'criticalChance',
  'criticalDamage',
  'attackSpeedPercent',
  'cooldownReduction',
  'accuracy',
  'evasion',
  'statusEffectiveness',
  'healingPercent',
] as const;

export type LineageModifierId = (typeof LINEAGE_MODIFIER_IDS)[number];

/** Frações (0.02 = +2%). Runtime soma níveis desbloqueados. */
export type LineageSpecializationModifiers = Partial<Record<LineageModifierId, number>>;

/** Requisitos futuros (missões, level, etc.). Vazio neste item. */
export interface LineageRequirementPlaceholder {
  /** Reservado — não implementar missões neste item. */
  _placeholder?: true;
}

/** Rewards futuros de Rank. Especialização usa `modifiers`. */
export interface LineageRewardPlaceholder {
  /** Quando implementado: `compatibleCharacters` filtra personagens elegíveis. */
  appliesTo?: 'compatibleCharacters' | 'allCharacters';
  _placeholder?: true;
}

export interface LineageRankDefinition {
  id: `rank${LineageRankIndex}`;
  rank: LineageRankIndex;
  name: string;
  description: string;
  requirements?: LineageRequirementPlaceholder;
  rewards?: LineageRewardPlaceholder;
}

export interface LineageSpecializationLevelDefinition {
  level: LineageSpecializationLevelIndex;
  name: string;
  description: string;
  /** Ganho incremental deste nível (somado aos anteriores). */
  modifiers?: LineageSpecializationModifiers;
  requirements?: LineageRequirementPlaceholder;
  rewards?: LineageRewardPlaceholder;
}

export interface LineageSpecializationDefinition {
  id: LineageSpecializationSlot;
  /** ID temático estável (ex.: sharingan). Persistência usa `id` (slot). */
  key: string;
  name: string;
  description: string;
  /** Texto curto de estilo (UI). */
  focus?: string;
  role?: LineageSpecializationRole;
  levels: readonly [
    LineageSpecializationLevelDefinition,
    LineageSpecializationLevelDefinition,
    LineageSpecializationLevelDefinition,
    LineageSpecializationLevelDefinition,
  ];
}

/**
 * Orçamento de poder máximo teórico por Linhagem.
 * Validação numérica bloqueia quando rewards forem preenchidos.
 */
export interface LineagePowerBudget {
  maxTotal: number;
}

export interface LineageDefinition {
  id: LineageId;
  name: string;
  description: string;
  icon: string;
  color: string;
  ranks: readonly [
    LineageRankDefinition,
    LineageRankDefinition,
    LineageRankDefinition,
    LineageRankDefinition,
  ];
  specializations: readonly [
    LineageSpecializationDefinition,
    LineageSpecializationDefinition,
    LineageSpecializationDefinition,
  ];
  powerBudget: LineagePowerBudget;
}

export interface LineageSpecializationSlotProgress {
  level: 0 | LineageSpecializationLevelIndex;
  onlineKills: number;
}

export type LineageSpecializationProgressMap = Record<
  LineageSpecializationSlot,
  LineageSpecializationSlotProgress
>;

export const DEFAULT_SPECIALIZATION_SLOT_PROGRESS: LineageSpecializationSlotProgress = {
  level: 0,
  onlineKills: 0,
};

export const DEFAULT_SPECIALIZATION_PROGRESS: LineageSpecializationProgressMap = {
  specializationA: { ...DEFAULT_SPECIALIZATION_SLOT_PROGRESS },
  specializationB: { ...DEFAULT_SPECIALIZATION_SLOT_PROGRESS },
  specializationC: { ...DEFAULT_SPECIALIZATION_SLOT_PROGRESS },
};

/** Progresso persistido por Linhagem (independente da ativa). */
export interface LineageIdProgress {
  rank: 0 | LineageRankIndex;
  onlineKills: number;
  selectedSpecializationId: LineageSpecializationSlot | null;
  /** Nível do caminho ativo (espelho de specializationProgress[selected].level). */
  specializationLevel: 0 | LineageSpecializationLevelIndex;
  /** Progresso independente por caminho (preserva Respec futuro). */
  specializationProgress: LineageSpecializationProgressMap;
}

export const DEFAULT_LINEAGE_ID_PROGRESS: LineageIdProgress = {
  rank: 0,
  onlineKills: 0,
  selectedSpecializationId: null,
  specializationLevel: 0,
  specializationProgress: {
    specializationA: { ...DEFAULT_SPECIALIZATION_SLOT_PROGRESS },
    specializationB: { ...DEFAULT_SPECIALIZATION_SLOT_PROGRESS },
    specializationC: { ...DEFAULT_SPECIALIZATION_SLOT_PROGRESS },
  },
};

/** Progresso da conta — Linhagem ativa + mapa por lineageId. */
export interface PlayerLineageProgress {
  /** Linhagem ativa da conta. */
  lineageId: LineageId | null;
  /** Progresso separado por Linhagem (preserva troca futura). */
  byLineage: Partial<Record<LineageId, LineageIdProgress>>;
  /** @deprecated migrado para byLineage[active].rank */
  rank?: 0 | LineageRankIndex;
  selectedSpecializationId?: LineageSpecializationSlot | null;
  specializationLevel?: 0 | LineageSpecializationLevelIndex;
}

export const DEFAULT_PLAYER_LINEAGE_PROGRESS: PlayerLineageProgress = {
  lineageId: null,
  byLineage: {},
};

/** Preview DEV — não persiste no save. */
export interface LineageDevPreview {
  lineageId: LineageId | null;
  rank: 0 | LineageRankIndex;
  selectedSpecializationId: LineageSpecializationSlot | null;
  specializationLevel: 0 | LineageSpecializationLevelIndex;
}

export const DEFAULT_LINEAGE_DEV_PREVIEW: LineageDevPreview = {
  lineageId: null,
  rank: 0,
  selectedSpecializationId: null,
  specializationLevel: 0,
};
