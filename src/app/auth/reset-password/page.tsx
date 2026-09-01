import type { Metadata } from 'next';
import { PasswordResetForm } from '@/components/auth/password-reset-form';
import { resetPassword } from './actions';

export const metadata: Metadata = {
  title: 'Nova senha | Naruto World Idle',
};

export default function ResetPasswordPage() {
  return <PasswordResetForm action={resetPassword} />;
}
