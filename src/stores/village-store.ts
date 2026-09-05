import {
  VILLAGE_SCORE_FROM_QUEST_XP,
  VILLAGE_SCORE_PER_KILL,
  VILLAGE_SEED_STANDINGS,
  VILLAGE_WAR_DURATION_MS,
} from '@/constants/village';
import { getVillage } from '@/data/villages';
import { createStore } from '@/stores/create-store';
import type {
  VillageId,
  VillageSystemState,
  VillageWar,
} from '@/types/village';
import { buildSeedStandings, getVillageRank, rankVillages } from '@/utils/village-ranking';

function createInitialState(): VillageSystemState {
  return {
    playerVillageId: null,
    playerNickname: null,
    standings: buildSeedStandings(VILLAGE_SEED_STANDINGS),
    wars: [],
    isOpen: false,
  };
}

const store = createStore<VillageSystemState>(createInitialState());

function patchStanding(villageId: VillageId, patch: Partial<{ score: number; playerCount: number }>): void {
  const state = store.getSnapshot();
  const current = state.standings[villageId];
  if (!current) return;
  store.setState({
    ...state,
    standings: {
      ...state.standings,
      [villageId]: {
        ...current,
        score: Math.max(0, patch.score ?? current.score),
        playerCount: Math.max(0, patch.playerCount ?? current.playerCount),
      },
    },
  });
}

/**
 * Sistema de vilas — afiliação, ranking, pontuação e guerras (API pronta).
 */
export const villageStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState(createInitialState());
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen });
  },

  /**
   * Associa o jogador a uma vila (criação de personagem).
   * Incrementa a quantidade de jogadores.
   */
  joinVillage(villageId: VillageId, nickname: string): void {
    const state = store.getSnapshot();
    const previous = state.playerVillageId;
    const standings = { ...state.standings };

    if (previous && previous !== villageId && standings[previous]) {
      standings[previous] = {
        ...standings[previous],
        playerCount: Math.max(0, standings[previous].playerCount - 1),
      };
    }

    if (!previous || previous !== villageId) {
      const target = standings[villageId];
      if (target) {
        standings[villageId] = {
          ...target,
          playerCount: target.playerCount + 1,
        };
      }
    }

    store.setState({
      ...state,
      playerVillageId: villageId,
      playerNickname: nickname,
      standings,
      isOpen: false,
    });
  },

  getPlayerVillageId(): VillageId | null {
    return store.getSnapshot().playerVillageId;
  },

  getRanking() {
    return rankVillages(store.getSnapshot().standings);
  },

  getPlayerRank(): number {
    const state = store.getSnapshot();
    if (!state.playerVillageId) return 0;
    return getVillageRank(state.standings, state.playerVillageId);
  },

  /** Soma pontos à vila do jogador. */
  addScore(amount: number, villageId: VillageId | null = store.getSnapshot().playerVillageId): void {
    if (!villageId || amount <= 0) return;
    const current = store.getSnapshot().standings[villageId];
    if (!current) return;
    patchStanding(villageId, { score: current.score + Math.floor(amount) });
  },

  onEnemyKilled(): void {
    this.addScore(VILLAGE_SCORE_PER_KILL);
  },

  onQuestCompleted(questXp: number): void {
    this.addScore(questXp * VILLAGE_SCORE_FROM_QUEST_XP);
  },

  listWars(): VillageWar[] {
    return store.getSnapshot().wars;
  },

  getActiveWarFor(villageId: VillageId): VillageWar | undefined {
    return store.getSnapshot().wars.find(
      (war) =>
        (war.status === 'declared' || war.status === 'active') &&
        (war.attackerId === villageId || war.defenderId === villageId),
    );
  },

  /**
   * Declara guerra entre duas vilas (preparado para o sistema futuro).
   * Não inicia combate ainda — só registra o estado.
   */
  declareWar(attackerId: VillageId, defenderId: VillageId): VillageWar | null {
    if (attackerId === defenderId) return null;
    if (!getVillage(attackerId) || !getVillage(defenderId)) return null;

    const state = store.getSnapshot();
    const existing = state.wars.find(
      (war) =>
        war.status !== 'ended' &&
        ((war.attackerId === attackerId && war.defenderId === defenderId) ||
          (war.attackerId === defenderId && war.defenderId === attackerId)),
    );
    if (existing) return existing;

    const now = Date.now();
    const war: VillageWar = {
      id: `war-${attackerId}-${defenderId}-${now}`,
      attackerId,
      defenderId,
      status: 'declared',
      declaredAt: now,
      attackerScore: 0,
      defenderScore: 0,
    };

    store.setState({ ...state, wars: [...state.wars, war] });
    return war;
  },

  /** Inicia uma guerra declarada (hook futuro de evento/cron). */
  startWar(warId: string): boolean {
    const state = store.getSnapshot();
    const wars = state.wars.map((war) => {
      if (war.id !== warId || war.status !== 'declared') return war;
      const startedAt = Date.now();
      return {
        ...war,
        status: 'active' as const,
        startedAt,
        endsAt: startedAt + VILLAGE_WAR_DURATION_MS,
      };
    });
    const changed = wars.some((war, index) => war !== state.wars[index]);
    if (!changed) return false;
    store.setState({ ...state, wars });
    return true;
  },

  endWar(warId: string): boolean {
    const state = store.getSnapshot();
    const wars = state.wars.map((war) =>
      war.id === warId && war.status !== 'ended'
        ? { ...war, status: 'ended' as const, endsAt: Date.now() }
        : war,
    );
    const changed = wars.some((war, index) => war !== state.wars[index]);
    if (!changed) return false;
    store.setState({ ...state, wars });
    return true;
  },

  /** Atalho: declara guerra contra o rival histórico da vila do jogador. */
  declareWarOnRival(): VillageWar | null {
    const state = store.getSnapshot();
    if (!state.playerVillageId) return null;
    const rivalId = getVillage(state.playerVillageId).rivalId;
    return this.declareWar(state.playerVillageId, rivalId);
  },
};
