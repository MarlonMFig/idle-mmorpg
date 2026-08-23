import { LINEAGE_POWER_BUDGET } from '@/constants/lineage';
import type { LineageId } from '@/types/character-meta';
import type {
  LineageDefinition,
  LineageRankDefinition,
  LineageSpecializationDefinition,
  LineageSpecializationLevelDefinition,
  LineageSpecializationModifiers,
  LineageSpecializationRole,
  LineageSpecializationSlot,
} from '@/types/lineage';

const SPEC_SLOTS: LineageSpecializationSlot[] = [
  'specializationA',
  'specializationB',
  'specializationC',
];

const ROMAN = ['I', 'II', 'III', 'IV'] as const;

export interface LineageSpecializationBuildInput {
  /** ID temático estável (ex.: sharingan). Persistência continua no slot A/B/C. */
  key: string;
  name: string;
  description: string;
  focus: string;
  role: LineageSpecializationRole;
  /** Ganho incremental por nível I–IV. */
  modifiers: [
    LineageSpecializationModifiers,
    LineageSpecializationModifiers,
    LineageSpecializationModifiers,
    LineageSpecializationModifiers,
  ];
}

function specLevels(
  prefix: string,
  modifiers: LineageSpecializationBuildInput['modifiers'],
): [
  LineageSpecializationLevelDefinition,
  LineageSpecializationLevelDefinition,
  LineageSpecializationLevelDefinition,
  LineageSpecializationLevelDefinition,
] {
  const levelOf = (level: 1 | 2 | 3 | 4): LineageSpecializationLevelDefinition => ({
    level,
    name: `${prefix} ${ROMAN[level - 1]}`,
    description: `Nível ${ROMAN[level - 1]} de ${prefix}.`,
    modifiers: modifiers[level - 1],
  });
  return [levelOf(1), levelOf(2), levelOf(3), levelOf(4)];
}

function buildSpecialization(
  id: LineageSpecializationSlot,
  spec: LineageSpecializationBuildInput,
): LineageSpecializationDefinition {
  return {
    id,
    key: spec.key,
    name: spec.name,
    description: spec.description,
    focus: spec.focus,
    role: spec.role,
    levels: specLevels(spec.name, spec.modifiers),
  };
}

function buildSpecializations(
  specs: [LineageSpecializationBuildInput, LineageSpecializationBuildInput, LineageSpecializationBuildInput],
): [
  LineageSpecializationDefinition,
  LineageSpecializationDefinition,
  LineageSpecializationDefinition,
] {
  return [
    buildSpecialization(SPEC_SLOTS[0], specs[0]),
    buildSpecialization(SPEC_SLOTS[1], specs[1]),
    buildSpecialization(SPEC_SLOTS[2], specs[2]),
  ];
}

function buildRanks(names: [string, string, string, string]): [
  LineageRankDefinition,
  LineageRankDefinition,
  LineageRankDefinition,
  LineageRankDefinition,
] {
  const rankOf = (index: 0 | 1 | 2 | 3): LineageRankDefinition => ({
    id: `rank${(index + 1) as 1 | 2 | 3 | 4}`,
    rank: (index + 1) as 1 | 2 | 3 | 4,
    name: names[index],
    description: 'Em desenvolvimento.',
  });
  return [rankOf(0), rankOf(1), rankOf(2), rankOf(3)];
}

/** Factory — garante template idêntico para todas as Linhagens. */
export function buildLineageDefinition(input: {
  id: LineageId;
  name: string;
  description: string;
  icon: string;
  color: string;
  rankNames: [string, string, string, string];
  specializations: [
    LineageSpecializationBuildInput,
    LineageSpecializationBuildInput,
    LineageSpecializationBuildInput,
  ];
}): LineageDefinition {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    icon: input.icon,
    color: input.color,
    ranks: buildRanks(input.rankNames),
    specializations: buildSpecializations(input.specializations),
    powerBudget: { ...LINEAGE_POWER_BUDGET },
  };
}
