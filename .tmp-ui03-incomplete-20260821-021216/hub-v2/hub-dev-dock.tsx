'use client';

import { useState } from 'react';
import { isDevMode } from '@/config/devConfig';
import { DevModeBadge } from '@/ui/hud/dev-mode-badge';
import { OfflineDevSimulator } from '@/ui/offline';

/**
 * Groups DEV-only tools so they don't compete with the game HUD.
 */
export function HubDevDock() {
  const [open, setOpen] = useState(false);
  if (!isDevMode()) return null;

  return (
    <div className={`hub-dev${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="hub-dev__toggle"
        aria-expanded={open}
        aria-controls="hub-dev-panel"
        onClick={() => setOpen((v) => !v)}
      >
        DEV
      </button>
      {open ? (
        <div id="hub-dev-panel" className="hub-dev__panel" role="region" aria-label="Ferramentas DEV">
          <DevModeBadge />
          <OfflineDevSimulator />
          <p className="hub-dev__hint">F8 · Character Lab</p>
        </div>
      ) : null}
    </div>
  );
}
