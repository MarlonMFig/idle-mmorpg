export type SocialErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'NOT_MEMBER'
  | 'NO_ATTEMPTS'
  | 'BOSS_DEFEATED'
  | 'BOSS_LOCKED'
  | 'GUILD_FULL'
  | 'PERMISSION_DENIED'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'INTERNAL';

export class SocialError extends Error {
  readonly code: SocialErrorCode;
  readonly status: number;

  constructor(code: SocialErrorCode, message: string, status = 400) {
    super(message);
    this.name = 'SocialError';
    this.code = code;
    this.status = status;
  }
}

export function socialErrorResponse(err: unknown): Response {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  if (err instanceof SocialError) {
    return Response.json(
      { ok: false, code: err.code, error: err.message },
      { status: err.status, headers },
    );
  }
  console.error('[social]', err);
  return Response.json(
    { ok: false, code: 'INTERNAL', error: 'Erro interno.' },
    { status: 500, headers },
  );
}
