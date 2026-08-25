'use client';

import {
  GameTooltip,
  NotificationBadge,
} from '@/ui/design-system';
import { HubSystemIcon } from '@/ui/hud/hub-v2/hub-system-icon';
import { activateHubSystem } from '@/ui/hud/hub-v2/hub-nav-actions';
import {
  HUB_SYSTEM_LABELS,
  HUB_SYSTEM_TOOLTIPS,
  type HubSystemId,
} from '@/ui/hud/hub-v2/hub-system-map';

export interface HubNavButtonProps {
  systemId: HubSystemId;
  active?: boolean;
  badge?: number | 'claim' | 'new' | 'attention' | null;
  showLabel?: boolean;
  prominent?: boolean;
  className?: string;
}

export function HubNavButton({
  systemId,
  active = false,
  badge = null,
  showLabel = true,
  prominent = false,
  className = '',
}: HubNavButtonProps) {
  const tip = HUB_SYSTEM_TOOLTIPS[systemId];
  const label = HUB_SYSTEM_LABELS[systemId];

  return (
    <GameTooltip
      title={tip.title}
      description={tip.description}
      shortcut={tip.shortcut}
      className="hub-nav__tip"
    >
      <button
        type="button"
        className={[
          'hub-nav__btn',
          showLabel ? 'hub-nav__btn--labeled' : '',
          prominent ? 'hub-nav__btn--map' : '',
          active ? 'is-active' : '',
          badge ? 'has-aura' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={label}
        aria-pressed={active}
        onClick={() => activateHubSystem(systemId)}
      >
        <span className="hub-nav__icon" aria-hidden>
          <HubSystemIcon systemId={systemId} size="xl" />
          {badge != null && badge !== 0 ? (
            <span className="hub-nav__badge">
              {typeof badge === 'number' ? (
                <NotificationBadge count={badge} />
              ) : (
                <NotificationBadge variant={badge} />
              )}
            </span>
          ) : null}
        </span>
        {showLabel ? <span className="hub-nav__label">{label}</span> : null}
      </button>
    </GameTooltip>
  );
}
