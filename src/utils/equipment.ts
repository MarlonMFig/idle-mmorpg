import type { EquipmentState } from '@/types/inventory';

/** Equipamento vazio — compartilhado por inventário e atributos. */
export function createEmptyEquipment(): EquipmentState {
  return {
    bandana: null,
    weapon: null,
    clothing: null,
    gloves: null,
    boots: null,
    accessory: null,
  };
}
