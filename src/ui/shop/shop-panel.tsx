'use client';

import { useEffect, useMemo, useState } from 'react';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { getItem, RARITY_CSS } from '@/data/items';
import { formatCopper } from '@/data/shop';
import { useStore } from '@/hooks/use-store';
import { inventoryStore } from '@/stores/inventory-store';
import { shopStore, type ShopTabId } from '@/stores/shop-store';

const QTY_MIN = 1;
const QTY_MAX = 99;

/**
 * Mercado do hub (Kuro) — janela modal no estilo loja NPC:
 * título + saldo, abas Comprar/Vender, slider de quantidade e lista com preço.
 */
export function ShopPanel() {
  const isOpen = useStore(shopStore, (s) => s.isOpen);
  const tab = useStore(shopStore, (s) => s.tab);
  const lastResult = useStore(shopStore, (s) => s.lastResult);
  const invTick = useStore(inventoryStore, (s) => s.slots);
  const copper = useStore(inventoryStore, (s) =>
    s.slots.reduce((total, slot) => {
      if (!slot || slot.itemId !== SHOP_CURRENCY_ITEM_ID) return total;
      return total + slot.quantity;
    }, 0),
  );

  const [quantity, setQuantity] = useState(QTY_MIN);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        shopStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setQuantity(QTY_MIN);
  }, [isOpen, tab]);

  const sellable = useMemo(() => {
    void invTick;
    return shopStore.listSellable();
  }, [invTick]);

  if (!isOpen) return null;

  return (
    <div
      className="market-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) shopStore.setOpen(false);
      }}
    >
      <section
        className="market-win"
        aria-label="Loja do Kuro"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="market-win__titlebar">
          <h2 className="market-win__title">Loja do Kuro</h2>
          <div className="market-win__titlebar-right">
            <span className="market-win__balance" title="Moedas de Cobre">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="market-win__coin"
                src="/ui/items/copper-coin.png"
                alt=""
                width={20}
                height={20}
                draggable={false}
              />
              {formatCopper(copper)}
            </span>
            <button
              type="button"
              className="market-win__close"
              onClick={() => shopStore.setOpen(false)}
              aria-label="Fechar loja"
            >
              ×
            </button>
          </div>
        </header>

        <nav className="market-win__tabs" aria-label="Modo da loja">
          <TabButton id="buy" active={tab} label="Comprar" />
          <TabButton id="sell" active={tab} label="Vender" />
        </nav>

        <div className="market-win__qty">
          <div className="market-win__qty-head">
            <span>Quantidade</span>
            <strong>{quantity}</strong>
          </div>
          <input
            className="market-win__slider"
            type="range"
            min={QTY_MIN}
            max={QTY_MAX}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            aria-label="Quantidade"
          />
        </div>

        <div className="market-win__list-wrap">
          {tab === 'buy' ? (
            <ul className="market-win__list">
              {shopStore.listOffers().map((offer) => {
                const def = getItem(offer.itemId);
                const total = offer.price * quantity;
                const canAfford = copper >= total;
                return (
                  <li key={offer.id} className="market-win__row">
                    <div className="market-win__item">
                      {def?.iconSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="market-win__icon"
                          src={def.iconSrc}
                          alt=""
                          width={40}
                          height={40}
                          draggable={false}
                        />
                      ) : (
                        <span className="market-win__icon-fallback" />
                      )}
                      <div className="market-win__meta">
                        <p
                          className="market-win__name"
                          style={def ? { color: RARITY_CSS[def.rarity] } : undefined}
                        >
                          {offer.name}
                        </p>
                        <p className="market-win__desc">{offer.description}</p>
                      </div>
                    </div>
                    <div className="market-win__actions">
                      <span className="market-win__price">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/ui/items/copper-coin.png"
                          alt=""
                          width={16}
                          height={16}
                          draggable={false}
                        />
                        {formatCopper(total)}
                      </span>
                      <button
                        type="button"
                        className="market-win__btn"
                        disabled={!canAfford}
                        onClick={() => shopStore.buy(offer.id, quantity)}
                      >
                        Comprar
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="market-win__list">
              {sellable.length === 0 ? (
                <li className="market-win__empty">Nada para vender agora.</li>
              ) : (
                sellable.map((entry) => {
                  const def = getItem(entry.itemId);
                  const qty = Math.min(quantity, entry.quantity);
                  const total = entry.unitPrice * qty;
                  return (
                    <li key={entry.itemId} className="market-win__row">
                      <div className="market-win__item">
                        {def?.iconSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="market-win__icon"
                            src={def.iconSrc}
                            alt=""
                            width={40}
                            height={40}
                            draggable={false}
                          />
                        ) : (
                          <span className="market-win__icon-fallback" />
                        )}
                        <div className="market-win__meta">
                          <p
                            className="market-win__name"
                            style={def ? { color: RARITY_CSS[def.rarity] } : undefined}
                          >
                            {def?.name ?? entry.itemId}
                          </p>
                          <p className="market-win__desc">
                            Em estoque: {entry.quantity} · Unitário:{' '}
                            {formatCopper(entry.unitPrice)}
                          </p>
                        </div>
                      </div>
                      <div className="market-win__actions">
                        <span className="market-win__price market-win__price--sell">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/ui/items/copper-coin.png"
                            alt=""
                            width={16}
                            height={16}
                            draggable={false}
                          />
                          {formatCopper(total)}
                        </span>
                        <button
                          type="button"
                          className="market-win__btn market-win__btn--sell"
                          onClick={() => shopStore.sell(entry.itemId, qty)}
                        >
                          Vender
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>

        {lastResult ? <p className="market-win__feedback">{lastResult}</p> : null}
      </section>
    </div>
  );
}

/** Atalho colapsado no hub (abre a loja). */
export function ShopLauncher() {
  const isOpen = useStore(shopStore, (s) => s.isOpen);
  if (isOpen) return null;

  return (
    <button
      type="button"
      className="hud-panel hud-panel--collapsed hud-shop-collapsed"
      onClick={() => shopStore.setOpen(true)}
      aria-label="Abrir loja"
    >
      Loja (P)
    </button>
  );
}

function TabButton({
  id,
  active,
  label,
}: {
  id: ShopTabId;
  active: ShopTabId;
  label: string;
}) {
  const isActive = active === id;
  return (
    <button
      type="button"
      className={`market-win__tab${isActive ? ' is-active' : ''}`}
      aria-pressed={isActive}
      onClick={() => shopStore.setTab(id)}
    >
      {label}
    </button>
  );
}
