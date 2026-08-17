export type PotentialAttributeId = 'poder' | 'sorte' | 'fortuna';

export type PotentialGrade = 'F' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export const POTENTIAL_ATTRIBUTES: readonly PotentialAttributeId[] = [
  'poder',
  'sorte',
  'fortuna',
] as const;

export const POTENTIAL_ATTRIBUTE_LABELS: Record<PotentialAttributeId, string> = {
  poder: 'Poder',
  sorte: 'Sorte',
  fortuna: 'Fortuna',
};

export interface PotentialGradeSpec {
  grade: PotentialGrade;
  min: number;
  max: number;
  bonusPercent: number;
  weight: number;
}

/** Notas F–SSS (spec config-potencial.json). */
export const POTENTIAL_GRADE_SPECS: readonly PotentialGradeSpec[] = [
  { grade: 'F', min: 0, max: 15, bonusPercent: 0, weight: 16 },
  { grade: 'D', min: 16, max: 30, bonusPercent: 2, weight: 15 },
  { grade: 'C', min: 31, max: 45, bonusPercent: 4, weight: 15 },
  { grade: 'B', min: 46, max: 60, bonusPercent: 6, weight: 15 },
  { grade: 'A', min: 61, max: 75, bonusPercent: 8, weight: 15 },
  { grade: 'S', min: 76, max: 88, bonusPercent: 11, weight: 13 },
  { grade: 'SS', min: 89, max: 97, bonusPercent: 15, weight: 9 },
  { grade: 'SSS', min: 98, max: 100, bonusPercent: 20, weight: 3 },
] as const;

export const REFINEMENT_CRYSTAL_ITEM_ID = 'item-cristal-refinamento';
export const REFINEMENT_CRYSTAL_GEM_PRICE = 120;
export const REFINEMENT_CRYSTAL_WEEKLY_LIMIT_F2P = 2;
export const REFINEMENT_CRYSTAL_WEEKLY_LIMIT_VIP = 3;
