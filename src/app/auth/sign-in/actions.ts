'use server';

import { mapAuthErrorMessage } from '@/lib/auth/auth-errors';
import {
  normalizeUsername,
  usernameToAuthEmail,
  validateUsername,
} from '@/lib/auth/username-credential';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type AuthActionState = { error?: string; message?: string; success?: boolean } | null;

export async function signInWithUsername(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const usernameValue = formData.get('username');
  const passwordValue = formData.get('password');
  const username = typeof usernameValue === 'string' ? usernameValue : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';

  const usernameError = validateUsername(username);
  if (usernameError) {
    return { error: usernameError };
  }
  if (!password) {
    return { error: 'Informe sua senha.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToAuthEmail(username),
      password,
    });
    if (error) {
      return {
        error: mapAuthErrorMessage(error.message, 'Usuário ou senha inválidos.'),
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: mapAuthErrorMessage(msg, 'Falha ao entrar. Tente de novo.') };
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
