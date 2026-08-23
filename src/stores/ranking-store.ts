import { isDevMode } from '@/config/devConfig';
import { TEST_BOSS_ID } from '@/data/bosses/boss-registry';
import { getLocalRankingProvider } from '@/lib/ranking-local-provider';
import { getRankingProvider, getRankingProviderId } from '@/lib/ranking-provider';
import { buildMyRankingProfile } from '@/lib/ranking-snapshot';
import { createStore } from '@/stores/create-store';
import type { LineageId } from '@/types/character-meta';
import type {
  RankingBoardResult,
  RankingCategoryId,
  RankingUiState,
} from '@/types/ranking';
import { RANKING_TOP_LIMIT } from '@/types/ranking';

const CACHE_TTL_MS = 45_000;
const REFRESH_COOLDOWN_MS = 3_000;
const SUBMIT_DEBOUNCE_MS = 2_500;

const store = createStore<RankingUiState>({
  isOpen: false,
  categoryId: 'level',
  lineageFilter: 'all',
  bossId: TEST_BOSS_ID,
  page: 0,
  loading: false,
  error: null,
  board: null,
  lastRefreshAt: null,
  refreshCooldownUntil: 0,
  providerId: getRankingProviderId(),
  queryMs: 0,
  mockCount: 0,
  forceFail: false,
});

let submitTimer: ReturnType<typeof setTimeout> | null = null;
let fetchSeq = 0;
let cachedBoard: RankingBoardResult | null = null;
let cachedKey = '';
let cachedAt = 0;

function cacheKey(state: RankingUiState): string {
  return `${state.categoryId}|${state.lineageFilter}|${state.bossId ?? ''}|${state.page}`;
}

async function submitMyProfileNow(): Promise<void> {
  const { shouldFreezeOfficialProgress } = await import('@/config/devConfig');
  if (shouldFreezeOfficialProgress()) return;
  try {
    const profile = buildMyRankingProfile();
    await getRankingProvider().submitScore(profile);
  } catch {
    // Ranking secundário — falha de submit não quebra o jogo.
  }
}

/**
 * Ranking UI store. Posição NÃO é persistida no save do jogador.
 */
