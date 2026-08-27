'use client';

import { isDevMode } from '@/config/devConfig';
import { getWorldBossDefinition } from '@/constants/world-boss';
import { guildStore } from '@/stores/guild-store';
import { worldBossStore } from '@/stores/world-boss-store';
import { useEffect, useState } from 'react';

export function CharacterLabWorldBossDebug() {
  const [conc, setConc] = useState<string>('—');

  useEffect(() => {
    guildStore.ensurePlayerId();
    void worldBossStore.refresh();
  }, []);

  if (!isDevMode()) return null;

  const state = worldBossStore.getStateSync();
  const def = getWorldBossDefinition();
  const playerId = guildStore.getSnapshot().playerId;
  const me = playerId && state ? state.participants[playerId] : null;

  return (
    <div className="character-lab__subpanel">
      <h3>World Boss Debug</h3>
      <p className="character-lab__hint">Provider: {worldBossStore.getProviderId()}</p>
      <p className="character-lab__hint">
        Boss: {state?.bossId ?? def.bossId} · Cycle: {state?.cycleId ?? '—'}
      </p>
      <p className="character-lab__hint">Status: {state?.status ?? '—'}</p>
      <p className="character-lab__hint">
        HP: {state ? `${state.currentHp}/${state.maxHp}` : '—'}
      </p>
      <p className="character-lab__hint">
        Participants: {state ? Object.keys(state.participants).length : 0} · Total dmg:{' '}
        {state?.totalDamage ?? 0}
      </p>
      <p className="character-lab__hint">
        Player attempts: {me?.attemptsUsed ?? 0} · dmg: {me?.totalDamage ?? 0} · best:{' '}
        {me?.bestAttemptDamage ?? 0}
      </p>
      <p className="character-lab__hint">Concurrent test: {conc}</p>
      <div className="character-lab__row">
        <button type="button" onClick={() => void worldBossStore.devEnsure()}>
          Activate / Ensure
        </button>
        <button type="button" onClick={() => void worldBossStore.devSetHp(1000)}>
          Set HP 1000
        </button>
        <button type="button" onClick={() => void worldBossStore.devSetHpPercent(1)}>
          HP 100%
        </button>
        <button type="button" onClick={() => void worldBossStore.devSetHpPercent(0.4)}>
          HP 40%
        </button>
        <button type="button" onClick={() => void worldBossStore.devResetCycle()}>
          Reset Cycle
        </button>
        <button type="button" onClick={() => void worldBossStore.devResetAttempts()}>
          Reset Attempts
        </button>
        <button type="button" onClick={() => void worldBossStore.devMockDamage(500_000)}>
          Mock Damage
        </button>
        <button
          type="button"
          onClick={() => void worldBossStore.devSimulateOtherPlayer(250_000)}
        >
          Simulate Other Player
        </button>
        <button type="button" onClick={() => void worldBossStore.devForceMilestone()}>
          Force Milestone
        </button>
        <button type="button" onClick={() => void worldBossStore.devForceDefeat()}>
          Force Defeat
        </button>
        <button
          type="button"
          onClick={() => {
            void worldBossStore.devSimulateConcurrent(800, 700).then((r) => {
              setConc(`accepted=${r.totalAccepted} hp=${r.finalHp}`);
            });
          }}
        >
          Concurrent 800+700 vs 1000
        </button>
        <button type="button" onClick={() => void worldBossStore.startFight()}>
          Start attempt
        </button>
      </div>
    </div>
  );
}
