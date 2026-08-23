'use client';

import { isDevMode } from '@/config/devConfig';
import { guildXpForLevel } from '@/constants/guild';
import { useStore } from '@/hooks/use-store';
import { guildStore } from '@/stores/guild-store';

export function CharacterLabGuildDebug() {
  const guildId = useStore(guildStore, (s) => s.guildId);
  const registryTick = useStore(guildStore, (s) => s.registryTick);
  const guild = guildId ? guildStore.getMyGuild() : null;
  void registryTick;
  const role = guildStore.getMyRole();
  const me = guild?.members.find((m) => m.playerId === guildStore.getSnapshot().playerId);

  if (!isDevMode()) return null;

  return (
    <div className="character-lab__subpanel">
      <h3>Guild Debug</h3>
      <p className="character-lab__hint">Provider: {guildStore.getProviderId()}</p>
      <p className="character-lab__hint">Guild ID: {guild?.id ?? '—'}</p>
      <p className="character-lab__hint">
        Level: {guild?.level ?? '—'} · XP: {guild ? `${guild.xp}/${guildXpForLevel(guild.level)}` : '—'}
      </p>
      <p className="character-lab__hint">Members: {guild?.members.length ?? 0}</p>
      <p className="character-lab__hint">Role: {role ?? '—'}</p>
      <p className="character-lab__hint">Contribution: {me?.contribution ?? 0}</p>
      <div className="character-lab__row">
        <button type="button" onClick={() => void guildStore.devSeedMock()}>
          Seed mock guild
        </button>
        <button type="button" onClick={() => void guildStore.devAddGuildXp(5_000)}>
          +5000 Guild XP
        </button>
        <button
          type="button"
          onClick={() => {
            const g = guildStore.getMyGuild();
            const pid = guildStore.getSnapshot().playerId;
            if (!g || !pid) return;
            for (let i = 0; i < 10; i += 1) {
              guildStore.notifyOnlineKill({ source: 'online' });
            }
          }}
        >
          +10 online kills
        </button>
        <button
          type="button"
          onClick={() => {
            guildStore.notifyOnlineKill({ source: 'offline' });
            guildStore.notifyOnlineKill({ source: 'dev' });
          }}
        >
          Test offline/dev = 0
        </button>
        <button type="button" onClick={() => void guildStore.devForceFail(true)}>
          Force fail ON
        </button>
        <button type="button" onClick={() => void guildStore.devForceFail(false)}>
          Force fail OFF
        </button>
        <button type="button" onClick={() => void guildStore.devResetGuildData()}>
          Reset guild data
        </button>
      </div>
    </div>
  );
}
