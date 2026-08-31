import type { Metadata } from 'next';
import { PasswordResetForm } from '@/components/auth/password-reset-form';
import { resetPassword } from './actions';

export const metadata: Metadata = {
  title: 'Nova senha | Naruto World Idle',
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <PasswordResetForm token={params.token || ''} action={resetPassword} />;
}
