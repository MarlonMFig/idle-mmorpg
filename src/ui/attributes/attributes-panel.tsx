'use client';

import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER, ATTRIBUTE_SHORT_LABELS } from '@/constants/attributes';
import { STAR_BONUS_PER_STAR } from '@/constants/character-progression';
import { useAttributesStore } from '@/hooks/use-attributes-store';
import { useStore } from '@/hooks/use-store';
import { teamStore } from '@/stores/team-store';
import type { AttributeId } from '@/types/attributes';
import { roundAttributeForDisplay } from '@/utils/star-bonus';

function layerBonus(id: AttributeId, buffs: number | undefined): string {
  const total = buffs ?? 0;
  if (total === 0) return '';
  return total > 0 ? ` (+${total})` : ` (${total})`;
}

/**
 * Atributos: base×estrelas do principal (+ nível) + buffs.
 * Exibição arredondada; cálculo interno com precisão.
 */
export function AttributesPanel() {
  const { totals, buffs, activeBuffs } = useAttributesStore();
  const stars = useStore(teamStore, (s) => {
    const active = s.collection.find((entry) => entry.id === s.activeId);
    return active?.stars ?? 0;
  });

  const starPct = Math.round(stars * STAR_BONUS_PER_STAR * 100);

  return (
    <div className="hud-attributes" aria-label="Atributos">
      <div className="hud-attributes__head">
        <h2 className="hud-attributes__title">Atributos</h2>
        {stars > 0 ? (
          <span className="hud-attributes__buff-badge" title="Bônus linear de estrelas na base">
            {stars}★ +{starPct}% base
          </span>
        ) : null}
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
              {roundAttributeForDisplay(totals[id])}
              <span className="hud-attributes__bonus">{layerBonus(id, buffs[id])}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
