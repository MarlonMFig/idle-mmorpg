import type { ReactNode } from 'react';

export type GamePanelVariant = 'default' | 'inset' | 'accent' | 'scroll';

export interface GamePanelProps {
  children: ReactNode;
  variant?: GamePanelVariant;
  className?: string;
  as?: 'div' | 'section' | 'aside';
}

export function GamePanel({
  children,
  variant = 'default',
  className = '',
  as: Tag = 'div',
}: GamePanelProps) {
  const variantClass =
    variant === 'default'
      ? ''
      : variant === 'inset'
        ? 'aiw-panel--inset'
        : variant === 'accent'
          ? 'aiw-panel--accent'
          : 'aiw-panel--scroll';

  return <Tag className={['aiw-panel', variantClass, className].filter(Boolean).join(' ')}>{children}</Tag>;
}
