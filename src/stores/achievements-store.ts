import { isDevMode } from '@/config/devConfig';
import {
  getAchievementDefinition,
  listAchievementDefinitions,
} from '@/data/achievements/achievement-registry';
import { getTitleDefinition, listTitleDefinitions } from '@/data/achievements/title-registry';
import {
  evaluateCondition,
  listAchievementsForTrigger,
  type AchievementTrigger,
} from '@/lib/achievement-evaluation';
import { grantAchievementRewards } from '@/lib/achievement-rewards';
import { buildAchievementWorldSnapshot } from '@/lib/achievement-snapshot';
import { enqueueAchievementUnlockToast } from '@/lib/achievement-toast';
import { createStore } from '@/stores/create-store';
import {
  DEFAULT_ACHIEVEMENT_PROGRESS,
  type AchievementProgressState,
  type AchievementsPanelTab,
} from '@/types/achievements';

export type AchievementUiStatus = 'locked' | 'unlocked' | 'claimed';

interface AchievementsStoreState extends AchievementProgressState {
  isOpen: boolean;
  panelTab: AchievementsPanelTab;
}

const claimInFlight = new Set<string>();

const store = createStore<AchievementsStoreState>({
  ...DEFAULT_ACHIEVEMENT_PROGRESS,
  unlocked: {},
  claimed: {},
  unlockedTitles: {},
  equippedTitleId: null,
  isOpen: false,
  panelTab: 'conquistas',
});

function cloneProgress(state: AchievementProgressState): AchievementProgressState {
  return {
    unlocked: { ...state.unlocked },
    claimed: { ...state.claimed },
    unlockedTitles: { ...state.unlockedTitles },
    equippedTitleId: state.equippedTitleId,
  };
}

/**
 * Conquistas / Títulos do jogador (Item 23).
 * Única fonte oficial (Item 38) — gem-store não controla Achievements.
 */
