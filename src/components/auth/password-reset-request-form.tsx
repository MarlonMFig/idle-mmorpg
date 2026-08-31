'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { PasswordActionState } from '@/app/auth/forgot-password/actions';

export function PasswordResetRequestForm({
  action,
}: {
  action: (previousState: PasswordActionState, formData: FormData) => Promise<PasswordActionState>;
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-eyebrow">NARUTO WORLD IDLE</p>
        <h1 id="auth-title" className="auth-title">
          Recuperar senha
        </h1>
        <p className="auth-subtitle">Enviaremos um link seguro para redefinir sua senha.</p>
        <form action={formAction} className="auth-form">
          <label className="auth-field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required />
          </label>
          {state?.error ? (
            <p className="auth-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state?.message ? <p className="auth-success">{state.message}</p> : null}
          <button className="auth-submit" type="submit" disabled={isPending}>
            {isPending ? 'Enviando…' : 'Enviar instruções'}
          </button>
        </form>
        <p className="auth-switch">
          <Link href="/auth/sign-in">Voltar para entrar</Link>
        </p>
      </section>
    </main>
  );
}
