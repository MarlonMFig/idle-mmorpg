'use client';

import { useEffect, useState } from 'react';
import { describeBossRewards } from '@/lib/boss-rewards';
import { getActiveLineageProgress } from '@/lib/lineage-progress';
import { useStore } from '@/hooks/use-store';
import { accountStore } from '@/stores/account-store';
import { bossStore } from '@/stores/boss-store';
import { locationStore } from '@/stores/location-store';
import { vitalsStore } from '@/stores/vitals-store';
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
  const lineageRank = useStore(accountStore, (s) => getActiveLineageProgress(s.lineageProgress).rank);
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
              <p className="boss-panel__hint">Há recompensa pendente — colete no resultado da luta.</p>
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
                    <article key={def.id} className={`boss-card${eligible.ok ? '' : ' boss-card--locked'}`}>
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
                      {eligible.ok && !can.ok ? <p className="boss-card__lock">{can.reason}</p> : null}
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
        {phase ? <span>{phase.id === 'phase-1' ? 'Phase 1' : phase.id === 'phase-2' ? 'Phase 2' : phase.id}</span> : null}
        {now != null ? <span>{formatMs(now)}</span> : null}
      </div>
      <div className="boss-hud__bar" aria-label="HP do Boss">
        <div className="boss-hud__fill" style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }} />
      </div>
      <button type="button" className="boss-hud__abandon" onClick={() => bossStore.setAbandonConfirm(true)}>
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
  const encounter = useStore(locationStore, (s) => s.encounterKind);
  const playerLevel = useStore(vitalsStore, (s) => s.level);
  const lineageRank = useStore(accountStore, (s) => getActiveLineageProgress(s.lineageProgress).rank);

  if (!result && !(pending && !pending.claimed)) return null;
  const def = bossStore.getDefinition(result?.bossId ?? pending?.bossId ?? '');
  const canRetry = def ? bossStore.canStart(def.id, playerLevel, lineageRank).ok : false;

  return (
    <div className="boss-overlay" role="presentation">
      <div className="boss-panel" role="dialog" aria-label="Resultado do Boss">
        <h2 className="boss-panel__title">{result ? (result.victory ? 'Vitória' : 'Derrota') : 'Recompensa pendente'}</h2>
        {result ? (
          <>
            <p>Damage Dealt: {result.damageDealt.toLocaleString('pt-BR')}</p>
            <p>Tempo: {formatMs(result.durationMs)}</p>
          </>
        ) : null}
        {result?.victory && pending && !pending.claimed ? (
          <>
            <p>Rewards: {describeBossRewards(pending.rewards).join(' · ')}</p>
            <button type="button" onClick={() => bossStore.claimPending()}>
              Coletar
            </button>
          </>
        ) : null}
        {pending && !pending.claimed && !result?.victory ? (
          <>
            <p>Rewards: {describeBossRewards(pending.rewards).join(' · ')}</p>
            <button type="button" onClick={() => bossStore.claimPending()}>
              Coletar
            </button>
          </>
        ) : null}
        {result?.victory && pending?.claimed ? <p>Recompensa coletada.</p> : null}
        <div className="boss-panel__toolbar">
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
          <button
            type="button"
            onClick={() => {
              bossStore.clearResult();
              locationStore.enterHub();
            }}
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
