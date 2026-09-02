import { NextResponse } from 'next/server';
import { mapAuthErrorMessage } from '@/lib/auth/auth-errors';
import {
  normalizeUsername,
  usernameToAuthEmail,
  validateUsername,
} from '@/lib/auth/username-credential';
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
  if (password.length < 8) {
    return NextResponse.json({ error: 'Senha inválida.' }, { status: 422 });
  }

  const displayUsername = username.trim();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: usernameToAuthEmail(username),
    password,
    options: {
      data: {
        username: displayUsername,
        name: displayUsername,
      },
    },
  });

  if (error) {
    const status = /already registered|already exists|duplicate/i.test(error.message)
      ? 409
      : 400;
    return NextResponse.json(
      { error: mapAuthErrorMessage(error.message, 'Não foi possível criar a conta.') },
      { status },
    );
  }

  return NextResponse.json(
    { ok: true, user: data.user, username: normalizeUsername(username) },
    { status: 200 },
  );
}
