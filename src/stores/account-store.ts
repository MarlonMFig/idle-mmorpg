import { isDevMode } from '@/config/devConfig';
import { LINEAGE_SYSTEM_UNLOCK_LEVEL, LINEAGE_LABELS } from '@/constants/lineage';
import {
  getActiveLineageProgress,
  getLineageIdProgress,
  normalizePlayerLineageProgress,
  setLineageIdProgress,
  cloneDefaultSpecializationProgress,
} from '@/lib/lineage-progress';
import { createStore } from '@/stores/create-store';
import type { LineageId } from '@/types/character-meta';
import { LINEAGE_IDS } from '@/types/character-meta';
import {
  DEFAULT_LINEAGE_ID_PROGRESS,
  DEFAULT_PLAYER_LINEAGE_PROGRESS,
  type LineageIdProgress,
  type LineageRankIndex,
  type PlayerLineageProgress,
} from '@/types/lineage';
import { vitalsStore } from '@/stores/vitals-store';
import { emitSystemMessage } from '@/lib/system-log';

export interface AccountMetaState {
  /** Progresso de Linhagem da conta (substitui clanId). */
  lineageProgress: PlayerLineageProgress;
  /** Menu Linhagem aberto. */
  isOpen: boolean;
}

const store = createStore<AccountMetaState>({
  lineageProgress: { ...DEFAULT_PLAYER_LINEAGE_PROGRESS },
  isOpen: false,
});

function isLineageIdLocal(value: unknown): value is LineageId {
  return typeof value === 'string' && (LINEAGE_IDS as readonly string[]).includes(value);
}

function clampRank(value: unknown): LineageIdProgress['rank'] {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const n = Math.max(0, Math.min(4, Math.floor(value)));
  return n as LineageIdProgress['rank'];
}

function clampSpecLevel(value: unknown): LineageIdProgress['specializationLevel'] {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  const n = Math.max(0, Math.min(4, Math.floor(value)));
  return n as LineageIdProgress['specializationLevel'];
}

function isSpecSlot(value: unknown): LineageIdProgress['selectedSpecializationId'] {
  if (
    value === 'specializationA' ||
    value === 'specializationB' ||
    value === 'specializationC'
  ) {
    return value;
  }
  return null;
}

/**
 * Metadados de conta (Linhagem do jogador, etc.).
 * Persistido em session-persist.
 */
