import { SocialError } from '@/server/social/errors';
import type { SocialDb } from '@/server/db/client';
import { apiRateLimits } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

/** Rate limit em memória (por instância). Proteção básica. */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (cur.count >= opts.limit) {
    return { ok: false, retryAfterMs: cur.resetAt - now };
  }
  cur.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

export function assertRateLimit(key: string, opts: { limit: number; windowMs: number }): void {
  const r = rateLimit(key, opts);
  if (!r.ok) {
    throw new SocialError('RATE_LIMITED', 'Muitas requisições. Tente novamente.', 429);
  }
}

/** Shared limiter persisted in Postgres so all serverless instances cooperate. */
export async function assertDistributedRateLimit(
  db: SocialDb,
  key: string,
  opts: { limit: number; windowMs: number },
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(apiRateLimits)
      .where(eq(apiRateLimits.key, key))
      .for('update')
      .limit(1);
    const current = rows[0];
    if (!current) {
      await tx.insert(apiRateLimits).values({
        key,
        windowStartedAt: now,
        requestCount: 1,
      });
      return;
    }

    const elapsed = now.getTime() - current.windowStartedAt.getTime();
    if (elapsed >= opts.windowMs) {
      await tx
        .update(apiRateLimits)
        .set({ windowStartedAt: now, requestCount: 1 })
        .where(eq(apiRateLimits.key, key));
      return;
    }
    if (current.requestCount >= opts.limit) {
      throw new SocialError('RATE_LIMITED', 'Muitas requisições. Tente novamente.', 429);
    }
    await tx
      .update(apiRateLimits)
      .set({ requestCount: current.requestCount + 1 })
      .where(eq(apiRateLimits.key, key));
  });
}
