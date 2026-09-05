'use server';

import { mapAuthErrorMessage } from '@/lib/auth/auth-errors';
import {
  usernameToAuthEmail,
  validateUsername,
} from '@/lib/auth/username-credential';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type AuthActionState = { error?: string; message?: string; success?: boolean } | null;

export async function signUpWithUsername(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const usernameValue = formData.get('username');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const username = typeof usernameValue === 'string' ? usernameValue : '';

  const usernameError = validateUsername(username);
  if (usernameError) {
    return { error: usernameError };
  }
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  }
  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem.' };
  }

  const displayUsername = username.trim();

  try {
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
      const msg = error.message || 'Não foi possível criar a conta.';
      if (/already registered|already exists|duplicate/i.test(msg)) {
        return { error: 'Este nome de usuário já está em uso.' };
      }
      return { error: mapAuthErrorMessage(msg, 'Não foi possível criar a conta.') };
    }

    if (!data.session) {
      return {
        error:
          'Conta criada, mas o login automático falhou. Tente entrar com seu usuário e senha.',
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: mapAuthErrorMessage(msg, 'Não foi possível criar a conta.') };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
