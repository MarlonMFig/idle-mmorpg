import type { CharacterQuality } from '@/types/character-meta';

export type PotentialKey = 'hp' | 'forca' | 'defesa';

export type CharacterPotential = Record<PotentialKey, number>;

export type CharacterGrade = 'bruto' | 'lapidado' | 'fino' | 'excelente' | 'perfeito';

export interface QualityConfigRow {
  id: CharacterQuality;
  rotulo: string;
  peso: number;
  min: number;
  max: number;
}

export interface GradeConfigRow {
  id: CharacterGrade;
  rotulo: string;
  ate: number;
}

export const CONFIG: {
  atributos: PotentialKey[];
  qualidades: QualityConfigRow[];
  potencial: { componenteMin: number; componenteMax: number };
  graus: GradeConfigRow[];
};

export function rollQuality(opts?: { rng?: () => number; sorte?: number }): CharacterQuality;
export function rollPotential(rng?: () => number): CharacterPotential;
export function potentialTotal(p: CharacterPotential | null | undefined): number;
export function potentialPosition(total: number): number;
export function gradeFromPotential(total: number): CharacterGrade;
export function qualityStatMultiplierFromPotential(
  quality: CharacterQuality,
  potential: CharacterPotential,
): number;
export function qualityStatMultiplierFromComponent(
  quality: CharacterQuality,
  component: number,
): number;
export function rollCaptureBundle(opts?: { rng?: () => number; sorte?: number }): {
  quality: CharacterQuality;
  potential: CharacterPotential;
  potentialTotal: number;
  grade: CharacterGrade;
  qualityStatMultiplier: number;
};
export function backfillPotential(
  quality: CharacterQuality,
  storedMultiplier: number,
  rng?: () => number,
): CharacterPotential;
