'use server';

import { auth } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export type AuthActionState = { error: string } | null;

export async function signInWithEmail(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailValue = formData.get('email');
  const passwordValue = formData.get('password');
  const email = typeof emailValue === 'string' ? emailValue.trim().toLowerCase() : '';
  const password = typeof passwordValue === 'string' ? passwordValue : '';

  if (!email || !email.includes('@') || !password) {
    return { error: 'Informe seu email e sua senha.' };
  }

  const { error } = await auth.signIn.email({ email, password });
  if (error) {
    return { error: error.message || 'Email ou senha inválidos.' };
  }

  redirect('/');
}
