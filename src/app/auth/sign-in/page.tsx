import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { signInWithEmail } from './actions';

export const metadata: Metadata = {
  title: 'Entrar | Naruto World Idle',
};

export default function SignInPage() {
  return <AuthForm mode="sign-in" action={signInWithEmail} />;
}
