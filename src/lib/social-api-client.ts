export class SocialApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function socialFetch<T>(
  path: string,
  init?: RequestInit & { nickname?: string },
): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  const res = await fetch(path, { ...init, headers, credentials: 'include' });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    code?: string;
    error?: string;
  } & T;
  if (!res.ok || json.ok === false) {
    throw new SocialApiError(
      json.code || 'INTERNAL',
      json.error || 'Falha na API social.',
      res.status,
    );
  }
  return json as T;
}
