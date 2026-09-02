import { NextResponse } from 'next/server';
import { mapAuthErrorMessage } from '@/lib/auth/auth-errors';
import { usernameToAuthEmail, validateUsername } from '@/lib/auth/username-credential';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const usernameError = validateUsername(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 422 });
  }
  if (!password) {
    return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 422 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToAuthEmail(username),
    password,
  });
  if (error) {
    return NextResponse.json(
      { error: mapAuthErrorMessage(error.message, 'Usuário ou senha inválidos.') },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, user: data.user }, { status: 200 });
}
