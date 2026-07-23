/** Identificadores dos atributos do personagem. */
export type AttributeId =
  | 'hp'
  | 'strength'
  | 'defense'
  | 'speed'
  | 'accuracy'
  | 'critical';

/** Modificadores parciais (equipamento, buffs, nível, etc.). */
export type AttributeModifiers = Partial<Record<AttributeId, number>>;

/** Valores completos de todos os atributos. */
export type AttributeValues = Record<AttributeId, number>;

/**
 * Bônus de item — mesmo shape dos atributos (parcial).
 * Mantido como alias para clareza no loot/itens.
 */
export type ItemBonuses = AttributeModifiers;

/** Origem de uma camada de modificadores (buffs futuros usam `buff`). */
export type AttributeLayerSource = 'base' | 'level' | 'equipment' | 'buff';

export interface AttributeBuff {
  id: string;
  modifiers: AttributeModifiers;
  /** Timestamp de expiração (ms); omitido = permanente até remoção. */
  expiresAt?: number;
}

/** Snapshot público dos atributos (totais + camadas para UI/debug). */
export interface PlayerAttributes {
  /** Totais finais (base + nível + equipamento + buffs). */
  totals: AttributeValues;
  base: AttributeValues;
  level: AttributeModifiers;
  equipment: AttributeModifiers;
  /** Soma atual dos buffs ativos — preparado para sistema de buffs. */
  buffs: AttributeModifiers;
  activeBuffs: readonly AttributeBuff[];
}

export type EquipSlot =
  | 'bandana'
  | 'weapon'
  | 'clothing'
  | 'gloves'
  | 'boots'
  | 'accessory';