export const achievementsStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  setOpen(open: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen: open });
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setPanelTab(tab: AchievementsPanelTab): void {
    store.setState({ ...store.getSnapshot(), panelTab: tab });
  },

  reset(): void {
    const ui = store.getSnapshot();
    store.setState({
      unlocked: {},
      claimed: {},
      unlockedTitles: {},
      equippedTitleId: null,
      isOpen: false,
      panelTab: ui.panelTab,
    });
  },

  hydrate(partial: Partial<AchievementProgressState> | null | undefined): void {
    const ui = store.getSnapshot();
    if (!partial) {
      store.setState({
        unlocked: {},
        claimed: {},
        unlockedTitles: {},
        equippedTitleId: null,
        isOpen: ui.isOpen,
        panelTab: ui.panelTab,
      });
      return;
    }
    store.setState({
      unlocked: { ...(partial.unlocked ?? {}) },
      claimed: { ...(partial.claimed ?? {}) },
      unlockedTitles: { ...(partial.unlockedTitles ?? {}) },
      equippedTitleId:
        typeof partial.equippedTitleId === 'string' ? partial.equippedTitleId : null,
      isOpen: ui.isOpen,
      panelTab: ui.panelTab,
    });
  },

  getPersistedProgress(): AchievementProgressState {
    const state = store.getSnapshot();
    return cloneProgress(state);
  },

  getStatus(id: string): AchievementUiStatus {
    const state = store.getSnapshot();
    if (state.claimed[id]) return 'claimed';
    if (state.unlocked[id]) return 'unlocked';
    return 'locked';
  },

  getProgress(id: string): { current: number; required: number; completed: boolean } {
    const def = getAchievementDefinition(id);
    if (!def) return { current: 0, required: 1, completed: false };
    return evaluateCondition(def.condition, buildAchievementWorldSnapshot());
  },

  /**
   * Avalia conquistas relevantes ao trigger. Retroativo: marca unlocked se condição já verdadeira.
   * Não concede recompensa automaticamente.
   */
  evaluate(trigger: AchievementTrigger = 'all', options?: { silent?: boolean }): string[] {
    const world = buildAchievementWorldSnapshot();
    const defs = listAchievementsForTrigger(trigger);
    const state = store.getSnapshot();
    const next = { ...state, ...cloneProgress(state) };
    const newly: string[] = [];

    for (const def of defs) {
      if (next.unlocked[def.id] || next.claimed[def.id]) continue;
      const progress = evaluateCondition(def.condition, world);
      if (!progress.completed) continue;
      next.unlocked[def.id] = true;
      newly.push(def.id);
    }

    if (newly.length > 0) {
      store.setState(next);
      if (!options?.silent) {
        for (const id of newly) {
          const def = getAchievementDefinition(id);
          if (def) enqueueAchievementUnlockToast(id, def.name);
        }
      }
    }
    return newly;
  },

  /** Avaliação completa (migração / login). Silenciosa para não spammar toast. */
  evaluateAllRetroactive(): string[] {
    return this.evaluate('all', { silent: true });
  },

  claim(achievementId: string): { ok: boolean; reason?: string } {
    if (claimInFlight.has(achievementId)) {
      return { ok: false, reason: 'Resgate em andamento' };
    }
    const def = getAchievementDefinition(achievementId);
    if (!def) return { ok: false, reason: 'Conquista inexistente' };

    claimInFlight.add(achievementId);
    try {
      this.evaluate('all', { silent: true });
      const state = store.getSnapshot();
      if (state.claimed[achievementId]) {
        return { ok: false, reason: 'Já resgatada' };
      }
      if (!state.unlocked[achievementId]) {
        const progress = evaluateCondition(def.condition, buildAchievementWorldSnapshot());
        if (!progress.completed) return { ok: false, reason: 'Ainda bloqueada' };
      }

      const result = grantAchievementRewards(
        def.rewards,
        (titleId) => {
          const cur = store.getSnapshot();
          if (cur.unlockedTitles[titleId]) return;
          store.setState({
            ...cur,
            unlockedTitles: { ...cur.unlockedTitles, [titleId]: true },
          });
        },
        { achievementId },
      );

      if (!result.ok) {
        return { ok: false, reason: result.reason };
      }

      const next = { ...store.getSnapshot(), ...cloneProgress(store.getSnapshot()) };
      next.unlocked[achievementId] = true;
      next.claimed[achievementId] = true;
      store.setState(next);
      return { ok: true };
    } finally {
      claimInFlight.delete(achievementId);
    }
  },

  claimAll(): { claimed: string[]; failed: string[] } {
    const claimed: string[] = [];
    const failed: string[] = [];
    this.evaluate('all', { silent: true });
    for (const def of listAchievementDefinitions()) {
      const state = store.getSnapshot();
      if (!state.unlocked[def.id] || state.claimed[def.id]) continue;
      const result = this.claim(def.id);
      if (result.ok) claimed.push(def.id);
      else failed.push(def.id);
    }
    return { claimed, failed };
  },

  unlockTitle(titleId: string): boolean {
    if (!getTitleDefinition(titleId)) return false;
    const state = store.getSnapshot();
    if (state.unlockedTitles[titleId]) return true;
    store.setState({
      ...state,
      unlockedTitles: { ...state.unlockedTitles, [titleId]: true },
    });
    return true;
  },

  equipTitle(titleId: string): { ok: boolean; reason?: string } {
    if (!getTitleDefinition(titleId)) return { ok: false, reason: 'Título inexistente' };
    const state = store.getSnapshot();
    if (!state.unlockedTitles[titleId]) {
      return { ok: false, reason: 'Título bloqueado' };
    }
    store.setState({ ...state, equippedTitleId: titleId });
    return { ok: true };
  },

  unequipTitle(): void {
    const state = store.getSnapshot();
    if (!state.equippedTitleId) return;
    store.setState({ ...state, equippedTitleId: null });
  },

  getEquippedTitleId(): string | null {
    return store.getSnapshot().equippedTitleId;
  },

  // —— DEV ——
  devUnlock(achievementId: string): void {
    if (!isDevMode()) return;
    if (!getAchievementDefinition(achievementId)) return;
    const state = store.getSnapshot();
    store.setState({
      ...state,
      unlocked: { ...state.unlocked, [achievementId]: true },
    });
  },

  /** Reseta só o estado da conquista (não Level/Collection/etc.). Pode re-unlock na próxima evaluate. */
  devResetAchievement(achievementId: string): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    const unlocked = { ...state.unlocked };
    const claimed = { ...state.claimed };
    delete unlocked[achievementId];
    delete claimed[achievementId];
    store.setState({ ...state, unlocked, claimed });
  },

  devUnlockTitle(titleId: string): void {
    if (!isDevMode()) return;
    this.unlockTitle(titleId);
  },

  listTitlesForDebug(): ReturnType<typeof listTitleDefinitions> {
    return listTitleDefinitions();
  },
};
