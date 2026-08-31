import type { Metadata } from 'next';
import { PasswordResetRequestForm } from '@/components/auth/password-reset-request-form';
import { requestPasswordReset } from './actions';

export const metadata: Metadata = {
  title: 'Recuperar senha | Naruto World Idle',
};

export default function ForgotPasswordPage() {
  return <PasswordResetRequestForm action={requestPasswordReset} />;
}
