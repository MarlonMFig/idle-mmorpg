'use client';

import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, ATTRIBUTE_SHORT_LABELS } from '@/constants/attributes';
import { useAttributesStore } from '@/hooks/use-attributes-store';
import type { AttributeId } from '@/types/attributes';

function layerBonus(id: AttributeId, equipment: number | undefined, buffs: number | undefined): string {
  const total = (equipment ?? 0) + (buffs ?? 0);
  if (total === 0) return '';
  return total > 0 ? ` (+${total})` : ` (${total})`;
}

/**
 * Lista de atributos — totais com bônus de equip/buffs.
 * Buffs: `activeBuffs` / `attributesStore.addBuff` prontos para o futuro.
 */
export function AttributesPanel() {
  const { totals, equipment, buffs, activeBuffs } = useAttributesStore();

  return (
    <div className="hud-attributes" aria-label="Atributos">
      <div className="hud-attributes__head">
        <h2 className="hud-attributes__title">Atributos</h2>
        {activeBuffs.length > 0 ? (
          <span className="hud-attributes__buff-badge">{activeBuffs.length} buffs</span>
        ) : null}
      </div>
      <ul className="hud-attributes__list">
        {ATTRIBUTE_ORDER.map((id) => (
          <li key={id} className="hud-attributes__row">
            <span className="hud-attributes__label" title={ATTRIBUTE_LABELS[id]}>
              {ATTRIBUTE_SHORT_LABELS[id]}
            </span>
            <span className="hud-attributes__value">
              {totals[id]}
              <span className="hud-attributes__bonus">
                {layerBonus(id, equipment[id], buffs[id])}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
