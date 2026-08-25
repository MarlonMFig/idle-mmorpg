import type { ReactNode } from 'react';
import { GameCard } from '@/ui/design-system/components/GameCard';
import { RarityFrame } from '@/ui/design-system/components/RarityFrame';
import { NotificationBadge } from '@/ui/design-system/components/NotificationBadge';
import type { AiwRarityId } from '@/ui/design-system/tokens';

export interface ItemCardProps {
  icon?: ReactNode;
  quantity?: number;
  rarity: AiwRarityId;
  selected?: boolean;
  locked?: boolean;
  lockReason?: string;
  isNew?: boolean;
  label?: string;
  onClick?: () => void;
}

export function ItemCard({
  icon,
  quantity,
  rarity,
  selected,
  locked,
  lockReason,
  isNew,
  label,
  onClick,
}: ItemCardProps) {
  return (
    <GameCard
      className="aiw-item-card"
      selected={selected}
      locked={locked}
      lockReason={lockReason}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !locked ? 0 : undefined}
      aria-label={label}
    >
      <RarityFrame rarity={rarity} className="aiw-item-card__frame">
        <div className="aiw-item-card__icon">{icon}</div>
      </RarityFrame>
      {quantity !== undefined ? <span className="aiw-item-card__qty aiw-nums">{quantity}</span> : null}
      {isNew ? (
        <span className="aiw-item-card__new">
          <NotificationBadge variant="new" />
        </span>
      ) : null}
    </GameCard>
  );
}
