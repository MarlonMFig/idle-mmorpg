import { LINEAGE_DEFAULT_POWER_BUDGET_MAX } from '@/constants/lineage';
import {
  SPECIALIZATION_POWER_BUDGET,
  specializationPowerCost,
} from '@/constants/lineage-specialization';
import { LINEAGE_REGISTRY } from '@/data/lineages/registry';
import {
  LINEAGE_MODIFIER_IDS,
  LINEAGE_RANK_COUNT,
  LINEAGE_SPECIALIZATION_COUNT,
  LINEAGE_SPECIALIZATION_LEVEL_COUNT,
  type LineageDefinition,
  type LineageModifierId,
  type LineageSpecializationModifiers,
} from '@/types/lineage';

const VALID_ROLES = new Set(['offensive', 'defensive', 'utility', 'mixed']);
const VALID_MODIFIER_IDS = new Set<string>(LINEAGE_MODIFIER_IDS);

function cumulativeModifiers(
  levels: LineageDefinition['specializations'][number]['levels'],
  upTo: number,
): LineageSpecializationModifiers {
  const total: LineageSpecializationModifiers = {};
  for (const level of levels) {
    if (level.level > upTo) continue;
    const mods = level.modifiers;
    if (!mods) continue;
    for (const [key, raw] of Object.entries(mods) as [LineageModifierId, number | undefined][]) {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      total[key] = (total[key] ?? 0) + raw;
    }
  }
  return total;
}

export function validateLineageDefinition(def: LineageDefinition): string[] {
  const warnings: string[] = [];
  const prefix = `[LineageValidation] ${def.name}`;

  if (def.ranks.length !== LINEAGE_RANK_COUNT) {
    warnings.push(
      `${prefix} has ${def.ranks.length} ranks. Expected exactly ${LINEAGE_RANK_COUNT}.`,
    );
  }
  if (def.specializations.length !== LINEAGE_SPECIALIZATION_COUNT) {
    warnings.push(
      `${prefix} has ${def.specializations.length} specializations. Expected exactly ${LINEAGE_SPECIALIZATION_COUNT}.`,
    );
  }
  for (const spec of def.specializations) {
    if (!spec.key || typeof spec.key !== 'string') {
      warnings.push(`${prefix} specialization ${spec.id} missing thematic key.`);
    }
    if (spec.levels.length !== LINEAGE_SPECIALIZATION_LEVEL_COUNT) {
      warnings.push(
        `${prefix} specialization ${spec.id} has ${spec.levels.length} levels. Expected exactly ${LINEAGE_SPECIALIZATION_LEVEL_COUNT}.`,
      );
    }
    if (spec.role && !VALID_ROLES.has(spec.role)) {
      warnings.push(`${prefix} specialization ${spec.id} has invalid role: ${spec.role}.`);
    }
    for (const level of spec.levels) {
      for (const key of Object.keys(level.modifiers ?? {})) {
        if (!VALID_MODIFIER_IDS.has(key)) {
          warnings.push(
            `${prefix} ${spec.id} level ${level.level} has invalid modifierId: ${key}.`,
          );
        }
      }
      const incremental = specializationPowerCost(level.modifiers ?? {});
      const allowed = SPECIALIZATION_POWER_BUDGET.perLevel[level.level];
      if (incremental > allowed + SPECIALIZATION_POWER_BUDGET.epsilon) {
        warnings.push(
          `[SpecializationBalance] ${def.name}/${spec.name} Level ${level.level} exceeds allowed power budget.`,
        );
      }
    }
    const cumulative = specializationPowerCost(
      cumulativeModifiers(spec.levels, LINEAGE_SPECIALIZATION_LEVEL_COUNT),
    );
    if (cumulative > SPECIALIZATION_POWER_BUDGET.maxCumulative + SPECIALIZATION_POWER_BUDGET.epsilon) {
      warnings.push(
        `[SpecializationBalance] ${def.name}/${spec.name} Level IV exceeds allowed power budget.`,
      );
    }
  }
  const keys = def.specializations.map((spec) => spec.key);
  if (new Set(keys).size !== keys.length) {
    warnings.push(`${prefix} has duplicate specialization keys.`);
  }
  if (def.powerBudget.maxTotal !== LINEAGE_DEFAULT_POWER_BUDGET_MAX) {
    warnings.push(
      `${prefix} powerBudget.maxTotal is ${def.powerBudget.maxTotal}. Expected ${LINEAGE_DEFAULT_POWER_BUDGET_MAX}.`,
    );
  }
  return warnings;
}

export function validateLineageRegistry(): string[] {
  const warnings: string[] = [];
  for (const def of Object.values(LINEAGE_REGISTRY)) {
    warnings.push(...validateLineageDefinition(def));
  }
  return warnings;
}

export function validateLineagePowerBudget(def: LineageDefinition): string[] {
  return validateLineageDefinition(def).filter((row) => row.includes('[SpecializationBalance]'));
}
