'use client';

import { useEffect, useMemo, useState } from 'react';
import { getWorldBossDefinition } from '@/constants/world-boss';
import { getBossDefinition } from '@/data/bosses/boss-registry';
import { resolveBossPhase } from '@/lib/boss-runtime';
import { describeBossRewards } from '@/lib/boss-rewards';
import { formatResetCountdown } from '@/lib/mission-cycle';
import { useStore } from '@/hooks/use-store';
import { guildStore } from '@/stores/guild-store';
import { worldBossStore } from '@/stores/world-boss-store';
import { vitalsStore } from '@/stores/vitals-store';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** UI mecânica mínima — World Boss global. */
export function WorldBossPanel() {
  const tick = useStore(worldBossStore, (s) => s.tick);
  const playerId = useStore(guildStore, (s) => s.playerId);
  const playerLevel = useStore(vitalsStore, (s) => s.level);
  const error = useStore(worldBossStore, (s) => s.error);
  const [starting, setStarting] = useState(false);
  const def = getWorldBossDefinition();
  const bossDef = getBossDefinition(def.bossId);

  useEffect(() => {
    guildStore.ensurePlayerId();
    void worldBossStore.refresh();
    void worldBossStore.refreshRanking();
  }, []);

  useEffect(() => {
    void tick;
    void worldBossStore.refreshRanking();
  }, [tick]);

  const state = useMemo(() => {
    void tick;
    return worldBossStore.getStateSync();
  }, [tick]);

  const me = playerId && state ? state.participants[playerId] : null;
  const rank = worldBossStore.myRank();
  const attemptsLeft = worldBossStore.attemptsRemaining();
  const claims = worldBossStore.myClaims().filter((c) => !c.claimed);

  const hpPct = state && state.maxHp > 0 ? state.currentHp / state.maxHp : 0;
  const phase = bossDef ? resolveBossPhase(hpPct, bossDef.phases) : null;
  const cycleRemaining =
    state?.endsAt != null ? formatResetCountdown(state.endsAt) : '—';
  const canFight =
    state?.status === 'ACTIVE' &&
    attemptsLeft > 0 &&
    playerLevel >= def.minimumPlayerLevel &&
    !starting;

  return (
    <div className="boss-panel__list world-boss-panel">
      <article className="boss-card">
        <header className="boss-card__head">
          <h3>{bossDef?.name ?? 'World Boss'}</h3>
          <span>{state?.status ?? '…'}</span>
        </header>

        {error ? <p className="boss-card__lock">{error}</p> : null}

        <p>
          HP global: {state ? `${fmt(state.currentHp)} / ${fmt(state.maxHp)}` : '—'} (
          {Math.round(hpPct * 100)}%)
        </p>
        <div className="boss-hud__bar" aria-label="HP global do World Boss">
          <div
            className="boss-hud__fill"
            style={{ width: `${Math.max(0, Math.min(100, hpPct * 100))}%` }}
          />
        </div>
        <p>Fase: {phase?.id ?? '—'}</p>
        <p>Ciclo restante: {cycleRemaining}</p>
        <p>
          Tentativas: <strong>{attemptsLeft}</strong> / {def.maxAttempts}
        </p>
        <p>
          Seu dano: {fmt(me?.totalDamage ?? 0)} · Rank: {rank ?? '—'}
        </p>
        {playerLevel < def.minimumPlayerLevel ? (
          <p className="boss-card__lock">Requer Level {def.minimumPlayerLevel}</p>
        ) : null}

        <button
          type="button"
          disabled={!canFight}
          onClick={() => {
            setStarting(true);
            void worldBossStore.startFight().finally(() => setStarting(false));
          }}
        >
          DESAFIAR
        </button>
      </article>

      <section>
        <h4>Recompensas pendentes</h4>
        {claims.length === 0 ? (
          <p className="boss-panel__hint">Nenhuma. Claim antes do próximo ciclo.</p>
        ) : (
          <ul className="boss-panel__list">
            {claims.map((c) => (
              <li key={c.claimId}>
                <div>
                  {c.kind}
                  {c.milestoneId ? ` (${c.milestoneId})` : ''}:{' '}
                  {describeBossRewards(c.rewards).join(', ')}
                </div>
                <button type="button" onClick={() => void worldBossStore.claim(c.claimId)}>
                  Coletar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
