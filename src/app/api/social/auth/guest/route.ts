import { registerGuest } from '@/server/social/auth';
import { withSocialApi, jsonOk } from '@/server/social/api-helpers';
import { SocialError } from '@/server/social/errors';

/** POST /api/social/auth/guest — registra Guest Account (playerId + token). */
export async function POST(req: Request): Promise<Response> {
  return withSocialApi(req, { auth: false, rateKey: 'auth-guest', rateLimit: 20 }, async ({ db }) => {
    const body = (await req.json().catch(() => null)) as {
      nickname?: string;
      playerId?: string;
    } | null;
    if (!body?.nickname || typeof body.nickname !== 'string') {
      throw new SocialError('VALIDATION', 'nickname obrigatório.');
    }
    const result = await registerGuest(db, {
      nickname: body.nickname,
      playerId: typeof body.playerId === 'string' ? body.playerId : undefined,
    });
    console.info('[social.auth] guest registered', { playerId: result.playerId });
    return jsonOk(result, 201);
  });
}
