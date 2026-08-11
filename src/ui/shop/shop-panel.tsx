'use client';

import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { getItem, RARITY_CSS } from '@/data/items';
import { useStore } from '@/hooks/use-store';
import { inventoryStore } from '@/stores/inventory-store';
import { shopStore } from '@/stores/shop-store';
import { HudPanel, HudPanelCollapsed } from '@/ui/hud/hud-panel';

/**
 * Loja do hub — compra o Pergaminho de Selamento com moedas de cobre.
 */
export function ShopPanel() {
  const isOpen = useStore(shopStore, (s) => s.isOpen);
  const lastResult = useStore(shopStore, (s) => s.lastResult);
  const copper = useStore(inventoryStore, (s) =>
    s.slots.reduce((total, slot) => {
      if (!slot || slot.itemId !== SHOP_CURRENCY_ITEM_ID) return total;
      return total + slot.quantity;
    }, 0),
  );

  if (!isOpen) {
    return (
      <HudPanelCollapsed
        label="Loja (P)"
        ariaLabel="Abrir loja"
        className="hud-shop"
        onOpen={() => shopStore.setOpen(true)}
      />
    );
  }

  return (
    <HudPanel
      title="Loja"
      badge="P"
      ariaLabel="Loja"
      className="hud-shop"
      onClose={() => shopStore.setOpen(false)}
    >
      <p className="hud-shop__balance">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hud-shop__balance-icon"
          src="/ui/items/copper-coin.png"
          alt=""
          width={22}
          height={22}
          draggable={false}
        />
        Saldo: <strong>{copper}</strong> Moedas de Cobre
      </p>

      <ul className="hud-shop__list">
        {shopStore.listOffers().map((offer) => {
          const def = getItem(offer.itemId);
          return (
            <li key={offer.id} className="hud-shop__offer">
              <div className="hud-shop__offer-info">
                {def?.iconSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="hud-shop__offer-icon"
                    src={def.iconSrc}
                    alt=""
                    width={40}
                    height={40}
                    draggable={false}
                  />
                ) : null}
                <div className="hud-shop__offer-text">
                  <p
                    className="hud-shop__offer-name"
                    style={def ? { color: RARITY_CSS[def.rarity] } : undefined}
                  >
                    {offer.name}
                  </p>
                  <p className="hud-shop__offer-desc">{offer.description}</p>
                  <p className="hud-shop__offer-price">
                    {offer.price} {getItem(offer.currencyItemId)?.name ?? 'moedas'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="hud-shop__buy"
                onClick={() => shopStore.buy(offer.id, 1)}
              >
                Comprar
              </button>
            </li>
          );
        })}
      </ul>

      {lastResult ? <p className="hud-shop__feedback">{lastResult}</p> : null}
    </HudPanel>
  );
}
