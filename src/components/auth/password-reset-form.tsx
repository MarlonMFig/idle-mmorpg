'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { PasswordActionState } from '@/app/auth/reset-password/actions';

export function PasswordResetForm({
  token,
  action,
}: {
  token: string;
  action: (previousState: PasswordActionState, formData: FormData) => Promise<PasswordActionState>;
}) {
  const [state, formAction, isPending] = useActionState(action, null);
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-eyebrow">NARUTO WORLD IDLE</p>
        <h1 id="auth-title" className="auth-title">
          Nova senha
        </h1>
        <p className="auth-subtitle">Escolha uma nova senha para sua conta.</p>
        <form action={formAction} className="auth-form">
          <input type="hidden" name="token" value={token} />
          <label className="auth-field">
            <span>Nova senha</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="auth-field">
            <span>Confirmar senha</span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {state?.error ? (
            <p className="auth-error" role="alert">
              {state.error}
            </p>
          ) : null}
          <button className="auth-submit" type="submit" disabled={isPending}>
            {isPending ? 'Salvando…' : 'Redefinir senha'}
          </button>
        </form>
        <p className="auth-switch">
          <Link href="/auth/sign-in">Voltar para entrar</Link>
        </p>
      </section>
    </main>
  );
}
