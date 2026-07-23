'use client';

import type { ReactNode } from 'react';

export interface HudPanelProps {
  title: string;
  badge?: string;
  ariaLabel: string;
  className?: string;
  onClose?: () => void;
  children: ReactNode;
}

/**
 * Chrome compartilhado dos painéis da HUD (inventário, missões, vilas…).
 */
export function HudPanel({
  title,
  badge,
  ariaLabel,
  className = '',
  onClose,
  children,
}: HudPanelProps) {
  return (
    <section className={`hud-panel ${className}`.trim()} aria-label={ariaLabel}>
      <header className="hud-panel__head">
        <h2 className="hud-panel__title">{title}</h2>
        <div className="hud-panel__head-actions">
          {badge ? <span className="hud-panel__badge">{badge}</span> : null}
          {onClose ? (
            <button
              type="button"
              className="hud-panel__icon-btn"
              onClick={onClose}
              aria-label={`Fechar ${title.toLowerCase()}`}
            >
              ×
            </button>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export interface HudPanelCollapsedProps {
  label: string;
  ariaLabel: string;
  className?: string;
  onOpen: () => void;
}

export function HudPanelCollapsed({
  label,
  ariaLabel,
  className = '',
  onOpen,
}: HudPanelCollapsedProps) {
  return (
    <button
      type="button"
      className={`hud-panel hud-panel--collapsed ${className}`.trim()}
      onClick={onOpen}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
