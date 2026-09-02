import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { signUpWithUsername } from './actions';

export const metadata: Metadata = {
  title: 'Criar conta | Naruto World Idle',
};

export default function SignUpPage() {
  return <AuthForm mode="sign-up" action={signUpWithUsername} />;
}
