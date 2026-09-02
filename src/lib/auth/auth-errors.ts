const CONNECTIVITY =
  'Não foi possível conectar ao Supabase. Confira NEXT_PUBLIC_SUPABASE_URL no .env.local (Project Settings → API) e reinicie o `npm run dev`.';

export function mapAuthErrorMessage(message: string | undefined, fallback: string): string {
  const msg = message?.trim() || fallback;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network|getaddrinfo/i.test(msg)) {
    return CONNECTIVITY;
  }
  if (/invalid login credentials|invalid email or password/i.test(msg)) {
    return 'Usuário ou senha inválidos.';
  }
  if (/already registered|already exists|duplicate/i.test(msg)) {
    return 'Este nome de usuário já está em uso.';
  }
  if (/rate limit|too many requests|429/i.test(msg)) {
    return 'Muitas tentativas de cadastro. Aguarde alguns minutos ou desative "Confirm email" no Supabase (Authentication → Providers → Email).';
  }
  return msg;
}
