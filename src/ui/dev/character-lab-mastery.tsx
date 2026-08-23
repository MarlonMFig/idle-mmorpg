'use client';

import { useState } from 'react';
import { isDevMode } from '@/config/devConfig';
import { MASTERY_MAX_LEVEL } from '@/constants/character-mastery';
import { useStore } from '@/hooks/use-store';
import {
  formatMasteryLevel,
  getMasteryXpRequired,
  isMaxMastery,
  nextMasteryMilestone,
} from '@/lib/character-mastery';
import { grantMasteryXp } from '@/lib/grant-mastery-xp';
import { teamStore } from '@/stores/team-store';

export function CharacterLabMasteryDebug() {
  const collection = useStore(teamStore, (s) => s.collection);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const instance = collection.find((entry) => entry.id === activeId) ?? null;
  const [setLevel, setSetLevel] = useState(0);

  if (!isDevMode()) return null;

  const required = instance ? getMasteryXpRequired(instance.masteryLevel) : 0;
  const nextMark = instance ? nextMasteryMilestone(instance.masteryLevel) : null;

  return (
    <section className="character-lab__section">
      <h4>MASTERY</h4>
      {instance ? (
        <>
          <p className="character-lab__hint">
            Instance: {instance.name} #{instance.id.slice(0, 8)}
          </p>
          <p>
            <strong>Level</strong> {formatMasteryLevel(instance.masteryLevel)} / {MASTERY_MAX_LEVEL}
          </p>
          <p>
            <strong>XP</strong>{' '}
            {isMaxMastery(instance.masteryLevel)
              ? 'MAX'
              : `${instance.masteryXp} / ${required}`}
          </p>
          {nextMark ? (
            <p>
              <strong>Próximo marco</strong> {nextMark}
            </p>
          ) : null}
          <div className="character-lab__actions">
            <button type="button" onClick={() => grantMasteryXp(instance.id, 100, { force: true })}>
              +100 XP
            </button>
            <button type="button" onClick={() => grantMasteryXp(instance.id, 1000, { force: true })}>
              +1000 XP
            </button>
            <button
              type="button"
              onClick={() =>
                teamStore.setCharacterMastery(instance.id, {
                  masteryLevel: 0,
                  masteryXp: 0,
                })
              }
            >
              Reset
            </button>
          </div>
          <label>
            Set Level
            <input
              type="number"
              min={0}
              max={MASTERY_MAX_LEVEL}
              value={setLevel}
              onChange={(event) => setSetLevel(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={() =>
              teamStore.setCharacterMastery(instance.id, {
                masteryLevel: Math.max(0, Math.min(MASTERY_MAX_LEVEL, Math.floor(setLevel))),
                masteryXp: 0,
              })
            }
          >
            Set Level
          </button>
        </>
      ) : (
        <p className="character-lab__hint">Sem CharacterInstance ativa da coleção.</p>
      )}
    </section>
  );
}
