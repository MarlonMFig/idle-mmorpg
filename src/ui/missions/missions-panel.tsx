'use client';

import { useEffect, useMemo } from 'react';
import {
  JOURNEY_MISSIONS,
  getMissionDefinition,
  journeyStageIndex,
} from '@/data/missions/mission-registry';
import { describeMissionRewards } from '@/lib/mission-rewards';
import {
  formatResetCountdown,
  getNextDailyResetMs,
  getNextWeeklyResetMs,
} from '@/lib/mission-cycle';
import { LINEAGE_LABELS } from '@/constants/lineage';
import { useStore } from '@/hooks/use-store';
import { accountStore } from '@/stores/account-store';
import { missionsStore } from '@/stores/missions-store';
import type { MissionDefinition } from '@/types/missions';
import { MgrWindow } from '@/ui/mgr';

function statusLabel(status: 'active' | 'completed' | 'claimed'): string {
  if (status === 'completed') return 'CONCLUÍDA';
  if (status === 'claimed') return 'RESGATADA';
  return 'ATIVA';
}

function formatLineageText(text: string, lineageId: string | null): string {
  if (!lineageId) return text.replace('sua Linhagem', 'sua Linhagem');
  return text.replace('sua Linhagem', `Linhagem ${LINEAGE_LABELS[lineageId as keyof typeof LINEAGE_LABELS] ?? lineageId}`);
}

function MissionCard({ def }: { def: MissionDefinition }) {
  const tick = useStore(
    missionsStore,
    (s) =>
      `${s.daily.cycleId}:${s.weekly.cycleId}:${s.journey.currentId}:${JSON.stringify(s.daily.missions[def.id] ?? s.weekly.missions[def.id] ?? s.journey.missions[def.id] ?? null)}`,
  );
  void tick;
  const status = missionsStore.getStatus(def.id);
  const progress = missionsStore.getProgressDisplay(def.id);
  const lineageId = useStore(accountStore, (s) => s.lineageProgress.lineageId);
  const rewards = describeMissionRewards(def.id);

  return (
    <article className={`mission-card mission-card--${status}`}>
      <header className="mission-card__head">
        <h3 className="mission-card__name">{def.name}</h3>
        <span className="mission-card__state">{statusLabel(status)}</span>
      </header>
      <p className="mission-card__desc">{formatLineageText(def.description, lineageId)}</p>
      <p className="mission-card__progress">
        {progress.current.toLocaleString('pt-BR')} / {progress.required.toLocaleString('pt-BR')}
      </p>
      {rewards.length > 0 ? (
        <p className="mission-card__rewards">Recompensa: {rewards.join(' · ')}</p>
      ) : null}
      {def.rewardsDev ? <p className="mission-card__dev">Copper = balanceamento inicial</p> : null}
      {status === 'completed' ? (
        <button type="button" className="mission-card__claim" onClick={() => missionsStore.claim(def.id)}>
          Resgatar
        </button>
      ) : null}
    </article>
  );
}

function CyclePane({ type }: { type: 'daily' | 'weekly' }) {
  const bucket = useStore(missionsStore, (s) => (type === 'daily' ? s.daily : s.weekly));
  const resetMs = type === 'daily' ? getNextDailyResetMs() : getNextWeeklyResetMs();
  const defs = bucket.selectedIds
    .map((id) => getMissionDefinition(id))
    .filter((row): row is MissionDefinition => row != null);
  const claimable = defs.filter((d) => missionsStore.getStatus(d.id) === 'completed').length;

  return (
    <>
      <p className="mission-panel__reset">
        Renova em: {formatResetCountdown(resetMs)}
      </p>
      <p className="mission-panel__hint">Recompensas não resgatadas expiram na renovação.</p>
      <div className="mission-panel__toolbar">
        <button
          type="button"
          disabled={claimable === 0}
          onClick={() => missionsStore.claimAll(type)}
        >
          Resgatar todas ({claimable})
        </button>
      </div>
      <div className="mission-panel__list">
        {defs.map((def) => (
          <MissionCard key={def.id} def={def} />
        ))}
      </div>
    </>
  );
}

function JourneyPane() {
  const currentId = useStore(missionsStore, (s) => s.journey.currentId);
  const total = JOURNEY_MISSIONS.length;
  const stage = journeyStageIndex(currentId);
  const current = currentId ? getMissionDefinition(currentId) : null;
  const nextId = current?.nextMissionId ?? null;
  const next = nextId ? getMissionDefinition(nextId) : null;
  const claimable = current && missionsStore.getStatus(current.id) === 'completed';

  return (
    <div className="mission-journey">
      <p className="mission-panel__progress">
        Etapa {stage} / {total}
      </p>
      {current ? <MissionCard def={current} /> : <p>Jornada concluída.</p>}
      {next ? (
        <article className="mission-card mission-card--locked">
          <h3 className="mission-card__name">Próxima: {next.name}</h3>
          <p className="mission-card__desc">{next.description}</p>
          <p className="mission-card__state">BLOQUEADA</p>
        </article>
      ) : null}
      {claimable ? (
        <div className="mission-panel__toolbar">
          <button type="button" onClick={() => missionsStore.claimAll('journey')}>
            Resgatar
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MissionsPanel() {
  const isOpen = useStore(missionsStore, (s) => s.isOpen);
  const tab = useStore(missionsStore, (s) => s.panelTab);

  useEffect(() => {
    if (!isOpen) return;
    missionsStore.ensureCycles();
    missionsStore.syncStateMissions({ silent: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        missionsStore.setOpen(false);
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        missionsStore.ensureCycles();
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isOpen]);

  const tabs = useMemo(
    () =>
      [
        { id: 'daily' as const, label: 'Diárias' },
        { id: 'weekly' as const, label: 'Semanais' },
        { id: 'journey' as const, label: 'Jornada' },
      ],
    [],
  );

  if (!isOpen) return null;

  return (
    <MgrWindow
      title="Missões"
      size="lg"
      ariaLabel="Missões"
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => missionsStore.setPanelTab(id as typeof tab)}
      onClose={() => missionsStore.setOpen(false)}
    >
      {tab === 'daily' ? <CyclePane type="daily" /> : null}
      {tab === 'weekly' ? <CyclePane type="weekly" /> : null}
      {tab === 'journey' ? <JourneyPane /> : null}
    </MgrWindow>
  );
}
