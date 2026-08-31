'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { VerificationActionState } from '@/app/auth/verify-email/actions';

export function VerifyEmailForm({
  email,
  verifyAction,
  resendAction,
}: {
  email: string;
  verifyAction: (
    previousState: VerificationActionState,
    formData: FormData,
  ) => Promise<VerificationActionState>;
  resendAction: (
    previousState: VerificationActionState,
    formData: FormData,
  ) => Promise<VerificationActionState>;
}) {
  const [verifyState, verifyFormAction, isVerifyPending] = useActionState(verifyAction, null);
  const [resendState, resendFormAction, isResendPending] = useActionState(resendAction, null);
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-eyebrow">NARUTO WORLD IDLE</p>
        <h1 id="auth-title" className="auth-title">
          Confirmar email
        </h1>
        <p className="auth-subtitle">
          Digite o código de 6 dígitos enviado para <strong>{email || 'seu email'}</strong>.
        </p>
        <form action={verifyFormAction} className="auth-form">
          <input type="hidden" name="email" value={email} />
          <label className="auth-field">
            <span>Código de verificação</span>
            <input
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
            />
          </label>
          {verifyState?.error ? (
            <p className="auth-error" role="alert">
              {verifyState.error}
            </p>
          ) : null}
          <button className="auth-submit" type="submit" disabled={isVerifyPending}>
            {isVerifyPending ? 'Confirmando…' : 'Confirmar email'}
          </button>
        </form>
        <form action={resendFormAction} className="auth-form">
          <input type="hidden" name="email" value={email} />
          {resendState?.error ? (
            <p className="auth-error" role="alert">
              {resendState.error}
            </p>
          ) : null}
          {resendState?.message ? <p className="auth-success">{resendState.message}</p> : null}
          <button className="auth-submit" type="submit" disabled={isResendPending}>
            {isResendPending ? 'Enviando…' : 'Reenviar código'}
          </button>
        </form>
        <p className="auth-switch">
          <Link href="/auth/sign-in">Voltar para entrar</Link>
        </p>
      </section>
    </main>
  );
}
