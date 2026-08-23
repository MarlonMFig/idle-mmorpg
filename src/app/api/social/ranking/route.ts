import { withSocialApi, jsonOk } from '@/server/social/api-helpers';
import { getRankingBoard, upsertRankingSnapshot, validateRankingProfile } from '@/server/social/ranking-service';
import { SocialError } from '@/server/social/errors';
import type { RankingQuery } from '@/types/ranking';
import { RANKING_CATEGORY_IDS } from '@/types/ranking';

/** GET /api/social/ranking?categoryId=&page=&pageSize=&lineageFilter=&bossId= */
export async function GET(req: Request): Promise<Response> {
  return withSocialApi(req, { auth: true, rateKey: 'ranking-get', rateLimit: 120 }, async ({ db, playerId }) => {
    const url = new URL(req.url);
    const categoryId = url.searchParams.get('categoryId') ?? 'general';
    if (!(RANKING_CATEGORY_IDS as readonly string[]).includes(categoryId)) {
      throw new SocialError('VALIDATION', 'categoryId inválido.');
    }
    const query: RankingQuery = {
      categoryId: categoryId as RankingQuery['categoryId'],
      page: Number(url.searchParams.get('page') ?? 0) || 0,
      pageSize: Number(url.searchParams.get('pageSize') ?? 100) || 100,
      lineageFilter: (url.searchParams.get('lineageFilter') as RankingQuery['lineageFilter']) || 'all',
      bossId: url.searchParams.get('bossId'),
    };
    const board = await getRankingBoard(db, query, playerId);
    return jsonOk({ board });
  });
}

/** POST /api/social/ranking — submit snapshot do jogador autenticado. */
export async function POST(req: Request): Promise<Response> {
  return withSocialApi(
    req,
    { auth: true, rateKey: 'ranking-submit', rateLimit: 30, rateWindowMs: 60_000 },
    async ({ db, playerId }) => {
      if (!playerId) throw new SocialError('UNAUTHORIZED', 'Auth necessária.', 401);
      const body = await req.json().catch(() => null);
      const profile = validateRankingProfile(body?.profile ?? body, playerId);
      await upsertRankingSnapshot(db, profile);
      console.info('[social.ranking] snapshot upsert', { playerId, level: profile.playerLevel });
      return jsonOk({ saved: true });
    },
  );
}
