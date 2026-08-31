'use server';

import { auth } from '@/lib/auth/server';

export type PasswordActionState = { error?: string; message?: string } | null;

function readEmail(formData: FormData): string {
  const value = formData.get('email');
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export async function requestPasswordReset(
  _previousState: PasswordActionState,
  formData: FormData,
): Promise<PasswordActionState> {
  const email = readEmail(formData);
  if (!email || !email.includes('@')) {
    return { error: 'Informe um email válido.' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { error } = await auth.requestPasswordReset({
    email,
    redirectTo: `${appUrl.replace(/\/$/, '')}/auth/reset-password`,
  });
  if (error) {
    return { error: error.message || 'Não foi possível enviar o email de recuperação.' };
  }
  return { message: 'Se o email existir, enviaremos as instruções de recuperação.' };
}
