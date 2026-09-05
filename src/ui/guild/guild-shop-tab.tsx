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
    <div className="guild-win__feature">
      <div className="guild-win__feature-hero">
        <div>
          <p className="guild-win__feature-eyebrow">Economia da guild</p>
          <h3>Loja da Guild</h3>
          <p className="guild-win__hint">Ofertas por nível · pagamento em Copper</p>
        </div>
        <div className="guild-win__wallet-chip">
          <span>Guild Lv {guildLevel}</span>
          <strong>{fmt(copper)} Copper</strong>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="guild-win__empty">Nenhuma oferta disponível.</p>
      ) : (
        <ul className="guild-win__shop-grid">
          {entries.map((entry) => {
            const { offer } = entry;
            const name = getItem(offer.itemId)?.name ?? offer.itemId;
            const busy = busyOfferId === offer.id;
            const limitReached = entry.remaining != null && entry.remaining <= 0;
            const noCopper = !entry.canAfford;
            let label = 'Comprar';
            let disabled = busy || Boolean(guildShopStore.getSnapshot().busyOfferId);
            if (!entry.unlocked) {
              label = `Lv ${offer.guildLevelRequirement}`;
              disabled = true;
            } else if (limitReached) {
              label = 'Limite';
              disabled = true;
            } else if (noCopper) {
              label = 'Sem Copper';
              disabled = true;
            } else if (busy) {
              label = '…';
            }

            return (
              <li
                key={offer.id}
                className={`guild-win__shop-card${!entry.unlocked ? ' is-locked' : ''}`}
              >
                <div className="guild-win__shop-card-top">
                  <strong>{name}</strong>
                  <span>×{offer.quantityPerPurchase}</span>
                </div>
                <p className="guild-win__shop-price">{fmt(offer.price)} Copper</p>
                <p className="guild-win__shop-meta">
                  Guild Lv {offer.guildLevelRequirement}
                  {entry.remaining != null
                    ? ` · ${entry.remaining}/${offer.purchaseLimit} restantes`
                    : ''}
                  {offer.provisionalPrice ? ' · preço provisório' : ''}
                </p>
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
          })}
        </ul>
      )}
    </div>
  );
}
