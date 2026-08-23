'use client';

import { useMemo, useState } from 'react';
import {
  DAMAGE_ELEMENT_LABELS,
  DAMAGE_ELEMENTS,
  type DamageElement,
} from '@/data/damage-elements';
import { getCombatAffinity } from '@/systems/combat-affinity';
import { validateAffinity } from '@/systems/elemental-resistance';
import { characterLabStore, LAB_DUMMY_ID } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';

const PRESETS: Array<{ label: string; value: number | 'immune' }> = [
  { label: '0%', value: 0 },
  { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 },
  { label: '100%', value: 0.9 },
  { label: '-25%', value: -0.25 },
  { label: 'Immune', value: 'immune' },
];

function formatResist(value: number | undefined): string {
  const n = value ?? 0;
  const pct = Math.round(n * 100);
  return `${pct}%`;
}

export function CharacterLabResistPanel() {
  const override = useStore(characterLabStore, (s) => s.enemyAffinityOverride);
  const [inspect, setInspect] = useState<DamageElement>('fire');
  const affinity = getCombatAffinity(LAB_DUMMY_ID, null);
  const warnings = useMemo(() => validateAffinity(affinity), [affinity]);

  const setPreset = (value: number | 'immune') => {
    const current = characterLabStore.getSnapshot().enemyAffinityOverride ?? {
      resistances: {},
      immunities: [],
    };
    if (value === 'immune') {
      characterLabStore.setEnemyAffinityOverride({
        resistances: { ...current.resistances, [inspect]: 0 },
        immunities: [...current.immunities.filter((id) => id !== inspect), inspect],
      });
      return;
    }
    if (value === 0.9) {
      characterLabStore.pushEvent('resistência limitada a 90%; use Immune para 0 dano');
    }
    characterLabStore.setEnemyAffinityOverride({
      resistances: { ...current.resistances, [inspect]: value },
      immunities: current.immunities.filter((id) => id !== inspect),
    });
  };

  return (
    <section className="character-lab__section">
      <h4>RESISTÊNCIAS DO ALVO (DEV)</h4>
      <p className="character-lab__hint">
        Override temporário do dummy. Não grava no personagem nem no localStorage.
      </p>
      <label>
        Elemento
        <select value={inspect} onChange={(event) => setInspect(event.target.value as DamageElement)}>
          {DAMAGE_ELEMENTS.filter((id) => id !== 'neutral').map((id) => (
            <option key={id} value={id}>
              {DAMAGE_ELEMENT_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <div className="character-lab__chips">
        {PRESETS.map((preset) => (
          <button key={preset.label} type="button" onClick={() => setPreset(preset.value)}>
            {preset.label}
          </button>
        ))}
        <button type="button" onClick={() => characterLabStore.setEnemyAffinityOverride(null)}>
          Limpar override
        </button>
      </div>
      <ul className="character-lab__hint">
        {DAMAGE_ELEMENTS.filter((id) => id !== 'neutral').map((id) => {
          const immune = (affinity.immunities ?? []).includes(id);
          const value = affinity.resistances?.[id] ?? 0;
          if (!immune && value === 0) return null;
          return (
            <li key={id}>
              {DAMAGE_ELEMENT_LABELS[id]}: {immune ? 'Immune' : formatResist(value)}
            </li>
          );
        })}
        {override ? <li>Override ativo</li> : <li>Sem override (definição original / vazio)</li>}
      </ul>
      {warnings.map((warning) => (
        <p key={warning} className="character-lab__hint">
          {warning}
        </p>
      ))}
    </section>
  );
}

export function CharacterLabDamageDebug() {
  const debug = useStore(characterLabStore, (s) => s.damageDebug);
  if (!debug) {
    return (
      <section className="character-lab__section">
        <h4>DAMAGE</h4>
        <p className="character-lab__hint">Nenhum hit ainda nesta sessão.</p>
      </section>
    );
  }
  return (
    <section className="character-lab__section">
      <h4>DAMAGE</h4>
      <p>
        Raw Damage: {debug.rawOutgoing}
      </p>
      <p>After Shield: {debug.afterShield}</p>
      <p>After Defense: {debug.afterDefense}</p>
      <p>Element: {DAMAGE_ELEMENT_LABELS[debug.element]}</p>
      {debug.immune ? (
        <p>Target: {DAMAGE_ELEMENT_LABELS[debug.element]} Immune</p>
      ) : debug.skipped ? (
        <p>Neutral — sem modificador elemental</p>
      ) : (
        <p>
          Target {DAMAGE_ELEMENT_LABELS[debug.element]} Resistance:{' '}
          {Math.round(debug.resistance * 100)}%
        </p>
      )}
      <p>After Resistance: {debug.afterResistance}</p>
      <p>Final Damage: {debug.finalDamage}</p>
      {debug.tag ? (
        <p>
          <strong>{debug.tag}</strong>
        </p>
      ) : null}
      <p className="character-lab__hint">
        Ordem: Attack + multiplier → STAR_3 → DEV scale → Shield → Defense → Element → HP
      </p>
    </section>
  );
}
