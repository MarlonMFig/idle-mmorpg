'use client';

import { useMemo, useState } from 'react';
import { CHARACTER_QUALITY_LABELS } from '@/constants/character-progression';
import {
  CHARACTER_GRADE_LABELS,
  derivePotentialFields,
  formatQualityStatMultiplier,
  QUALITY_STAT_RANGES,
  qualityStatMidpoint,
} from '@/constants/character-quality-stats';
import { CONFIG, type CharacterPotential } from '@/lib/raridade-potencial.js';
import { estimateInstanceCombatPower } from '@/lib/character-instance-stats';
import { CHARACTER_QUALITIES, type CharacterQuality } from '@/types/character-meta';
import { computePlayerAttributes } from '@/utils/attributes';
import { roundAttributeForDisplay } from '@/utils/star-bonus';

const TEST_CHARACTERS = [
  { id: 'uchiha-itachi', label: 'Itachi' },
  { id: 'naruto-classic', label: 'Naruto Classic' },
] as const;

const TEST_LEVEL = 100;
const TEST_STARS = 0;
const TEST_AWAKENING = 0;

const MID_COMPONENT = Math.round(
  (CONFIG.potencial.componenteMin + CONFIG.potencial.componenteMax) / 2,
);

function defaultPotential(): CharacterPotential {
  return {
    hp: MID_COMPONENT,
    forca: MID_COMPONENT,
    defesa: MID_COMPONENT,
  };
}

function statsFor(characterId: string, quality: CharacterQuality, multiplier: number) {
  const totals = computePlayerAttributes({
    level: TEST_LEVEL,
    stars: TEST_STARS,
    quality,
    qualityStatMultiplier: multiplier,
    characterId,
    awakeningLevel: TEST_AWAKENING,
  }).totals;
  return {
    hp: roundAttributeForDisplay(totals.hp),
    atk: roundAttributeForDisplay(totals.strength),
    def: roundAttributeForDisplay(totals.defense),
    power: estimateInstanceCombatPower({
      level: TEST_LEVEL,
      stars: TEST_STARS,
      quality,
      qualityStatMultiplier: multiplier,
      characterId,
      awakeningLevel: TEST_AWAKENING,
    }),
  };
}

export function CharacterLabQualityTester() {
  const [characterId, setCharacterId] = useState<string>(TEST_CHARACTERS[0].id);
  const [quality, setQuality] = useState<CharacterQuality>('SS');
  const [potential, setPotential] = useState<CharacterPotential>(defaultPotential);

  const derived = derivePotentialFields(quality, potential);
  const range = QUALITY_STAT_RANGES[quality];
  const live = statsFor(characterId, quality, derived.qualityStatMultiplier);

  const midpointTable = useMemo(
    () =>
      CHARACTER_QUALITIES.map((q) => {
        const mid = qualityStatMidpoint(q);
        return { quality: q, mid, ...statsFor(characterId, q, mid) };
      }),
    [characterId],
  );

  return (
    <section className="character-lab__section">
      <h3>QUALITY / POTENTIAL TESTER</h3>
      <p className="character-lab__hint">
        Testa CharacterInstance capturada (quality + potencial). O multiplier é derivado — não
        sorteado. Não altera HP/ATK/DEF do inimigo da Hunt.
      </p>
      <p className="character-lab__hint">
        Level {TEST_LEVEL} · Stars {TEST_STARS} · Awakening {TEST_AWAKENING}. Midpoint só como
        referência.
      </p>
      <label className="character-lab__hint">
        Character
        <select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
          {TEST_CHARACTERS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <label className="character-lab__hint">
        Quality
        <select
          value={quality}
          onChange={(event) => {
            setQuality(event.target.value as CharacterQuality);
          }}
        >
          {CHARACTER_QUALITIES.map((q) => (
            <option key={q} value={q}>
              {q} / {CHARACTER_QUALITY_LABELS[q]}
            </option>
          ))}
        </select>
      </label>
      <p className="character-lab__hint">
        Quality: {CHARACTER_QUALITY_LABELS[quality]} · Grau: {CHARACTER_GRADE_LABELS[derived.grade]}{' '}
        · Range: {range.min.toFixed(2)}x – {range.max.toFixed(2)}x
      </p>
      {CONFIG.atributos.map((key) => (
        <label key={key} className="character-lab__hint">
          Potencial {key} ({CONFIG.potencial.componenteMin}–{CONFIG.potencial.componenteMax})
          <input
            type="range"
            min={CONFIG.potencial.componenteMin}
            max={CONFIG.potencial.componenteMax}
            value={potential[key]}
            onChange={(event) =>
              setPotential((prev) => ({ ...prev, [key]: Number(event.target.value) }))
            }
          />
          {potential[key]}
        </label>
      ))}
      <p className="character-lab__hint">
        Total {derived.potentialTotal} · Multiplier {formatQualityStatMultiplier(derived.qualityStatMultiplier)}{' '}
        · HP {live.hp} · ATK {live.atk} · DEF {live.def} · Power {live.power}
      </p>
      <p className="character-lab__hint">Comparador (mesmo personagem, midpoint)</p>
      <table className="character-lab__table">
        <thead>
          <tr>
            <th>QUALITY</th>
            <th>×</th>
            <th>HP</th>
            <th>ATK</th>
            <th>DEF</th>
            <th>POWER</th>
          </tr>
        </thead>
        <tbody>
          {midpointTable.map((row) => (
            <tr key={row.quality}>
              <td>
                {row.quality} / {CHARACTER_QUALITY_LABELS[row.quality]}
              </td>
              <td>{formatQualityStatMultiplier(row.mid)}</td>
              <td>{row.hp}</td>
              <td>{row.atk}</td>
              <td>{row.def}</td>
              <td>{row.power}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
