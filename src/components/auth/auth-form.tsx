'use client';

import Link from 'next/link';
import { useActionState } from 'react';

export type AuthActionState = { error: string } | null;
type AuthAction = (previousState: AuthActionState, formData: FormData) => Promise<AuthActionState>;

interface AuthFormProps {
  mode: 'sign-in' | 'sign-up';
  action: AuthAction;
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const isSignUp = mode === 'sign-up';
  const [state, formAction, isPending] = useActionState(action, null);

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-eyebrow">NARUTO WORLD IDLE</p>
        <h1 id="auth-title" className="auth-title">
          {isSignUp ? 'Criar conta' : 'Entrar na conta'}
        </h1>
        <p className="auth-subtitle">
          {isSignUp
            ? 'Crie sua conta para salvar sua jornada shinobi.'
            : 'Continue sua jornada shinobi.'}
        </p>

        <form action={formAction} className="auth-form">
          {isSignUp ? (
            <label className="auth-field">
              <span>Nome shinobi</span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={24}
                required
                placeholder="Seu nome"
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="voce@email.com"
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
