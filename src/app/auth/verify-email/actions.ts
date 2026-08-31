'use server';

import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export type VerificationActionState = { error?: string; message?: string } | null;

function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function verifyEmail(
  _previousState: VerificationActionState,
  formData: FormData,
): Promise<VerificationActionState> {
  const email = readText(formData, 'email').toLowerCase();
  const otp = readText(formData, 'otp');
  if (!email || !email.includes('@') || !/^\d{6}$/.test(otp)) {
    return { error: 'Informe o email e o código de 6 dígitos.' };
  }

  const { error } = await auth.emailOtp.verifyEmail({ email, otp });
  if (error) {
    return { error: error.message || 'Código inválido ou expirado.' };
  }
  redirect('/auth/sign-in?verified=1');
}

export async function resendVerificationEmail(
  _previousState: VerificationActionState,
  formData: FormData,
): Promise<VerificationActionState> {
  const email = readText(formData, 'email').toLowerCase();
  if (!email || !email.includes('@')) {
    return { error: 'Informe um email válido.' };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { error } = await auth.sendVerificationEmail({
    email,
    callbackURL: `${appUrl.replace(/\/$/, '')}/`,
  });
  if (error) {
    return { error: error.message || 'Não foi possível reenviar o email.' };
  }
  return { message: 'Novo código enviado. Confira sua caixa de entrada.' };
}
