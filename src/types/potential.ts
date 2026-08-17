import type { PotentialAttributeId, PotentialGrade } from '@/constants/aiw-potential';

export interface PotentialAttribute {
  /** Valor oculto 0–100. */
  value: number;
  grade: PotentialGrade;
}

export interface CharacterPotential {
  poder: PotentialAttribute;
  sorte: PotentialAttribute;
  fortuna: PotentialAttribute;
}
