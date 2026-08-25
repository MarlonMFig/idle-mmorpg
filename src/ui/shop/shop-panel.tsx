'use client';

import { useEffect, useMemo, useState } from 'react';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { getItem, RARITY_CSS } from '@/data/items';
import {
  formatCopper,
  getOfferDisplayName,
} from '@/data/shop';
import { useStore } from '@/hooks/use-store';
import { economyService } from '@/lib/economy-service';
import { inventoryStore } from '@/stores/inventory-store';
import { gemStore } from '@/stores/gem-store';
import { shopStore, type ShopTabId } from '@/stores/shop-store';
import { MgrWindow } from '@/ui/mgr';
import type { ShopCategoryId } from '@/types/shop';
import { SHOP_CATEGORY_LABEL } from '@/types/shop';

const QTY_PRESETS = [1, 5, 10] as const;

/**
 * Mercado do hub — UI funcional (mecânicas Item 30).
 * Categorias + limites + Copper / Anime Coins.
 */
export function ShopPanel() {
  const isOpen = useStore(shopStore, (s) => s.isOpen);
  const tab = useStore(shopStore, (s) => s.tab);
  const category = useStore(shopStore, (s) => s.category);
  const lastResult = useStore(shopStore, (s) => s.lastResult);
  const purchases = useStore(shopStore, (s) => s.purchases);
  const invTick = useStore(inventoryStore, (s) => s.slots);
  const copper = useStore(inventoryStore, (s) =>
    s.slots.reduce((total, slot) => {
      if (!slot || slot.itemId !== SHOP_CURRENCY_ITEM_ID) return total;
      return total + slot.quantity;
    }, 0),
  );
  const animeCoins = useStore(gemStore, (s) => s.balance);

  const [quantity, setQuantity] = useState(1);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [selectedSellId, setSelectedSellId] = useState<string | null>(null);

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
    if (isOpen) {
      setQuantity(1);
      setSelectedOfferId(null);
      setSelectedSellId(null);
    }
  }, [isOpen, tab, category]);

  const sellable = useMemo(() => {
    void invTick;
    return shopStore.listSellable();
  }, [invTick]);

  const sellAllTotal = useMemo(
    () => sellable.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0),
    [sellable],
  );
  const sellAllQty = useMemo(
    () => sellable.reduce((sum, entry) => sum + entry.quantity, 0),
    [sellable],
  );

  const offers = useMemo(() => {
    void purchases;
    void invTick;
    return shopStore.listOffersCurrentCategory();
  }, [category, purchases, invTick]);

  if (!isOpen) return null;

  return (
    <MgrWindow
      title="Loja"
      lede="Mercado do hub — Copper e Anime Coins"
      pill={tab === 'buy' ? 'Comprar' : 'Vender'}
      icon="🏪"
      size="lg"
      tabs={[
        { id: 'buy', label: 'Comprar' },
        { id: 'sell', label: 'Vender' },
      ]}
      activeTab={tab}
      onTabChange={(id) => shopStore.setTab(id as ShopTabId)}
      onClose={() => shopStore.setOpen(false)}
      status={
        <>
          <span className="mgr-window__pill" title="Copper">
            {formatCopper(copper)} Cu
          </span>
          <span className="mgr-window__pill" title="Anime Coins">
            AC {formatCopper(animeCoins)}
          </span>
        </>
      }
    >
        {tab === 'buy' ? (
          <nav className="market-win__tabs market-win__tabs--cats" aria-label="Categorias">
            {(Object.keys(SHOP_CATEGORY_LABEL) as ShopCategoryId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`market-win__tab${category === id ? ' is-active' : ''}`}
                onClick={() => shopStore.setCategory(id)}
              >
                {SHOP_CATEGORY_LABEL[id]}
              </button>
            ))}
          </nav>
        ) : null}

        <div className="market-win__qty">
          <div className="market-win__qty-head">
            <span>Quantidade (pacotes)</span>
            <strong>{quantity}</strong>
          </div>
          <div className="market-win__qty-presets">
            {QTY_PRESETS.map((n) => (
              <button key={n} type="button" onClick={() => setQuantity(n)}>
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                if (tab === 'buy') {
                  const id = selectedOfferId ?? offers[0]?.id;
                  if (id) setQuantity(Math.max(1, shopStore.maxAffordablePacks(id)));
                } else {
                  const entry =
                    sellable.find((s) => s.itemId === selectedSellId) ?? sellable[0];
                  if (entry) setQuantity(entry.quantity);
                }
              }}
            >
              MAX
            </button>
          </div>
        </div>

        {tab === 'sell' && sellable.length > 0 ? (
          <div className="market-win__sell-all">
            <p className="market-win__sell-all-meta">
              Tudo: {sellAllQty} itens · {formatCopper(sellAllTotal)} Cu
            </p>
            <button
              type="button"
              className="market-win__btn market-win__btn--sell"
              onClick={() => {
                const rare = sellable.some((entry) => {
                  const def = getItem(entry.itemId);
                  return (
                    def?.rarity === 'epic' ||
                    def?.rarity === 'legendary' ||
                    def?.rarity === 'mythic'
                  );
                });
                if (
                  !window.confirm(
                    rare
                      ? `Vender todos os ${sellAllQty} itens vendáveis por ${formatCopper(sellAllTotal)} Cu? Inclui itens raros.`
                      : `Vender todos os ${sellAllQty} itens vendáveis por ${formatCopper(sellAllTotal)} Cu?`,
                  )
                ) {
                  return;
                }
                shopStore.sellAll();
              }}
            >
              Vender todos
            </button>
          </div>
        ) : null}

        <div className="market-win__list-wrap">
          {tab === 'buy' ? (
            <ul className="market-win__list">
              {offers.length === 0 ? (
                <li className="market-win__empty">Nenhuma oferta nesta categoria.</li>
              ) : (
                offers.map((offer) => {
                  const def = getItem(offer.itemId);
                  const total = offer.price * quantity;
                  const bal =
                    offer.currency === 'copper'
                      ? economyService.getBalance('copper')
                      : economyService.getBalance('animeCoins');
                  const canAfford = bal >= total;
                  const rem = shopStore.getRemainingLimit(offer.id);
                  const maxPacks = shopStore.maxAffordablePacks(offer.id);
                  return (
                    <li
                      key={offer.id}
                      className={`market-win__row${selectedOfferId === offer.id ? ' is-selected' : ''}`}
                      onClick={() => setSelectedOfferId(offer.id)}
                    >                      <div className="market-win__item">
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
                            {getOfferDisplayName(offer)}
                            {offer.provisionalPrice ? ' · provisório' : ''}
                          </p>
                          <p className="market-win__desc">
                            {offer.description ?? ''}
                            {rem != null ? ` · Limite: ${rem}` : ''}
                            {offer.quantityPerPurchase > 1
                              ? ` · ${offer.quantityPerPurchase}/pacote`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="market-win__actions">
                        <span className="market-win__price">
                          {offer.currency === 'copper' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src="/ui/items/copper-coin.png"
                              alt=""
                              width={16}
                              height={16}
                              draggable={false}
                            />
                          ) : (
                            <span>AC</span>
                          )}
                          {formatCopper(total)}
                        </span>
                        <button
                          type="button"
                          className="market-win__btn"
                          disabled={!canAfford || (rem != null && rem <= 0)}
                          title={!canAfford ? 'Saldo insuficiente' : undefined}
                          onClick={() => {
                            const packs = Math.min(quantity, Math.max(1, maxPacks));
                            if (offer.requireConfirm || offer.currency === 'animeCoins') {
                              if (
                                !window.confirm(
                                  `Gastar ${total} ${offer.currency === 'copper' ? 'Copper' : 'Anime Coins'} em ${getOfferDisplayName(offer)}?`,
                                )
                              ) {
                                return;
                              }
                            }
                            shopStore.buy(offer.id, packs);
                          }}
                        >
                          Comprar
                        </button>
                      </div>
                    </li>
                  );
                })
              )}
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
                  const rare =
                    def?.rarity === 'epic' ||
                    def?.rarity === 'legendary' ||
                    def?.rarity === 'mythic';
                  return (
                    <li
                      key={entry.itemId}
                      className={`market-win__row${selectedSellId === entry.itemId ? ' is-selected' : ''}`}
                      onClick={() => setSelectedSellId(entry.itemId)}
                    >                      <div className="market-win__item">
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
                            Estoque: {entry.quantity} · Unit: {formatCopper(entry.unitPrice)}
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
                          onClick={() => {
                            if (rare && !window.confirm(`Vender item raro ${def?.name}?`)) return;
                            shopStore.sell(entry.itemId, qty);
                          }}
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
    </MgrWindow>
  );
}

export function ShopLauncher() {
  const isOpen = useStore(shopStore, (s) => s.isOpen);
  if (isOpen) return null;

  return (
    <button
      type="button"
      className="hud-panel hud-panel--launcher hud-shop-launcher"
      onClick={() => shopStore.setOpen(true)}
      aria-label="Abrir loja"
    >
      Loja (P)
    </button>
  );
}
