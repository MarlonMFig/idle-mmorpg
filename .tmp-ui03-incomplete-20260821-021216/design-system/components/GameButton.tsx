import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type GameButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

export interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

export function GameButton({
  variant = 'secondary',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: GameButtonProps) {
  return (
    <button
      type={type}
      className={['aiw-btn', `aiw-btn--${variant}`, className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="aiw-btn__spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}
