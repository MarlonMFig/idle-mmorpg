'use client';

import { useEffect, useState } from 'react';
import { getWorldBossDefinition } from '@/constants/world-boss';
import { describeBossRewards } from '@/lib/boss-rewards';
import { getActiveLineageProgress } from '@/lib/lineage-progress';
import { useStore } from '@/hooks/use-store';
import { accountStore } from '@/stores/account-store';
import { bossStore } from '@/stores/boss-store';
import { locationStore } from '@/stores/location-store';
import { vitalsStore } from '@/stores/vitals-store';
import { worldBossStore } from '@/stores/world-boss-store';
import { MgrWindow } from '@/ui/mgr';
import { WorldBossPanel } from '@/ui/world-boss';

const BOSS_TABS = [
  { id: 'solo', label: 'Solo' },
  { id: 'world', label: 'World Boss' },
] as const;

function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type BossesTab = 'solo' | 'world';

export function BossesPanel() {
  const isOpen = useStore(bossStore, (s) => s.isOpen);
  const confirmId = useStore(bossStore, (s) => s.confirmBossId);
  const pending = useStore(bossStore, (s) => s.pendingReward);
  const tick = useStore(bossStore, (s) => JSON.stringify(s.attempts));
  const playerLevel = useStore(vitalsStore, (s) => s.level);
  const lineageRank = useStore(
    accountStore,
    (s) => getActiveLineageProgress(s.lineageProgress).rank,
  );
  const [tab, setTab] = useState<BossesTab>('solo');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        if (confirmId) bossStore.setConfirmBoss(null);
        else bossStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, confirmId]);

  if (!isOpen) return null;
  void tick;

  const confirm = confirmId ? bossStore.getDefinition(confirmId) : null;

  function start(bossId: string): void {
    const started = bossStore.startAttempt(bossId);
    if (!started.ok) return;
    const def = bossStore.getDefinition(bossId);
    if (!def) return;
    locationStore.enterBoss(def.mapKey, def.id);
  }

  return (
    <MgrWindow
      title="Bosses"
      size="lg"
      ariaLabel="Bosses"
      tabs={[...BOSS_TABS]}
      activeTab={tab}
      onTabChange={(id) => {
        setTab(id as BossesTab);
        bossStore.setConfirmBoss(null);
      }}
      onClose={() => bossStore.setOpen(false)}
    >
      {tab === 'world' ? (
        <WorldBossPanel />
      ) : (
        <>
          {pending && !pending.claimed ? (
            <p className="boss-panel__hint">
              Há recompensa pendente — colete no resultado da luta.
            </p>
          ) : null}

          {confirm ? (
            <div className="boss-confirm">
              <h3>Desafiar Boss?</h3>
              <p>
                {confirm.name} · Nv. {confirm.level}
              </p>
              <p>Tempo: {formatMs(confirm.timeLimit)}</p>
              <p>
                Tentativas restantes:{' '}
                {bossStore.getRemainingAttempts(confirm.id) == null
                  ? 'ilimitadas'
                  : bossStore.getRemainingAttempts(confirm.id)}
              </p>
              <div className="boss-panel__toolbar">
                <button type="button" onClick={() => start(confirm.id)}>
                  Iniciar
                </button>
                <button type="button" onClick={() => bossStore.setConfirmBoss(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="boss-panel__list">
              {bossStore.list().map((def) => {
                const remaining = bossStore.getRemainingAttempts(def.id);
                const eligible = bossStore.isEligible(def.id, playerLevel, lineageRank);
                const can = bossStore.canStart(def.id, playerLevel, lineageRank);
                return (
                  <article
                    key={def.id}
                    className={`boss-card${eligible.ok ? '' : ' boss-card--locked'}`}
                  >
                    <header className="boss-card__head">
                      <h3>{def.name}</h3>
                      <span>Nv. {def.level}</span>
                    </header>
                    <p>
                      Status:{' '}
                      {bossStore.getSnapshot().defeatedBosses[def.id] ? 'Derrotado' : 'Disponível'}
                    </p>
                    <p>Tentativas: {remaining == null ? '∞' : remaining}</p>
                    <p>Tempo: {formatMs(def.timeLimit)}</p>
                    <p>Recompensas: {describeBossRewards(def.rewards).join(' · ')}</p>
                    {!eligible.ok ? <p className="boss-card__lock">{eligible.reason}</p> : null}
                    {eligible.ok && !can.ok ? (
                      <p className="boss-card__lock">{can.reason}</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={!can.ok}
                      onClick={() => bossStore.setConfirmBoss(def.id)}
                    >
                      Desafiar
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </MgrWindow>
  );
}

export function BossCombatHud() {
  const runtime = useStore(bossStore, (s) => s.runtime);
  const abandon = useStore(bossStore, (s) => s.abandonConfirm);
  const encounter = useStore(locationStore, (s) => s.encounterKind);
  const now = useStore(bossStore, (s) => s.runtime?.remainingTimeMs ?? null);

  if (encounter !== 'boss' || !runtime) return null;
  const def = bossStore.getDefinition(runtime.bossId);
  const ratio = runtime.hpMax > 0 ? runtime.currentHp / runtime.hpMax : 0;
  const phase = def?.phases.find((row) => row.id === runtime.phaseId);

  return (
    <div className="boss-hud">
      <div className="boss-hud__row">
        <strong>{def?.name ?? 'Boss'}</strong>
        <span>Nv. {def?.level ?? '—'}</span>
        {phase ? (
          <span>
            {phase.id === 'phase-1' ? 'Phase 1' : phase.id === 'phase-2' ? 'Phase 2' : phase.id}
          </span>
        ) : null}
        {now != null ? <span>{formatMs(now)}</span> : null}
      </div>
      <div className="boss-hud__bar" aria-label="HP do Boss">
        <div
          className="boss-hud__fill"
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        />
      </div>
      <button
        type="button"
        className="boss-hud__abandon"
        onClick={() => bossStore.setAbandonConfirm(true)}
      >
        Abandonar
      </button>
      {abandon ? (
        <div className="boss-confirm boss-confirm--float">
          <p>Abandonar a luta?</p>
          <div className="boss-panel__toolbar">
            <button
              type="button"
              onClick={() => {
                bossStore.finishDefeat('abandon');
                locationStore.enterHub();
              }}
            >
              Confirmar
            </button>
            <button type="button" onClick={() => bossStore.setAbandonConfirm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BossResultOverlay() {
  const result = useStore(bossStore, (s) => s.result);
  const pending = useStore(bossStore, (s) => s.pendingReward);
  const worldBossTick = useStore(worldBossStore, (s) => s.tick);
  const encounter = useStore(locationStore, (s) => s.encounterKind);
  const playerLevel = useStore(vitalsStore, (s) => s.level);
  const lineageRank = useStore(
    accountStore,
    (s) => getActiveLineageProgress(s.lineageProgress).rank,
  );
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  if (!result && !(pending && !pending.claimed)) return null;
  void worldBossTick;

  const def = bossStore.getDefinition(result?.bossId ?? pending?.bossId ?? '');
  const canRetry = def ? bossStore.canStart(def.id, playerLevel, lineageRank).ok : false;
  const isWorldBossResult = result?.bossId === getWorldBossDefinition().bossId;
  const worldBossClaims = isWorldBossResult
    ? worldBossStore.myClaims().filter((claim) => !claim.claimed)
    : [];
  const soloPending = !isWorldBossResult && pending && !pending.claimed ? pending : null;
  const hasRewards = Boolean(soloPending || worldBossClaims.length > 0);

  async function claimWorldBossReward(claimId: string): Promise<void> {
    setClaimingId(claimId);
    setClaimError(null);
    const claimed = await worldBossStore.claim(claimId);
    if (!claimed.ok) setClaimError(claimed.reason ?? 'Não foi possível coletar a recompensa.');
    setClaimingId(null);
  }

  function closeResult(): void {
    bossStore.clearResult();
    locationStore.enterHub();
  }

  return (
    <div
      className="boss-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeResult();
      }}
    >
      <div
        className={`boss-panel boss-result${result?.victory ? ' boss-result--victory' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Resultado do Boss"
      >
        <div className="boss-result__header">
          <p className="boss-result__eyebrow">
            {isWorldBossResult ? 'World Boss' : 'Resultado da batalha'}
          </p>
          <h2 className="boss-panel__title">
            {result ? (result.victory ? 'Vitória' : 'Derrota') : 'Recompensa pendente'}
          </h2>
          <p className="boss-result__subtitle">
            {result?.victory
              ? 'O inimigo foi derrotado com sucesso.'
              : 'Confira os detalhes da sua tentativa.'}
          </p>
        </div>

        {result ? (
          <div className="boss-result__stats">
            <div className="boss-result__stat">
              <span>Dano causado</span>
              <strong>{result.damageDealt.toLocaleString('pt-BR')}</strong>
            </div>
            <div className="boss-result__stat">
              <span>Tempo de luta</span>
              <strong>{formatMs(result.durationMs)}</strong>
            </div>
          </div>
        ) : null}

        {hasRewards ? (
          <section className="boss-result__rewards" aria-label="Recompensas">
            <div className="boss-result__section-heading">
              <h3>Recompensas</h3>
              <span>
                {isWorldBossResult ? `${worldBossClaims.length} pendente(s)` : 'Disponível'}
              </span>
            </div>
            {soloPending ? (
              <div className="boss-result__reward-row">
                <span>{describeBossRewards(soloPending.rewards).join(' · ')}</span>
                <button
                  type="button"
                  className="boss-result__claim"
                  onClick={() => bossStore.claimPending()}
                >
                  Coletar
                </button>
              </div>
            ) : (
              worldBossClaims.map((claim) => (
                <div className="boss-result__reward-row" key={claim.claimId}>
                  <span>
                    {claim.kind === 'milestone' && claim.milestoneId
                      ? `Marco ${claim.milestoneId}`
                      : claim.kind === 'defeat'
                        ? 'Derrota do World Boss'
                        : 'Participação'}
                    <small>{describeBossRewards(claim.rewards).join(' · ')}</small>
                  </span>
                  <button
                    type="button"
                    className="boss-result__claim"
                    disabled={claimingId === claim.claimId}
                    onClick={() => void claimWorldBossReward(claim.claimId)}
                  >
                    {claimingId === claim.claimId ? 'Coletando…' : 'Coletar'}
                  </button>
                </div>
              ))
            )}
          </section>
        ) : isWorldBossResult ? (
          <p className="boss-result__empty">
            Recompensas sincronizadas. Você pode conferir a aba World Boss.
          </p>
        ) : null}
        {claimError ? <p className="boss-result__error">{claimError}</p> : null}
        {result?.victory && pending?.claimed && !isWorldBossResult ? (
          <p className="boss-result__collected">Recompensa coletada.</p>
        ) : null}

        <div className="boss-panel__toolbar boss-result__actions">
          {result && !result.victory && canRetry && encounter === 'boss' ? (
            <button
              type="button"
              onClick={() => {
                if (!def) return;
                bossStore.clearResult();
                const started = bossStore.startAttempt(def.id);
                if (started.ok) locationStore.enterBoss(def.mapKey, def.id);
              }}
            >
              Tentar novamente
            </button>
          ) : null}
          <button type="button" className="boss-result__back" onClick={closeResult}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
