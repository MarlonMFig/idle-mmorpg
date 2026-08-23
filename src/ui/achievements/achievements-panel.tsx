'use client';

import { useEffect, useMemo, useState } from 'react';
import { listAchievementDefinitions } from '@/data/achievements/achievement-registry';
import { getTitleDefinition, listTitleDefinitions } from '@/data/achievements/title-registry';
import { describeAchievementRewards } from '@/lib/achievement-rewards';
import { useStore } from '@/hooks/use-store';
import { achievementsStore } from '@/stores/achievements-store';
import { villageStore } from '@/stores/village-store';
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_LABELS,
  TITLE_RARITY_LABELS,
  type AchievementCategory,
  type AchievementDefinition,
} from '@/types/achievements';
import { MgrWindow } from '@/ui/mgr';

type FilterId = 'all' | AchievementCategory;

function statusRank(status: 'locked' | 'unlocked' | 'claimed'): number {
  if (status === 'unlocked') return 0;
  if (status === 'locked') return 1;
  return 2;
}

function formatProgress(current: number, required: number): string {
  return `${current.toLocaleString('pt-BR')} / ${required.toLocaleString('pt-BR')}`;
}

function AchievementCard({ def }: { def: AchievementDefinition }) {
  const progressTick = useStore(achievementsStore, (s) => Object.keys(s.unlocked).length + Object.keys(s.claimed).length);
  void progressTick;
  const status = achievementsStore.getStatus(def.id);
  const progress = achievementsStore.getProgress(def.id);
  const hiddenLocked = Boolean(def.hidden) && status === 'locked';
  const name = hiddenLocked ? '???' : def.name;
  const description = hiddenLocked ? 'Conquista Secreta' : def.description;
  const rewards = hiddenLocked ? [] : describeAchievementRewards(def.id);

  return (
    <article className={`achv-card achv-card--${status}`}>
      <header className="achv-card__head">
        <h3 className="achv-card__name">{name}</h3>
        <span className="achv-card__state">
          {status === 'locked' ? 'BLOQUEADO' : status === 'unlocked' ? 'CONCLUÍDA' : 'RESGATADA'}
        </span>
      </header>
      <p className="achv-card__desc">{description}</p>
      {!hiddenLocked ? (
        <p className="achv-card__progress">{formatProgress(progress.current, progress.required)}</p>
      ) : null}
      {rewards.length > 0 ? (
        <p className="achv-card__rewards">Recompensa: {rewards.join(' · ')}</p>
      ) : null}
      {def.rewardsDev ? <p className="achv-card__dev">Copper = balanceamento DEV</p> : null}
      {status === 'unlocked' ? (
        <button
          type="button"
          className="achv-card__claim"
          onClick={() => achievementsStore.claim(def.id)}
        >
          Resgatar
        </button>
      ) : null}
    </article>
  );
}

