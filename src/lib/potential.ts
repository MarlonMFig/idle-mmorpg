import {
  POTENTIAL_ATTRIBUTES,
  POTENTIAL_GRADE_SPECS,
  type PotentialAttributeId,
  type PotentialGrade,
} from '@/constants/aiw-potential';
import type { CharacterPotential, PotentialAttribute } from '@/types/potential';

function gradeForValue(value: number): PotentialGrade {
  const v = Math.max(0, Math.min(100, Math.floor(value)));
  for (const spec of POTENTIAL_GRADE_SPECS) {
    if (v >= spec.min && v <= spec.max) return spec.grade;
  }
  return 'F';
}

function bonusPercentForGrade(grade: PotentialGrade): number {
  return POTENTIAL_GRADE_SPECS.find((entry) => entry.grade === grade)?.bonusPercent ?? 0;
}

function weightedRoll(rng: () => number): number {
  const total = POTENTIAL_GRADE_SPECS.reduce((sum, entry) => sum + entry.weight, 0);
  let pick = rng() * total;
  for (const spec of POTENTIAL_GRADE_SPECS) {
    pick -= spec.weight;
    if (pick <= 0) {
      const span = spec.max - spec.min + 1;
      return spec.min + Math.floor(rng() * span);
    }
  }
  return 50;
}

export function rollPotentialAttribute(rng: () => number = Math.random): PotentialAttribute {
  const value = weightedRoll(rng);
  return { value, grade: gradeForValue(value) };
}

export function rollCharacterPotential(rng: () => number = Math.random): CharacterPotential {
  return {
    poder: rollPotentialAttribute(rng),
    sorte: rollPotentialAttribute(rng),
    fortuna: rollPotentialAttribute(rng),
  };
}

/** Média dos bônus % dos 3 atributos → multiplicador de poder. */
export function potentialPowerMultiplier(potential: CharacterPotential | undefined): number {
  if (!potential) return 1;
  const sum =
    bonusPercentForGrade(potential.poder.grade) +
    bonusPercentForGrade(potential.sorte.grade) +
    bonusPercentForGrade(potential.fortuna.grade);
  return 1 + sum / 300;
}

export function potentialSorteBonus(potential: CharacterPotential | undefined): number {
  if (!potential) return 0;
  return bonusPercentForGrade(potential.sorte.grade) / 100;
}

export function potentialFortunaMultiplier(potential: CharacterPotential | undefined): number {
  if (!potential) return 1;
  return 1 + bonusPercentForGrade(potential.fortuna.grade) / 100;
}

export function overallPotentialGrade(potential: CharacterPotential): PotentialGrade {
  const avg =
    (potential.poder.value + potential.sorte.value + potential.fortuna.value) / 3;
  return gradeForValue(avg);
}

/**
 * Refina um atributo: reroll e fica sempre o maior valor (spec).
 * @returns novo potencial ou null se inválido.
 */
export function refinePotentialAttribute(
  potential: CharacterPotential,
  attribute: PotentialAttributeId,
  rng: () => number = Math.random,
): CharacterPotential {
  const rolled = rollPotentialAttribute(rng);
  const current = potential[attribute];
  const nextValue = Math.max(current.value, rolled.value);
  return {
    ...potential,
    [attribute]: { value: nextValue, grade: gradeForValue(nextValue) },
  };
}

export function normalizePotential(raw: unknown): CharacterPotential | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Record<string, unknown>;
  const result: Partial<CharacterPotential> = {};
  for (const key of POTENTIAL_ATTRIBUTES) {
    const entry = data[key];
    if (!entry || typeof entry !== 'object') return undefined;
    const attr = entry as Record<string, unknown>;
    if (typeof attr.value !== 'number') return undefined;
    const value = Math.max(0, Math.min(100, Math.floor(attr.value)));
    result[key] = { value, grade: gradeForValue(value) };
  }
  return result as CharacterPotential;
}
