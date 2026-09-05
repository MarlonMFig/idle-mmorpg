'use client';

import Link from 'next/link';
import { useActionState, useEffect } from 'react';

export type AuthActionState = { error?: string; message?: string; success?: boolean } | null;
type AuthAction = (previousState: AuthActionState, formData: FormData) => Promise<AuthActionState>;

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up';
  action: AuthAction;
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const isSignUp = mode === 'sign-up';
  const [state, formAction, isPending] = useActionState(action, null);

  useEffect(() => {
    if (state?.success) {
      window.location.assign('/');
    }
  }, [state?.success]);

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-eyebrow">NARUTO WORLD IDLE</p>
        <h1 id="auth-title" className="auth-title">
          {isSignUp ? 'Criar conta' : 'Entrar na conta'}
        </h1>
        <p className="auth-subtitle">
          {isSignUp
            ? 'Escolha um nome de usuário para salvar sua jornada shinobi.'
            : 'Continue sua jornada shinobi.'}
        </p>

        <form action={formAction} className="auth-form">
          <label className="auth-field">
            <span>Nome de usuário</span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              required
              placeholder="seu_usuario"
            />
          </label>

          <label className="auth-field">
            <span>Senha</span>
            <input
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              minLength={8}
              required
              placeholder="Mínimo de 8 caracteres"
            />
          </label>

          {isSignUp ? (
            <label className="auth-field">
              <span>Confirmar senha</span>
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="Repita sua senha"
              />
            </label>
          ) : null}

          {state?.error ? (
            <p className="auth-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state?.message ? <p className="auth-success">{state.message}</p> : null}

          <button className="auth-submit" type="submit" disabled={isPending}>
            {isPending ? 'Aguarde…' : isSignUp ? 'Criar conta' : 'Entrar'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? 'Já possui uma conta?' : 'Ainda não possui uma conta?'}{' '}
          <Link href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'}>
            {isSignUp ? 'Entrar' : 'Criar conta'}
          </Link>
        </p>
      </section>
    </main>
  );
}