export const accountStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({
      lineageProgress: { ...DEFAULT_PLAYER_LINEAGE_PROGRESS },
      isOpen: false,
    });
  },

  hydrate(partial: {
    lineageProgress?: Partial<PlayerLineageProgress> | PlayerLineageProgress | null;
    clanId?: LineageId | null;
  }): void {
    const fromProgress = partial.lineageProgress
      ? normalizePlayerLineageProgress(partial.lineageProgress)
      : null;
    const legacyClan = isLineageIdLocal(partial.clanId) ? partial.clanId : null;
    const lineageId = fromProgress?.lineageId ?? legacyClan ?? null;
    store.setState({
      lineageProgress: fromProgress
        ? { ...fromProgress, lineageId: lineageId ?? fromProgress.lineageId }
        : {
            ...DEFAULT_PLAYER_LINEAGE_PROGRESS,
            lineageId,
          },
      isOpen: false,
    });
  },

  getLineageProgress(): PlayerLineageProgress {
    return store.getSnapshot().lineageProgress;
  },

  applyLineageProgress(lineageProgress: PlayerLineageProgress): void {
    store.setState({ ...store.getSnapshot(), lineageProgress });
  },

  getPlayerLineageId(): LineageId | null {
    return store.getSnapshot().lineageProgress.lineageId;
  },

  /** @deprecated use getPlayerLineageId */
  getClanId(): LineageId | null {
    return this.getPlayerLineageId();
  },

  isLineageSystemUnlocked(level = vitalsStore.getLevel()): boolean {
    return level >= LINEAGE_SYSTEM_UNLOCK_LEVEL;
  },

  /** @deprecated use isLineageSystemUnlocked */
  isClanSystemUnlocked(level?: number): boolean {
    return this.isLineageSystemUnlocked(level);
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen });
  },

  /**
   * Escolha única de Linhagem. Troca / custo / reset — configurável no futuro.
   * Rank I automático ao escolher.
   */
  chooseLineage(lineageId: LineageId): boolean {
    const state = store.getSnapshot();
    if (state.lineageProgress.lineageId != null) {
      emitSystemMessage('Linhagem já escolhida. Troca ainda não está disponível.');
      return false;
    }
    if (!isLineageIdLocal(lineageId)) return false;
    if (!this.isLineageSystemUnlocked()) {
      emitSystemMessage(`Linhagem libera no nível ${LINEAGE_SYSTEM_UNLOCK_LEVEL}.`);
      return false;
    }
    const existing = getLineageIdProgress(state.lineageProgress, lineageId);
    const initial: LineageIdProgress =
      existing.rank > 0
        ? existing
        : {
            ...DEFAULT_LINEAGE_ID_PROGRESS,
            rank: 1,
            specializationProgress: cloneDefaultSpecializationProgress(),
          };
    store.setState({
      ...state,
      lineageProgress: {
        ...state.lineageProgress,
        lineageId,
        byLineage: {
          ...state.lineageProgress.byLineage,
          [lineageId]: initial,
        },
      },
    });
    emitSystemMessage(`Você segue a Linhagem ${LINEAGE_LABELS[lineageId]}.`);
    void import('@/stores/achievements-store').then((m) =>
      m.achievementsStore.evaluate('lineage'),
    );
    void import('@/stores/missions-store').then((m) => m.missionsStore.syncStateMissions());
    return true;
  },

  /** @deprecated use chooseLineage */
  chooseClan(clanId: LineageId): boolean {
    return this.chooseLineage(clanId);
  },

  /** DEV — altera rank da Linhagem ativa sem conceder benefícios. */
  devSetRank(rank: LineageIdProgress['rank'], lineageId?: LineageId): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    const id = lineageId ?? state.lineageProgress.lineageId;
    if (!id) return;
    store.setState({
      ...state,
      lineageProgress: setLineageIdProgress(state.lineageProgress, id, {
        rank: clampRank(rank),
      }),
    });
  },

  /** DEV — incrementa kills online da Linhagem ativa. */
  devAddOnlineKills(amount: number, lineageId?: LineageId): void {
    if (!isDevMode()) return;
    if (amount <= 0) return;
    const state = store.getSnapshot();
    const id = lineageId ?? state.lineageProgress.lineageId;
    if (!id) return;
    const current = getLineageIdProgress(state.lineageProgress, id);
    store.setState({
      ...state,
      lineageProgress: setLineageIdProgress(state.lineageProgress, id, {
        onlineKills: current.onlineKills + Math.floor(amount),
      }),
    });
  },

  /** DEV — reseta rank (→ I) e onlineKills da Linhagem. Não toca Collection/Maestria. */
  devResetLineageRankProgress(lineageId?: LineageId): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    const id = lineageId ?? state.lineageProgress.lineageId;
    if (!id) return;
    const current = getLineageIdProgress(state.lineageProgress, id);
    store.setState({
      ...state,
      lineageProgress: setLineageIdProgress(state.lineageProgress, id, {
        rank: current.rank > 0 ? 1 : 0,
        onlineKills: 0,
      }),
    });
  },

  /** DEV — troca Linhagem ativa preservando byLineage. */
  devSetActiveLineage(lineageId: LineageId): void {
    if (!isDevMode()) return;
    if (!isLineageIdLocal(lineageId)) return;
    const state = store.getSnapshot();
    const existing = getLineageIdProgress(state.lineageProgress, lineageId);
    const nextProgress = setLineageIdProgress(state.lineageProgress, lineageId, {
      rank: existing.rank > 0 ? existing.rank : 1,
    });
    store.setState({
      ...state,
      lineageProgress: { ...nextProgress, lineageId },
    });
  },

  /** DEV — preview de especialização. Atualiza o caminho ativo sem apagar os outros. */
  devSetSpecialization(
    selectedSpecializationId: LineageIdProgress['selectedSpecializationId'],
    specializationLevel: LineageIdProgress['specializationLevel'],
    lineageId?: LineageId,
  ): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    const id = lineageId ?? state.lineageProgress.lineageId;
    if (!id) return;
    const current = getLineageIdProgress(state.lineageProgress, id);
    const slot = isSpecSlot(selectedSpecializationId);
    const level = clampSpecLevel(specializationLevel);
    const specializationProgress = {
      ...current.specializationProgress,
    };
    if (slot) {
      specializationProgress[slot] = {
        ...specializationProgress[slot],
        level: level > 0 ? level : 1,
      };
    }
    store.setState({
      ...state,
      lineageProgress: setLineageIdProgress(state.lineageProgress, id, {
        selectedSpecializationId: slot,
        specializationProgress,
      }),
    });
  },

  /** DEV — kills da especialização ativa (não mistura com lineage.onlineKills). */
  devAddSpecializationKills(amount: number, lineageId?: LineageId): void {
    if (!isDevMode()) return;
    if (amount <= 0) return;
    const state = store.getSnapshot();
    const id = lineageId ?? state.lineageProgress.lineageId;
    if (!id) return;
    const current = getLineageIdProgress(state.lineageProgress, id);
    const selected = current.selectedSpecializationId;
    if (!selected) return;
    const slot = current.specializationProgress[selected];
    store.setState({
      ...state,
      lineageProgress: setLineageIdProgress(state.lineageProgress, id, {
        specializationProgress: {
          ...current.specializationProgress,
          [selected]: { ...slot, onlineKills: slot.onlineKills + Math.floor(amount) },
        },
      }),
    });
  },

  /** DEV — reseta especializações. Não toca rank, Collection, Maestria ou Stars. */
  devResetSpecializationProgress(lineageId?: LineageId): void {
    if (!isDevMode()) return;
    const state = store.getSnapshot();
    const id = lineageId ?? state.lineageProgress.lineageId;
    if (!id) return;
    store.setState({
      ...state,
      lineageProgress: setLineageIdProgress(state.lineageProgress, id, {
        selectedSpecializationId: null,
        specializationProgress: {
          specializationA: { level: 0, onlineKills: 0 },
          specializationB: { level: 0, onlineKills: 0 },
          specializationC: { level: 0, onlineKills: 0 },
        },
      }),
    });
  },

  /** Atalho — rank da Linhagem ativa. */
  getActiveRank(): LineageRankIndex | 0 {
    return getActiveLineageProgress(this.getLineageProgress()).rank;
  },
};