function TitlesPane({ nickname }: { nickname: string }) {
  const unlockedTitles = useStore(achievementsStore, (s) => s.unlockedTitles);
  const equippedTitleId = useStore(achievementsStore, (s) => s.equippedTitleId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const titles = useMemo(() => listTitleDefinitions(), []);
  const preview = getTitleDefinition(previewId ?? equippedTitleId);

  return (
    <div className="achv-titles">
      <section className="achv-titles__preview" aria-label="Preview do título">
        <p className="achv-titles__preview-nick">{nickname || 'Shinobi'}</p>
        <p className="achv-titles__preview-title">
          {preview ? `[${preview.name}]` : 'Nenhum título equipado'}
        </p>
      </section>

      <ul className="achv-titles__list">
        {titles.map((title) => {
          const unlocked = Boolean(unlockedTitles[title.id]);
          const equipped = equippedTitleId === title.id;
          return (
            <li key={title.id} className={`achv-title${unlocked ? '' : ' is-locked'}${equipped ? ' is-equipped' : ''}`}>
              <button type="button" className="achv-title__main" onClick={() => setPreviewId(title.id)}>
                <span className="achv-title__name">{title.name}</span>
                <span className="achv-title__rarity">{TITLE_RARITY_LABELS[title.rarity]}</span>
                <span className="achv-title__desc">
                  {unlocked ? title.description : `Como desbloquear: ${title.description}`}
                </span>
                {equipped ? <span className="achv-title__badge">EQUIPADO</span> : null}
              </button>
              {unlocked ? (
                <div className="achv-title__actions">
                  {equipped ? (
                    <button type="button" onClick={() => achievementsStore.unequipTitle()}>
                      Remover
                    </button>
                  ) : (
                    <button type="button" onClick={() => achievementsStore.equipTitle(title.id)}>
                      Equipar
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Painel Conquistas / Títulos — cosmético + claim; sem stats.
 */
export function AchievementsPanel() {
  const isOpen = useStore(achievementsStore, (s) => s.isOpen);
  const panelTab = useStore(achievementsStore, (s) => s.panelTab);
  const unlocked = useStore(achievementsStore, (s) => s.unlocked);
  const claimed = useStore(achievementsStore, (s) => s.claimed);
  const nickname = useStore(villageStore, (s) => s.playerNickname ?? '');
  const [filter, setFilter] = useState<FilterId>('all');

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        achievementsStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const defs = useMemo(() => listAchievementDefinitions(), []);
  const claimableCount = useMemo(
    () => defs.filter((d) => unlocked[d.id] && !claimed[d.id]).length,
    [defs, unlocked, claimed],
  );
  const completedCount = useMemo(
    () => defs.filter((d) => unlocked[d.id] || claimed[d.id]).length,
    [defs, unlocked, claimed],
  );

  const visible = useMemo(() => {
    const filtered =
      filter === 'all' ? [...defs] : defs.filter((d) => d.category === filter);
    return filtered.sort((a, b) => {
      const sa = statusRank(achievementsStore.getStatus(a.id));
      const sb = statusRank(achievementsStore.getStatus(b.id));
      if (sa !== sb) return sa - sb;
      return a.name.localeCompare(b.name, 'pt-BR');
    });
  }, [defs, filter, unlocked, claimed]);

  if (!isOpen) return null;

  return (
    <MgrWindow
      title="Conquistas"
      lede={`Progresso Geral: ${completedCount} / ${defs.length}`}
      size="lg"
      ariaLabel="Conquistas"
      tabs={[
        { id: 'conquistas', label: 'Conquistas' },
        { id: 'titulos', label: 'Títulos' },
      ]}
      activeTab={panelTab}
      onTabChange={(id) => achievementsStore.setPanelTab(id as 'conquistas' | 'titulos')}
      onClose={() => achievementsStore.setOpen(false)}
    >
      {panelTab === 'conquistas' ? (
        <>
          <div className="achv-panel__filters" role="tablist" aria-label="Categorias">
            <button
              type="button"
              className={filter === 'all' ? 'is-active' : undefined}
              onClick={() => setFilter('all')}
            >
              Todas
            </button>
            {ACHIEVEMENT_CATEGORIES.map((id) => (
              <button
                key={id}
                type="button"
                className={filter === id ? 'is-active' : undefined}
                onClick={() => setFilter(id)}
              >
                {ACHIEVEMENT_CATEGORY_LABELS[id]}
              </button>
            ))}
          </div>

          <div className="achv-panel__toolbar">
            <button
              type="button"
              className="achv-panel__claim-all"
              disabled={claimableCount === 0}
              onClick={() => achievementsStore.claimAll()}
            >
              Resgatar todas ({claimableCount})
            </button>
          </div>

          <div className="achv-panel__list">
            {visible.map((def) => (
              <AchievementCard key={def.id} def={def} />
            ))}
          </div>
        </>
      ) : (
        <TitlesPane nickname={nickname} />
      )}
    </MgrWindow>
  );
}
