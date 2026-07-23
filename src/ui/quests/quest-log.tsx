'use client';

import { QUEST_STATUS_LABELS } from '@/constants/quest';
import { getItem } from '@/data/items';
import { getQuest } from '@/data/quests';
import { useStore } from '@/hooks/use-store';
import { questStore } from '@/stores/quest-store';
import { formatObjectiveProgress } from '@/utils/quest';
import { HudPanel, HudPanelCollapsed } from '@/ui/hud/hud-panel';

/**
 * Log de missões — ativas, prontas e recompensas.
 */
export function QuestLog() {
  const isOpen = useStore(questStore, (s) => s.isOpen);
  const progress = useStore(questStore, (s) => s.progress);
  const tracked = Object.values(progress).filter(
    (entry) => entry.status === 'active' || entry.status === 'ready',
  );
  const catalog = questStore.listAllWithStatus();

  if (!isOpen) {
    return (
      <HudPanelCollapsed
        label="Missões (J)"
        ariaLabel="Abrir missões"
        className="hud-quests"
        onOpen={() => questStore.setOpen(true)}
      />
    );
  }

  return (
    <HudPanel
      title="Missões"
      badge="J"
      ariaLabel="Missões"
      className="hud-quests"
      onClose={() => questStore.setOpen(false)}
    >
      {tracked.length > 0 ? (
        <div className="hud-quests__tracked">
          {tracked.map((entry) => {
            const quest = getQuest(entry.questId);
            if (!quest) return null;
            return (
              <article key={entry.questId} className="hud-quests__card">
                <header className="hud-quests__card-head">
                  <h3 className="hud-quests__name">{quest.name}</h3>
                  <span className="hud-quests__status">
                    {QUEST_STATUS_LABELS[entry.status === 'ready' ? 'ready' : 'active']}
                  </span>
                </header>
                <ul className="hud-quests__objectives">
                  {quest.objectives.map((objective) => (
                    <li key={objective.id}>
                      {formatObjectiveProgress(objective, entry.counts[objective.id] ?? 0)}
                    </li>
                  ))}
                </ul>
                <p className="hud-quests__rewards">
                  XP {quest.rewards.xp}
                  {(quest.rewards.items ?? []).map((item) => {
                    const def = getItem(item.itemId);
                    return ` · ${def?.name ?? item.itemId} ×${item.quantity}`;
                  })}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="hud-quests__empty">Nenhuma missão em andamento. Fale com Iruka.</p>
      )}

      <details className="hud-quests__catalog">
        <summary>Todas as missões</summary>
        <ul className="hud-quests__catalog-list">
          {catalog.map(({ quest, status }) => (
            <li key={quest.id}>
              <span>{quest.name}</span>
              <span className={`hud-quests__pill is-${status}`}>{QUEST_STATUS_LABELS[status]}</span>
            </li>
          ))}
        </ul>
      </details>
    </HudPanel>
  );
}
