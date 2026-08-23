'use client';

import { useEffect } from 'react';
import { useStore } from '@/hooks/use-store';
import { forgeStore } from '@/stores/forge-store';
import { ForgeTab } from '@/ui/inventory/inventory-panel';
import { MgrWindow } from '@/ui/mgr';

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
    <MgrWindow
      title="Forja"
      lede="Eleve as estrelas dos seus personagens"
      pill="Aprimoramento"
      icon="⚒"
      size="lg"
      ariaLabel="Forja de personagens"
      onClose={() => forgeStore.close()}
    >
      <ForgeTab />
    </MgrWindow>
  );
}