export const rankingStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  setOpen(open: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen: open });
    if (open) {
      this.scheduleSubmit();
      void this.refresh({ soft: true });
    }
  },

  toggleOpen(): void {
    this.setOpen(!store.getSnapshot().isOpen);
  },

  setCategory(categoryId: RankingCategoryId): void {
    store.setState({ ...store.getSnapshot(), categoryId, page: 0 });
    void this.refresh({ soft: true });
  },

  setLineageFilter(filter: LineageId | 'all'): void {
    store.setState({ ...store.getSnapshot(), lineageFilter: filter, page: 0 });
    void this.refresh({ soft: true });
  },

  setBossId(bossId: string | null): void {
    store.setState({ ...store.getSnapshot(), bossId, page: 0 });
    void this.refresh({ soft: true });
  },

  setPage(page: number): void {
    store.setState({ ...store.getSnapshot(), page: Math.max(0, Math.floor(page)) });
    void this.refresh({ soft: true });
  },

  scheduleSubmit(): void {
    if (submitTimer) clearTimeout(submitTimer);
    submitTimer = setTimeout(() => {
      submitTimer = null;
      void submitMyProfileNow();
    }, SUBMIT_DEBOUNCE_MS);
  },

  notifyMetricChanged(): void {
    this.scheduleSubmit();
  },

  async refresh(opts?: { soft?: boolean; force?: boolean }): Promise<void> {
    const state = store.getSnapshot();
    const now = Date.now();
    const key = cacheKey(state);

    if (!opts?.force && opts?.soft && cachedBoard && cachedKey === key && now - cachedAt < CACHE_TTL_MS) {
      store.setState({
        ...state,
        board: cachedBoard,
        loading: false,
        error: null,
        queryMs: cachedBoard.queryMs,
        lastRefreshAt: cachedAt,
      });
      return;
    }

    if (!opts?.force && now < state.refreshCooldownUntil) return;

    const seq = ++fetchSeq;
    store.setState({
      ...state,
      loading: true,
      error: null,
      refreshCooldownUntil: opts?.force ? now + REFRESH_COOLDOWN_MS : state.refreshCooldownUntil,
      providerId: getRankingProviderId(),
    });

    try {
      await submitMyProfileNow();
      const provider = getRankingProvider();
      const board = await provider.getLeaderboard({
        categoryId: state.categoryId,
        lineageFilter: state.lineageFilter,
        bossId: state.bossId,
        page: state.page,
        pageSize: RANKING_TOP_LIMIT,
      });
      if (seq !== fetchSeq) return;
      cachedBoard = board;
      cachedKey = key;
      cachedAt = Date.now();
      const local = getLocalRankingProvider();
      store.setState({
        ...store.getSnapshot(),
        loading: false,
        error: null,
        board,
        lastRefreshAt: cachedAt,
        queryMs: board.queryMs,
        mockCount: local.mockCount(),
        refreshCooldownUntil: Date.now() + REFRESH_COOLDOWN_MS,
      });
    } catch (error) {
      if (seq !== fetchSeq) return;
      store.setState({
        ...store.getSnapshot(),
        loading: false,
        error: error instanceof Error ? error.message : 'Não foi possível carregar o Ranking.',
        refreshCooldownUntil: Date.now() + REFRESH_COOLDOWN_MS,
      });
    }
  },

  // —— DEV ——
  async devSeedMocks(count = 100): Promise<void> {
    if (!isDevMode()) return;
    const local = getLocalRankingProvider();
    await local.seedMocks(count);
    cachedAt = 0;
    await this.refresh({ force: true });
  },

  async devClearMocks(): Promise<void> {
    if (!isDevMode()) return;
    await getLocalRankingProvider().clearMocks();
    cachedAt = 0;
    await this.refresh({ force: true });
  },

  async devForceFail(fail: boolean): Promise<void> {
    if (!isDevMode()) return;
    getLocalRankingProvider().setForceFail(fail);
    store.setState({ ...store.getSnapshot(), forceFail: fail });
    await this.refresh({ force: true });
  },

  /** Posiciona o jogador local em torno do rank alvo via power/level adjust nos mocks. */
  async devSetMyApproxRank(targetRank: number): Promise<void> {
    if (!isDevMode()) return;
    await submitMyProfileNow();
    const local = getLocalRankingProvider();
    const mine = buildMyRankingProfile();
    const profiles = local.listProfiles().filter((p) => p.playerId !== mine.playerId);
    // Garante mocks suficientes
    if (profiles.filter((p) => p.playerId.startsWith('mock-')).length < 120) {
      await local.seedMocks(200);
    }
    const all = local.listProfiles().filter((p) => p.playerId !== mine.playerId);
    const sorted = [...all].sort((a, b) => b.playerLevel - a.playerLevel || b.totalXp - a.totalXp);
    const idx = Math.max(0, Math.min(sorted.length, Math.floor(targetRank) - 1));
    const above = sorted[idx - 1];
    const below = sorted[idx];
    const level = below?.playerLevel ?? above?.playerLevel ?? mine.playerLevel;
    const adjusted: typeof mine = {
      ...mine,
      playerLevel: level,
      levelXp: (below?.levelXp ?? 500) + 1,
      totalXp: (below?.totalXp ?? level * 1000) + 1,
      accountPower: (below?.accountPower ?? mine.accountPower) + 1,
    };
    await local.submitScore(adjusted);
    // Re-submit real profile metrics but keep for board test we need the adjusted one
    // For DEV visualization of "my rank", keep adjusted until next real submit.
    cachedAt = 0;
    store.setState({ ...store.getSnapshot(), categoryId: 'level' });
    await this.refresh({ force: true });
  },
};
