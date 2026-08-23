'use client';

import { useEffect, useMemo } from 'react';
import { getItem } from '@/data/items';
import { useStore } from '@/hooks/use-store';
import { economyService } from '@/lib/economy-service';
import { guildShopStore } from '@/stores/guild-shop-store';
import type { Guild } from '@/types/guild';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

/** UI mecânica mínima — visual definitivo depois. */
export function GuildShopTab({ guild }: { guild: Guild }) {
  const tick = useStore(guildShopStore, (s) => s.tick);
  const busyOfferId = useStore(guildShopStore, (s) => s.busyOfferId);
  const copper = economyService.getBalance('copper');

  useEffect(() => {
    void guildShopStore.refresh();
  }, [guild.id, tick]);

  const entries = useMemo(() => {
    void tick;
    return guildShopStore.getEntries();
  }, [tick, guild.id]);

  const guildLevel = useMemo(() => {
    void tick;
    return guildShopStore.getSnapshot().guildLevel || guild.level;
  }, [tick, guild.level]);

  return (
    <div className="guild-win__shop-tab">
      <h3>Loja da Guild</h3>
      <p className="guild-win__hint">
        Guild Lv {guildLevel} · Copper: {fmt(copper)} · Sem Guild Coin
      </p>
      <ul className="guild-win__apps">
        {entries.length === 0 ? (
          <li className="guild-win__empty">Nenhuma oferta (ou sem Guild).</li>
        ) : (
          entries.map((entry) => {
            const { offer } = entry;
            const name = getItem(offer.itemId)?.name ?? offer.itemId;
            const busy = busyOfferId === offer.id;
            const limitReached = entry.remaining != null && entry.remaining <= 0;
            const noCopper = !entry.canAfford;
            let label = 'COMPRAR';
            let disabled = busy || Boolean(guildShopStore.getSnapshot().busyOfferId);
            if (!entry.unlocked) {
              label = `Bloqueado (Guild Lv ${offer.guildLevelRequirement})`;
              disabled = true;
            } else if (limitReached) {
              label = 'Limite atingido';
              disabled = true;
            } else if (noCopper) {
              label = 'Sem Copper';
              disabled = true;
            } else if (busy) {
              label = '…';
            }

            return (
              <li key={offer.id}>
                <div>
                  <strong>{name}</strong> ×{offer.quantityPerPurchase}
                  <br />
                  {fmt(offer.price)} Copper · Guild Lv {offer.guildLevelRequirement}
                  {entry.remaining != null
                    ? ` · Restante: ${entry.remaining}/${offer.purchaseLimit}`
                    : ''}
                  {offer.provisionalPrice ? ' · preço provisional' : ''}
                </div>
                <button
                  type="button"
                  className="guild-win__btn-green"
                  disabled={disabled}
                  onClick={() => void guildShopStore.buy(offer.id)}
                >
                  {label}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
