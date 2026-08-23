import type { RankingPlayerProfile, RankingProvider, RankingQuery, RankingBoardResult } from '@/types/ranking';
import { RANKING_TOP_LIMIT } from '@/types/ranking';
import { buildBoardFromProfiles } from '@/lib/ranking-sort';
import { LINEAGE_IDS, type LineageId } from '@/types/character-meta';

const MOCK_PREFIX = 'mock-rank-';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Provider local / mock (DEV + client-only).
 * Não é anti-cheat. Ranking global real exige backend.
 * Persistência: apenas em memória da sessão (mocks não vão ao save oficial).
 */
export class LocalRankingProvider implements RankingProvider {
  readonly id = 'local-mock';
  private profiles = new Map<string, RankingPlayerProfile>();
  private forceFail = false;

  setForceFail(fail: boolean): void {
    this.forceFail = fail;
  }

  async submitScore(profile: RankingPlayerProfile): Promise<void> {
    if (this.forceFail) throw new Error('Ranking provider indisponível');
    this.profiles.set(profile.playerId, { ...profile, bossBest: { ...profile.bossBest } });
  }

  async getLeaderboard(query: RankingQuery): Promise<RankingBoardResult> {
    const started = performance.now();
    await delay(12);
    if (this.forceFail) throw new Error('Ranking provider indisponível');

    const all = [...this.profiles.values()];
    const pageSize = Math.min(RANKING_TOP_LIMIT, Math.max(1, query.pageSize ?? RANKING_TOP_LIMIT));
    const board = buildBoardFromProfiles(all, { ...query, pageSize }, queryLocalPlayerId(all));
    const queryMs = Math.max(1, Math.round(performance.now() - started));
    return {
      categoryId: query.categoryId,
      entries: board.entries,
      totalEntries: board.totalEntries,
      page: query.page ?? 0,
      pageSize,
      myRank: board.myRank,
      myEntry: board.myEntry,
      refreshedAt: Date.now(),
      queryMs,
      empty: board.totalEntries === 0,
    };
  }

  async getPlayerRank(query: RankingQuery, playerId: string): Promise<number | null> {
    const board = await this.getLeaderboard({ ...query, page: 0, pageSize: RANKING_TOP_LIMIT });
    void board;
    const all = [...this.profiles.values()];
    const result = buildBoardFromProfiles(all, { ...query, page: 0, pageSize: 1 }, playerId);
    return result.myRank;
  }

  async seedMocks(count: number): Promise<void> {
    this.clearMocksSync();
    const n = Math.max(0, Math.min(500, Math.floor(count)));
    for (let i = 0; i < n; i += 1) {
      const lineageId = LINEAGE_IDS[i % LINEAGE_IDS.length] as LineageId;
      const level = 1 + (i % 100);
      const mastery = (i * 7) % 400;
      const kills = i * 37;
      const unique = 1 + (i % 40);
      const profile: RankingPlayerProfile = {
        playerId: `${MOCK_PREFIX}${i + 1}`,
        nickname: `MockShinobi${i + 1}`,
        playerLevel: level,
        levelXp: (i * 13) % 900,
        totalXp: level * 1000 + (i * 13) % 900,
        accountPower: level * 120 + mastery * 8 + unique * 40 + Math.floor(kills * 0.05),
        accountPowerProvisional: true,
        totalMastery: mastery,
        uniqueCharacters: unique,
        collectionRarityScore: unique * 4,
        onlineKills: kills,
        lineageId,
        lineageRank: (i % 4) + 1,
        specializationId: 'specializationA',
        specializationLevel: i % 5,
        lineageOnlineKills: kills % 20000,
        equippedTitleId: i % 17 === 0 ? null : null,
        bossBest: {
          'boss-training-dummy': {
            bestTimeMs: 20_000 + i * 250,
            bestDamage: 1000 + i * 10,
            victory: true,
          },
        },
      };
      this.profiles.set(profile.playerId, profile);
    }
  }

  async clearMocks(): Promise<void> {
    this.clearMocksSync();
  }

  clearMocksSync(): void {
    for (const id of [...this.profiles.keys()]) {
      if (id.startsWith(MOCK_PREFIX)) this.profiles.delete(id);
    }
  }

  mockCount(): number {
    let n = 0;
    for (const id of this.profiles.keys()) if (id.startsWith(MOCK_PREFIX)) n += 1;
    return n;
  }

  /** Expõe perfis para testes. */
  listProfiles(): RankingPlayerProfile[] {
    return [...this.profiles.values()];
  }

  replaceAll(profiles: readonly RankingPlayerProfile[]): void {
    this.profiles.clear();
    for (const p of profiles) this.profiles.set(p.playerId, p);
  }
}

function queryLocalPlayerId(all: RankingPlayerProfile[]): string | null {
  const real = all.find((p) => !p.playerId.startsWith(MOCK_PREFIX));
  return real?.playerId ?? null;
}

let singleton: LocalRankingProvider | null = null;

export function getLocalRankingProvider(): LocalRankingProvider {
  if (!singleton) singleton = new LocalRankingProvider();
  return singleton;
}

export function resetLocalRankingProvider(): void {
  singleton = new LocalRankingProvider();
}
