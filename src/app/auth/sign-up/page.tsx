import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { isLocalGameplayRuntime } from '@/lib/auth/local-runtime';
import { redirect } from 'next/navigation';
import { signUpWithUsername } from './actions';

export const metadata: Metadata = {
  title: 'Criar conta | Naruto World Idle',
};

export default function SignUpPage() {
  if (isLocalGameplayRuntime()) {
    redirect('/');
  }
  return <AuthForm mode="sign-up" action={signUpWithUsername} />;
}
