'use server';

import { mapAuthErrorMessage } from '@/lib/auth/auth-errors';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type AuthActionState = { error?: string; message?: string } | null;

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function signUpWithEmail(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const name = readText(formData, 'name');
  const email = readText(formData, 'email').toLowerCase();
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (name.length < 2 || name.length > 24) {
    return { error: 'Informe um nome entre 2 e 24 caracteres.' };
  }
  if (!email || !email.includes('@')) {
    return { error: 'Informe um email válido.' };
  }
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  }
  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem.' };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      return { error: mapAuthErrorMessage(error.message, 'Não foi possível criar a conta.') };
    }

    // Without email confirmation enabled, Supabase returns a session immediately.
    if (!data.session) {
      return {
        message: 'Conta criada. Se o email exigir confirmação, verifique sua caixa de entrada.',
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: mapAuthErrorMessage(msg, 'Não foi possível criar a conta.') };
  }

  redirect('/');
}
