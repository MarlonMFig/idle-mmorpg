import { getSocialDb } from '@/server/db/client';
import { getAuthUser } from '@/lib/auth/server';
import { getOrCreateAuthPlayer } from '@/server/social/auth-player';
import { socialErrorResponse, SocialError } from '@/server/social/errors';
import { assertDistributedRateLimit } from '@/server/social/rate-limit';
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
    if (
      process.env.NODE_ENV === 'production' &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ) {
      const origin = req.headers.get('origin');
      const requestOrigin = new URL(req.url).origin;
      const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
      if (!origin || (origin !== requestOrigin && origin !== configuredOrigin)) {
        throw new SocialError('FORBIDDEN', 'Origem da requisição não permitida.', 403);
      }
    }

    if (process.env.NODE_ENV === 'production' && !hasDatabaseUrl()) {
      throw new SocialError('UNAVAILABLE', 'Backend social não configurado.', 503);
    }

    const db = await getSocialDb();
    if (opts.rateKey) {
      const forwarded =
        req.headers.get('x-vercel-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        req.headers.get('x-forwarded-for');
      const ip = (forwarded?.split(',')[0]?.trim() || 'local').slice(0, 128);
      await assertDistributedRateLimit(db, `${opts.rateKey}:${ip}`, {
        limit: opts.rateLimit ?? 60,
        windowMs: opts.rateWindowMs ?? 60_000,
      });
    }

    let playerId: string | null = null;
    let nickname: string | null = null;

    if (opts.auth !== false) {
      const user = await getAuthUser();
      if (!user) {
        throw new SocialError('UNAUTHORIZED', 'Autenticação necessária.', 401);
      }
      const player = await getOrCreateAuthPlayer(db, user);
      playerId = player.playerId;
      nickname = player.nickname;
      if (opts.rateKey) {
        await assertDistributedRateLimit(db, `${opts.rateKey}:player:${playerId}`, {
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
  return Response.json(
    { ok: true, ...data },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}
