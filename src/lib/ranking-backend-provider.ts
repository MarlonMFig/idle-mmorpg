import { socialFetch, SocialApiError } from '@/lib/social-api-client';
import { loadGuestAuth } from '@/lib/guest-auth';
import type {
  RankingBoardResult,
  RankingPlayerProfile,
  RankingProvider,
  RankingQuery,
} from '@/types/ranking';

/**
 * Ranking via API backend. Não cai para mock em falha.
 */
export class BackendRankingProvider implements RankingProvider {
  readonly id = 'backend';

  async getLeaderboard(query: RankingQuery): Promise<RankingBoardResult> {
    const params = new URLSearchParams();
    params.set('categoryId', query.categoryId);
    if (query.page != null) params.set('page', String(query.page));
    if (query.pageSize != null) params.set('pageSize', String(query.pageSize));
    if (query.lineageFilter) params.set('lineageFilter', String(query.lineageFilter));
    if (query.bossId) params.set('bossId', query.bossId);
    const data = await socialFetch<{ board: RankingBoardResult }>(`/api/social/ranking?${params}`);
    return data.board;
  }

  async getPlayerRank(query: RankingQuery, playerId: string): Promise<number | null> {
    const board = await this.getLeaderboard({ ...query, page: 0 });
    if (board.myEntry?.playerId === playerId) return board.myRank;
    return board.myRank;
  }

  async submitScore(profile: RankingPlayerProfile): Promise<void> {
    const auth = loadGuestAuth();
    if (auth && profile.playerId !== auth.playerId) {
      // Alinha snapshot ao guest id oficial
      profile = { ...profile, playerId: auth.playerId };
    }
    await socialFetch('/api/social/ranking', {
      method: 'POST',
      body: JSON.stringify({ profile }),
      nickname: profile.nickname,
    });
  }
}

export class UnavailableRankingProvider implements RankingProvider {
  readonly id = 'unavailable';

  private fail(): never {
    throw new SocialApiError('UNAVAILABLE', 'Ranking indisponível (backend não configurado).', 503);
  }

  async getLeaderboard(): Promise<RankingBoardResult> {
    this.fail();
  }
  async getPlayerRank(): Promise<number | null> {
    this.fail();
  }
  async submitScore(): Promise<void> {
    this.fail();
  }
}

let backendSingleton: BackendRankingProvider | null = null;

export function getBackendRankingProvider(): BackendRankingProvider {
  if (!backendSingleton) backendSingleton = new BackendRankingProvider();
  return backendSingleton;
}
