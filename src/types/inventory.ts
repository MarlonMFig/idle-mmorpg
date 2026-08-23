/** Conteúdo de um slot de inventário (null = vazio). */
export interface InventoryItemStack {
  itemId: string;
  quantity: number;
}

export type InventorySlot = InventoryItemStack | null;

export interface InventoryState {
  slots: InventorySlot[];
  /** Índice selecionado para mover (click-to-move; DnD futuro). */
  selectedIndex: number | null;
  isOpen: boolean;
}
