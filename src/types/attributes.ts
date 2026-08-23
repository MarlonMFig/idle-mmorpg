/** Identificadores dos atributos do personagem. */
export type AttributeId =
  | 'hp'
  | 'strength'
  | 'defense'
  | 'speed'
  | 'accuracy'
  | 'critical';

/** Modificadores parciais (buffs, nível, etc.). */
export type AttributeModifiers = Partial<Record<AttributeId, number>>;

/** Valores completos de todos os atributos. */
export type AttributeValues = Record<AttributeId, number>;

/**
 * Bônus de item (legado de tooltips) — alias de AttributeModifiers.
 * Equipment removido (Item 36); mantido se algum item ainda declara bonuses decorativos.
 */
export type ItemBonuses = AttributeModifiers;

/** Origem de uma camada de modificadores. */
export type AttributeLayerSource = 'base' | 'level' | 'buff' | 'awakening' | 'lineage';

export interface AttributeBuff {
  id: string;
  modifiers: AttributeModifiers;
  /** Timestamp de expiração (ms); omitido = permanente até remoção. */
  expiresAt?: number;
}

/** Snapshot público dos atributos (totais + camadas para UI/debug). */
export interface PlayerAttributes {
  /** Totais finais (base + nível + awakening + lineage + buffs). Sem Equipment. */
  totals: AttributeValues;
  base: AttributeValues;
  level: AttributeModifiers;
  /** Soma atual dos buffs ativos. */
  buffs: AttributeModifiers;
  /** Camada derivada do Despertar (percentuais). Não altera base. */
  awakening: AttributeModifiers;
  /** Camada derivada da Especialização de Linhagem (percentuais). Não altera base. */
  lineage: AttributeModifiers;
  activeBuffs: readonly AttributeBuff[];
}
