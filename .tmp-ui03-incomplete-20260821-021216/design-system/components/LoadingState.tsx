export interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function LoadingState({
  title = 'Carregando…',
  description = 'Sincronizando o mundo interdimensional.',
  className = '',
}: LoadingStateProps) {
  return (
    <div className={['aiw-loading', className].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <div className="aiw-loading__orb" aria-hidden />
      <h3 className="aiw-loading__title">{title}</h3>
      {description ? <p className="aiw-loading__desc">{description}</p> : null}
    </div>
  );
}
