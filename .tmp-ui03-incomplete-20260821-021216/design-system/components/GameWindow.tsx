import type { ReactNode } from 'react';
import { IconClose } from '@/ui/design-system/icons';
import { GameIconButton } from '@/ui/design-system/components/GameIconButton';

export type GameWindowSize = 'small' | 'medium' | 'large' | 'wide' | 'fullscreen';

const SIZE_CLASS: Record<GameWindowSize, string> = {
  small: 'aiw-window--sm',
  medium: 'aiw-window--md',
  large: 'aiw-window--lg',
  wide: 'aiw-window--wide',
  fullscreen: 'aiw-window--fullscreen',
};

export interface GameWindowProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  size?: GameWindowSize;
  onClose?: () => void;
  headerActions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Soft aura glow (selected systems / boss / unlock). Use sparingly. */
  aura?: boolean;
  scrollBody?: boolean;
}

export function GameWindow({
  title,
  subtitle,
  icon,
  size = 'medium',
  onClose,
  headerActions,
  footer,
  children,
  className = '',
  aura = false,
  scrollBody = true,
}: GameWindowProps) {
  return (
    <section
      className={[
        'aiw-window',
        SIZE_CLASS[size],
        aura ? 'aiw-window--aura' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-label={title}
    >
      <div className="aiw-window__ornament-line" aria-hidden />
      <div className="aiw-window__corners" aria-hidden />
      <div className="aiw-window__corners-b" aria-hidden />

      <header className="aiw-window__header">
        {icon ? <div className="aiw-window__icon">{icon}</div> : null}
        <div className="aiw-window__titles">
          <h2 className="aiw-window__title">{title}</h2>
          {subtitle ? <p className="aiw-window__subtitle">{subtitle}</p> : null}
        </div>
        <div className="aiw-window__actions">
          {headerActions}
          {onClose ? (
            <GameIconButton aria-label="Fechar" onClick={onClose} variant="ghost" size="sm">
              <IconClose size="sm" />
            </GameIconButton>
          ) : null}
        </div>
      </header>

      <div className={`aiw-window__body${scrollBody ? ' aiw-scrollbox' : ''}`}>{children}</div>

      {footer ? <footer className="aiw-window__footer">{footer}</footer> : null}
    </section>
  );
}
