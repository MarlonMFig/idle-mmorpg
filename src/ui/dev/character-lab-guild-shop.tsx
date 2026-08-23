'use client';

import { isDevMode } from '@/config/devConfig';
import { listGuildShopOffers } from '@/data/guild-shop';
import { useStore } from '@/hooks/use-store';
import { guildShopStore } from '@/stores/guild-shop-store';
import { guildStore } from '@/stores/guild-store';
import { useEffect } from 'react';

export function CharacterLabGuildShopDebug() {
  const tick = useStore(guildShopStore, (s) => s.tick);
  const guildId = useStore(guildStore, (s) => s.guildId);
  const entries = useStore(guildShopStore, (s) => s.entries);
  const lastResult = useStore(guildShopStore, (s) => s.lastResult);

  useEffect(() => {
    if (guildId) void guildShopStore.refresh();
  }, [guildId, tick]);

  if (!isDevMode()) return null;

  const offers = listGuildShopOffers();
  const first = offers[0];

  return (
    <div className="character-lab__subpanel">
      <h3>Guild Shop Debug</h3>
      <p className="character-lab__hint">Provider: {guildShopStore.getProviderId()}</p>
      <p className="character-lab__hint">Guild: {guildId ?? '—'}</p>
      <p className="character-lab__hint">
        Entries: {entries.length} · Last: {lastResult ?? '—'}
      </p>
      <div className="character-lab__row">
        <button type="button" onClick={() => void guildShopStore.refresh()}>
          Refresh catalog
        </button>
        <button
          type="button"
          disabled={!first}
          onClick={() => first && void guildShopStore.buy(first.id)}
        >
          Buy first offer
        </button>
        <button type="button" onClick={() => void guildShopStore.resetPurchaseLimit()}>
          Reset limits
        </button>
        <button type="button" onClick={() => void guildShopStore.setMockGuildLevel(1)}>
          Mock guild Lv1
        </button>
        <button type="button" onClick={() => void guildShopStore.setMockGuildLevel(99)}>
          Mock guild Lv99
        </button>
        <button type="button" onClick={() => void guildShopStore.setMockGuildLevel(null)}>
          Clear mock level
        </button>
      </div>
    </div>
  );
}
