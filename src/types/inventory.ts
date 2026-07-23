import type { EquipSlot } from '@/types/attributes';

/** Conteúdo de um slot de inventário (null = vazio). */
export interface InventoryItemStack {
  itemId: string;
  quantity: number;
}

export type InventorySlot = InventoryItemStack | null;

export type EquipmentState = Record<EquipSlot, InventoryItemStack | null>;

export interface InventoryState {
  slots: InventorySlot[];
  equipment: EquipmentState;
  /** Índice selecionado para mover (click-to-move; DnD futuro). */
  selectedIndex: number | null;
  isOpen: boolean;
}
