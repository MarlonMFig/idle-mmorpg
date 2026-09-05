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

const STATUS_LABEL: Record<string, string> = {
  LOCKED: 'Bloqueado',
  ACTIVE: 'Ativo',
  DEFEATED: 'Derrotado',
};

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
      <div className="guild-win__feature">
        <div className="guild-win__feature-hero guild-win__feature-hero--locked">
          <p className="guild-win__feature-eyebrow">Boss semanal</p>
          <h3>Guild Boss</h3>
          <p className="guild-win__hint">
            Bloqueado até a Guild atingir o nível {def.guildLevelRequirement}.
          </p>
        </div>
      </div>
    );
  }

  const hpPct = state.maxHp > 0 ? Math.round((state.currentHp / state.maxHp) * 100) : 0;
  const statusLabel = STATUS_LABEL[state.status] ?? state.status;

  return (
    <div className="guild-win__feature">
      <div className="guild-win__feature-hero">
        <div>
          <p className="guild-win__feature-eyebrow">Boss semanal · Ciclo {state.cycleId}</p>
          <h3>Guild Boss</h3>
          <p className="guild-win__feature-status">
            Status <strong>{statusLabel}</strong>
          </p>
        </div>
        {state.status !== 'DEFEATED' ? (
          <button
            type="button"
            className="guild-win__btn-gold"
            disabled={attemptsLeft <= 0}
            onClick={() => void guildBossStore.startFight()}
          >
            {attemptsLeft <= 0 ? 'Sem tentativas hoje' : 'Entrar na tentativa'}
          </button>
        ) : (
          <p className="guild-win__hint">Derrotado neste ciclo — colete as recompensas.</p>
        )}
      </div>

      <div className="guild-win__stat-grid">
        <article className="guild-win__stat-card">
          <span>HP restante</span>
          <strong>
            {fmt(state.currentHp)} / {fmt(state.maxHp)}
          </strong>
          <div className="guild-win__exp-bar guild-win__exp-bar--boss">
            <span style={{ width: `${hpPct}%` }} />
          </div>
        </article>
        <article className="guild-win__stat-card">
          <span>Tentativas hoje</span>
          <strong>
            {attemptsLeft} / {def.maxAttemptsPerMember}
          </strong>
        </article>
        <article className="guild-win__stat-card">
          <span>Seu dano</span>
          <strong>{fmt(me?.totalDamage ?? 0)}</strong>
          <small>Melhor tentativa: {fmt(me?.bestAttemptDamage ?? 0)}</small>
        </article>
        <article className="guild-win__stat-card">
          <span>Rank interno</span>
          <strong>{rank ?? '—'}</strong>
        </article>
      </div>

      <div className="guild-win__feature-split">
        <section className="guild-win__feature-panel">
          <h4>Ranking de dano</h4>
          <ol className="guild-win__rank-list">
            {ranking.length === 0 ? (
              <li className="guild-win__empty">Nenhum dano registrado ainda.</li>
            ) : (
              ranking.slice(0, 10).map((p, i) => (
                <li key={p.playerId} className={p.playerId === playerId ? 'is-you' : undefined}>
                  <span className="guild-win__rank-pos">#{i + 1}</span>
                  <span className="guild-win__rank-name">{p.nickname}</span>
                  <span className="guild-win__rank-dmg">{fmt(p.totalDamage)}</span>
                </li>
              ))
            )}
          </ol>
        </section>

        <section className="guild-win__feature-panel">
          <h4>Recompensas pendentes</h4>
          {claims.length === 0 ? (
            <p className="guild-win__hint">Nenhuma. Colete antes do próximo ciclo.</p>
          ) : (
            <ul className="guild-win__claim-list">
              {claims.map((c) => (
                <li key={c.claimId}>
                  <div>
                    <strong>
                      {c.kind}
                      {c.milestoneId ? ` · ${c.milestoneId}` : ''}
                    </strong>
                    <span>{describeBossRewards(c.rewards).join(' · ')}</span>
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
        </section>
      </div>
    </div>
  );
}
