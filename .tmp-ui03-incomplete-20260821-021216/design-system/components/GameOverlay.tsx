import type { ReactNode } from 'react';

export interface GameOverlayProps {
  children: ReactNode;
  open?: boolean;
  onBackdropClick?: () => void;
  className?: string;
  /** Accessible label for the dialog region. */
  'aria-label'?: string;
}

/** Standard modal/window backdrop — dims world without erasing it. */
export function GameOverlay({
  children,
  open = true,
  onBackdropClick,
  className = '',
  'aria-label': ariaLabel = 'Sobreposição',
}: GameOverlayProps) {
  if (!open) return null;

  return (
    <div
      className={['aiw-overlay', className].filter(Boolean).join(' ')}
      role="presentation"
      onClick={onBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
