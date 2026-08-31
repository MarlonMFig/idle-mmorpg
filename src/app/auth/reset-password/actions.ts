'use server';

import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export type PasswordActionState = { error?: string; message?: string } | null;

export async function resetPassword(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const tokenValue = formData.get('token');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');
  const token = typeof tokenValue === 'string' ? tokenValue.trim() : '';

  if (!token) return { error: 'Link de recuperação inválido ou expirado.' };
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  }
  if (password !== confirmPassword) {
    return { error: 'As senhas não coincidem.' };
  }

  const { error } = await auth.resetPassword({ newPassword: password, token });
  if (error) {
    return { error: error.message || 'Não foi possível redefinir a senha.' };
  }
  redirect('/auth/sign-in?reset=1');
}
