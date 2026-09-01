const CONNECTIVITY =
  'Não foi possível conectar ao Supabase. Confira NEXT_PUBLIC_SUPABASE_URL no .env.local (Project Settings → API) e reinicie o `npm run dev`.';

export function mapAuthErrorMessage(message: string | undefined, fallback: string): string {
  const msg = message?.trim() || fallback;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network|getaddrinfo/i.test(msg)) {
    return CONNECTIVITY;
  }
  return msg;
}
