'use client';

import { isDevMode } from '@/config/devConfig';
import { getGuildBossDefinition } from '@/constants/guild-boss';
import { useStore } from '@/hooks/use-store';
import { guildBossStore } from '@/stores/guild-boss-store';
import { guildStore } from '@/stores/guild-store';
import { useEffect, useState } from 'react';

export function CharacterLabGuildBossDebug() {
  const guildId = useStore(guildStore, (s) => s.guildId);
  const [conc, setConc] = useState<string>('—');

  useEffect(() => {
    if (guildId) void guildBossStore.refresh();
  }, [guildId]);

  if (!isDevMode()) return null;

  const state = guildBossStore.getStateSync();
  const def = getGuildBossDefinition();
  const me = guildStore.getSnapshot().playerId
    ? state?.participants[guildStore.getSnapshot().playerId!]
    : null;

  return (
    <div className="character-lab__subpanel">
      <h3>Guild Boss Debug</h3>
      <p className="character-lab__hint">Provider: {guildBossStore.getProviderId()}</p>
      <p className="character-lab__hint">Guild: {guildId ?? '—'}</p>
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
        <button type="button" onClick={() => void guildBossStore.refresh()}>
          Refresh / Activate
        </button>
        <button type="button" onClick={() => void guildBossStore.devSetHpPercent(1)}>
          HP 100%
        </button>
        <button type="button" onClick={() => void guildBossStore.devSetHpPercent(0.4)}>
          HP 40%
        </button>
        <button type="button" onClick={() => void guildBossStore.devSetHp(1000)}>
          Set HP 1000
        </button>
        <button type="button" onClick={() => void guildBossStore.devMockDamage(500_000)}>
          Mock member dmg
        </button>
        <button type="button" onClick={() => void guildBossStore.devForceDefeat()}>
          Force defeat
        </button>
        <button type="button" onClick={() => void guildBossStore.devResetCycle()}>
          Reset cycle
        </button>
        <button
          type="button"
          onClick={() => {
            void guildBossStore.devSimulateConcurrent(800, 700).then((r) => {
              setConc(`accepted=${r.totalAccepted} hp=${r.finalHp}`);
            });
          }}
        >
          Concurrent 800+700 vs 1000
        </button>
        <button type="button" onClick={() => void guildBossStore.startFight()}>
          Start attempt
        </button>
      </div>
    </div>
  );
}
