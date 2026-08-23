'use client';

import { useEffect, useMemo } from 'react';
import { getGuildBossDefinition } from '@/constants/guild-boss';
import { describeBossRewards } from '@/lib/boss-rewards';
import { useStore } from '@/hooks/use-store';
import { guildBossStore } from '@/stores/guild-boss-store';
import { guildStore } from '@/stores/guild-store';
import type { Guild } from '@/types/guild';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** UI mecânica mínima — visual definitivo depois. */
export function GuildBossTab({ guild }: { guild: Guild }) {
  const tick = useStore(guildBossStore, (s) => s.tick);
  const playerId = useStore(guildStore, (s) => s.playerId);
  const def = getGuildBossDefinition();

  useEffect(() => {
    void guildBossStore.refresh();
  }, [guild.id, tick]);

  const state = useMemo(() => {
    void tick;
    return guildBossStore.getStateSync();
  }, [tick, guild.id]);

  const me = playerId && state ? state.participants[playerId] : null;
  const rank = guildBossStore.myRank();
  const attemptsLeft = guildBossStore.attemptsRemaining();
  const claims = guildBossStore.myClaims().filter((c) => !c.claimed);
  const ranking = state
    ? Object.values(state.participants).sort((a, b) => b.totalDamage - a.totalDamage)
    : [];

  if (!state || state.status === 'LOCKED') {
    return (
      <div className="guild-win__boss-tab">
        <h3>Guild Boss</h3>
        <p className="guild-win__hint">
          GUILD BOSS BLOQUEADO — Requisito: Guild Level {def.guildLevelRequirement}
        </p>
      </div>
    );
  }

  const hpPct = state.maxHp > 0 ? Math.round((state.currentHp / state.maxHp) * 100) : 0;

  return (
    <div className="guild-win__boss-tab">
      <h3>Guild Boss (semanal)</h3>
      <p>
        Status: <strong>{state.status}</strong> · Ciclo {state.cycleId}
      </p>
      <p>
        HP: {fmt(state.currentHp)} / {fmt(state.maxHp)} ({hpPct}%)
      </p>
      <div className="guild-win__exp-bar">
        <span style={{ width: `${hpPct}%` }} />
      </div>
      <p>
        Tentativas restantes (hoje): <strong>{attemptsLeft}</strong> / {def.maxAttemptsPerMember}
      </p>
      <p>
        Seu dano: {fmt(me?.totalDamage ?? 0)} · Melhor: {fmt(me?.bestAttemptDamage ?? 0)} · Rank
        interno: {rank ?? '—'}
      </p>

      {state.status !== 'DEFEATED' ? (
        <button
          type="button"
          className="guild-win__btn-gold"
          disabled={attemptsLeft <= 0}
          onClick={() => void guildBossStore.startFight()}
        >
          Entrar na tentativa
        </button>
      ) : (
        <p className="guild-win__hint">Boss derrotado neste ciclo. Resgate recompensas abaixo.</p>
      )}

      <h4>Ranking interno (dano)</h4>
      <ol>
        {ranking.length === 0 ? (
          <li className="guild-win__empty">Nenhum dano ainda.</li>
        ) : (
          ranking.slice(0, 10).map((p, i) => (
            <li key={p.playerId}>
              #{i + 1} {p.nickname} — {fmt(p.totalDamage)}
            </li>
          ))
        )}
      </ol>

      <h4>Recompensas pendentes</h4>
      {claims.length === 0 ? (
        <p className="guild-win__hint">Nenhuma. Claim antes do próximo ciclo.</p>
      ) : (
        <ul className="guild-win__apps">
          {claims.map((c) => (
            <li key={c.claimId}>
              <div>
                {c.kind}
                {c.milestoneId ? ` (${c.milestoneId})` : ''}:{' '}
                {describeBossRewards(c.rewards).join(', ')}
              </div>
              <button
                type="button"
                className="guild-win__btn-green"
                onClick={() => void guildBossStore.claim(c.claimId)}
              >
                Coletar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
