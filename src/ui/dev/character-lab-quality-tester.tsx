'use client';

import { useMemo, useState } from 'react';
import { CHARACTER_QUALITY_LABELS } from '@/constants/character-progression';
import {
  formatQualityStatMultiplier,
  isQualityStatMultiplierInRange,
  QUALITY_STAT_RANGES,
  qualityStatMidpoint,
  rollQualityStatMultiplier,
  simulateQualityStatRolls,
} from '@/constants/character-quality-stats';
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
  const [multiplier, setMultiplier] = useState(() => qualityStatMidpoint('SS'));
  const [sim, setSim] = useState<ReturnType<typeof simulateQualityStatRolls> | null>(null);
  const [forceText, setForceText] = useState('1.87');
  const [forceError, setForceError] = useState<string | null>(null);

  const range = QUALITY_STAT_RANGES[quality];
  const live = statsFor(characterId, quality, multiplier);

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
        Testa CharacterInstance capturada (quality + multiplier). Não altera HP/ATK/DEF do
        inimigo da Hunt.
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
            const next = event.target.value as CharacterQuality;
            setQuality(next);
            setMultiplier(qualityStatMidpoint(next));
            setSim(null);
            setForceError(null);
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
        Quality: {CHARACTER_QUALITY_LABELS[quality]} · Range: {range.min.toFixed(2)}x –{' '}
        {range.max.toFixed(2)}x · Midpoint: {range.midpoint.toFixed(2)}x
      </p>
      <p className="character-lab__hint">
        Roll: {formatQualityStatMultiplier(multiplier)} · HP {live.hp} · ATK {live.atk} · DEF{' '}
        {live.def} · Power {live.power}
      </p>
      <div className="character-lab__actions">
        <button
          type="button"
          onClick={() => {
            setMultiplier(rollQualityStatMultiplier(quality));
            setForceError(null);
          }}
        >
          ROLL
        </button>
        <input
          value={forceText}
          onChange={(event) => setForceText(event.target.value)}
          aria-label="Force multiplier"
        />
        <button
          type="button"
          onClick={() => {
            const parsed = Number(forceText.replace(',', '.'));
            if (!isQualityStatMultiplierInRange(quality, parsed)) {
              setForceError(`Fora da faixa ${range.min.toFixed(2)}–${range.max.toFixed(2)}`);
              return;
            }
            setForceError(null);
            setMultiplier(parsed);
          }}
        >
          FORCE
        </button>
        <button
          type="button"
          onClick={() => {
            let seed = 1;
            const rng = () => {
              seed = (Math.imul(seed, 0x2c1b3c6d) + 0x165667b1) | 0;
              return ((seed >>> 0) % 1_000_000) / 1_000_000;
            };
            setSim(simulateQualityStatRolls(quality, 1000, rng));
          }}
        >
          Simular 1.000 rolls
        </button>
      </div>
      {forceError ? <p className="character-lab__hint is-error">{forceError}</p> : null}
      {sim ? (
        <p className="character-lab__hint">
          1.000 rolls — min {sim.min.toFixed(4)} · max {sim.max.toFixed(4)} · avg{' '}
          {sim.average.toFixed(4)} · midpoint matemático {sim.expectedMidpoint.toFixed(4)} ·
          visual {range.midpoint.toFixed(2)}
        </p>
      ) : null}
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
