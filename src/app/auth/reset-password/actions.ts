'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type PasswordActionState = { error?: string; message?: string } | null;

export async function resetPassword(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  }
  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'Link de recuperação inválido ou expirado. Solicite um novo email.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message || 'Não foi possível redefinir a senha.' };
  }
  redirect('/auth/sign-in?reset=1');
}
