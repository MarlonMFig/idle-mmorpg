import { getSocialDb } from '@/server/db/client';
import { authenticatePlayer, readAuthHeaders } from '@/server/social/auth';
import { socialErrorResponse, SocialError } from '@/server/social/errors';
import { assertRateLimit } from '@/server/social/rate-limit';
import { hasDatabaseUrl } from '@/server/db/client';

export async function withSocialApi(
  req: Request,
  opts: {
    auth?: boolean;
    rateKey?: string;
    rateLimit?: number;
    rateWindowMs?: number;
  },
  handler: (ctx: {
    db: Awaited<ReturnType<typeof getSocialDb>>;
    playerId: string | null;
    nickname: string | null;
  }) => Promise<Response>,
): Promise<Response> {
  try {
    if (process.env.NODE_ENV === 'production' && !hasDatabaseUrl()) {
      throw new SocialError('UNAVAILABLE', 'Backend social não configurado.', 503);
    }

    if (opts.rateKey) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      assertRateLimit(`${opts.rateKey}:${ip}`, {
        limit: opts.rateLimit ?? 60,
        windowMs: opts.rateWindowMs ?? 60_000,
      });
    }

    const db = await getSocialDb();
    let playerId: string | null = null;
    let nickname: string | null = null;

    if (opts.auth !== false) {
      const headers = readAuthHeaders(req);
      const auth = await authenticatePlayer(db, headers.playerId, headers.token);
      playerId = auth.playerId;
      nickname = auth.nickname;
      if (opts.rateKey) {
        assertRateLimit(`${opts.rateKey}:player:${playerId}`, {
          limit: opts.rateLimit ?? 60,
          windowMs: opts.rateWindowMs ?? 60_000,
        });
      }
    }

    return await handler({ db, playerId, nickname });
  } catch (err) {
    return socialErrorResponse(err);
  }
}

/** Aceita objetos tipados (sem index signature) — payloads de API social. */
export function jsonOk<T extends object>(data: T, status = 200): Response {
  return Response.json({ ok: true, ...data }, { status });
}
