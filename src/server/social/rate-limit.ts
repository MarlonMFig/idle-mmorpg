import { SocialError } from '@/server/social/errors';

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
