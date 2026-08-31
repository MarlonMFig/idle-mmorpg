import { SignJWT } from 'jose';
import { withSocialApi, jsonOk } from '@/server/social/api-helpers';
import { SocialError } from '@/server/social/errors';

const TOKEN_TTL_SECONDS = 60;

export async function GET(req: Request): Promise<Response> {
  return withSocialApi(
    req,
    { auth: true, rateKey: 'multiplayer-token', rateLimit: 30, rateWindowMs: 60_000 },
    async ({ playerId, nickname }) => {
      const secret = process.env.MULTIPLAYER_AUTH_SECRET;
      if (!secret || secret.length < 32) {
        throw new SocialError('UNAVAILABLE', 'Multiplayer não configurado.', 503);
      }
      if (!playerId) throw new SocialError('UNAUTHORIZED', 'Autenticação necessária.', 401);

      const token = await new SignJWT({
        playerId,
        nickname: nickname?.trim().slice(0, 24) || 'Shinobi',
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(playerId)
        .setIssuedAt()
        .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
        .sign(new TextEncoder().encode(secret));

      return jsonOk({ token, expiresIn: TOKEN_TTL_SECONDS, playerId });
    },
  );
}
