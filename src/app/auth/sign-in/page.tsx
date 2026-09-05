import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { isLocalGameplayRuntime } from '@/lib/auth/local-runtime';
import { redirect } from 'next/navigation';
import { signInWithUsername } from './actions';

export const metadata: Metadata = {
  title: 'Entrar | Naruto World Idle',
};

export default function SignInPage() {
  if (isLocalGameplayRuntime()) {
    redirect('/');
  }
  return <AuthForm mode="sign-in" action={signInWithUsername} />;
}
