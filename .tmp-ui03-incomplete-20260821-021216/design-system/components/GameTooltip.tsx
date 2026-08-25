import type { ReactNode } from 'react';
import type { AiwRarityId } from '@/ui/design-system/tokens';
import { AIW_RARITY } from '@/ui/design-system/tokens';

export interface GameTooltipProps {
  children: ReactNode;
  title: string;
  description?: string;
  metadata?: string;
  shortcut?: string;
  rarity?: AiwRarityId;
  placement?: 'top';
  className?: string;
}

export function GameTooltip({
  children,
  title,
  description,
  metadata,
  shortcut,
  rarity,
  placement = 'top',
  className = '',
}: GameTooltipProps) {
  const rarityLabel = rarity ? AIW_RARITY[rarity].label : null;

  return (
    <span className={['aiw-tooltip-wrap', className].filter(Boolean).join(' ')}>
      {children}
      <span className={`aiw-tooltip aiw-tooltip--${placement}`} role="tooltip">
        <p className="aiw-tooltip__title">{title}</p>
        {description ? <p className="aiw-tooltip__desc">{description}</p> : null}
        {rarityLabel ? (
          <p className="aiw-tooltip__meta" style={{ color: `var(--aiw-rarity-${rarity!.toLowerCase()})` }}>
            {rarity} · {rarityLabel}
          </p>
        ) : null}
        {metadata ? <p className="aiw-tooltip__meta">{metadata}</p> : null}
        {shortcut ? <p className="aiw-tooltip__shortcut">{shortcut}</p> : null}
      </span>
    </span>
  );
}
