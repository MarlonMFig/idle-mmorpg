import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/components/auth/verify-email-form';
import { resendVerificationEmail, verifyEmail } from './actions';

export const metadata: Metadata = {
  title: 'Confirmar email | Naruto World Idle',
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === 'string' ? params.email : '';
  return (
    <VerifyEmailForm
      email={email}
      verifyAction={verifyEmail}
      resendAction={resendVerificationEmail}
    />
  );
}
