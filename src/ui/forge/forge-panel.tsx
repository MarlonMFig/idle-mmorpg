'use client';

import { useEffect } from 'react';
import { useStore } from '@/hooks/use-store';
import { forgeStore } from '@/stores/forge-store';
import { HudPanel } from '@/ui/hud/hud-panel';
import { ForgeTab } from '@/ui/inventory/inventory-panel';

export function ForgePanel() {
  const isOpen = useStore(forgeStore, (state) => state.isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        forgeStore.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="hud-modal-layer hud-modal-layer--forge"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) forgeStore.close();
      }}
    >
      <HudPanel
        title="Forja"
        badge="F"
        ariaLabel="Forja de personagens"
        className="hud-forge"
        onClose={() => forgeStore.close()}
      >
        <div className="hud-forge__intro">
          <p className="hud-forge__eyebrow">Aprimoramento</p>
          <p className="hud-forge__title">Eleve as estrelas dos seus personagens</p>
        </div>
        <ForgeTab />
      </HudPanel>
    </div>
  );
}
