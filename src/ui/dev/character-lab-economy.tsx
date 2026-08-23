'use client';

import { isDevMode } from '@/config/devConfig';
import { getOfferDisplayName, listShopOffers } from '@/data/shop';
import { useStore } from '@/hooks/use-store';
import {
  clearEconomyLedger,
  listEconomyLedger,
  summarizeEconomyLedger,
} from '@/lib/economy-ledger';
import { economyService } from '@/lib/economy-service';
import { validateShopEconomy } from '@/lib/economy-validation';
import { getDailyCycleId, getWeeklyCycleId } from '@/lib/mission-cycle';
import { shopStore } from '@/stores/shop-store';
import { useMemo, useState } from 'react';

/**
 * Economy Analyzer + Shop Debug (DEV only).
 */
export function CharacterLabEconomyDebug() {
  const purchases = useStore(shopStore, (s) => s.purchases);
  const forceEligible = useStore(shopStore, (s) => s.forceEligible);
  const [tick, setTick] = useState(0);

  const summary = useMemo(() => {
    void tick;
    return summarizeEconomyLedger();
  }, [tick, purchases]);

  const ledger = useMemo(() => {
    void tick;
    return listEconomyLedger().slice(0, 100);
  }, [tick, purchases]);

  const warnings = useMemo(() => validateShopEconomy(), []);

  const copperNet = summary.copperIn - summary.copperOut;
  const spanMs =
    ledger.length >= 2
      ? Math.max(1, ledger[0]!.timestamp - ledger[ledger.length - 1]!.timestamp)
      : 0;
  const copperPerHour =
    spanMs > 0 ? Math.round(((summary.copperIn - summary.copperOut) / spanMs) * 3_600_000) : 0;

  if (!isDevMode()) return null;

  const offers = listShopOffers();
  const topSources = Object.entries(summary.bySource)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 8);

  return (
    <div className="character-lab__subpanel">
      <h3>Economy / Shop Debug</h3>
      <p className="character-lab__hint">
        Copper: {economyService.getBalance('copper')} · AC:{' '}
        {economyService.getBalance('animeCoins')}
      </p>
      <p className="character-lab__hint">
        Cycle daily: {getDailyCycleId()} · weekly: {getWeeklyCycleId()}
      </p>
      <p className="character-lab__hint">
        Analyzer — in: {summary.copperIn} · out: {summary.copperOut} · net: {copperNet}
        {spanMs > 0 ? ` · ~${copperPerHour}/h (ledger window)` : ''}
      </p>
      <p className="character-lab__hint">
        Anime — in: {summary.animeIn} · out: {summary.animeOut}
      </p>
      {topSources.length > 0 ? (
        <ul className="character-lab__hint">
          {topSources.map(([src, n]) => (
            <li key={src}>
              {src}: {n > 0 ? '+' : ''}
              {n}
            </li>
          ))}
        </ul>
      ) : (
        <p className="character-lab__hint">Sem transações no ledger ainda.</p>
      )}

      <h4>SHOP DEBUG</h4>
      {warnings.length > 0 ? (
        <ul className="character-lab__hint">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="character-lab__hint">Catalog validator: OK · {offers.length} ofertas</p>
      )}
      <ul className="character-lab__hint">
        {offers.map((offer) => {
          const rem = shopStore.getRemainingLimit(offer.id);
          const elig = shopStore.isEligible(offer);
          return (
            <li key={offer.id}>
              {offer.id} · {getOfferDisplayName(offer)} · {offer.price} {offer.currency}
              {offer.provisionalPrice ? ' · provisório' : ''} · limit{' '}
              {offer.purchaseLimit ?? '∞'}/{offer.resetType} · bought{' '}
              {shopStore.getPurchased(offer.id)}
              {rem != null ? ` · rem ${rem}` : ''} ·{' '}
              {elig.ok ? 'eligible' : `blocked (${elig.reason})`}
            </li>
          );
        })}
      </ul>

      <h4>DEV CONTROLS</h4>
      <div className="character-lab__row">
        <button
          type="button"
          onClick={() => {
            economyService.grantCurrency('copper', 1000, 'dev');
            setTick((n) => n + 1);
          }}
        >
          Add Copper +1000
        </button>
        <button
          type="button"
          onClick={() => {
            economyService.spendCurrency('copper', 500, 'dev');
            setTick((n) => n + 1);
          }}
        >
          Remove Copper -500
        </button>
        <button
          type="button"
          onClick={() => {
            economyService.grantCurrency('animeCoins', 10, 'dev');
            setTick((n) => n + 1);
          }}
        >
          Add Anime Coins +10
        </button>
        <button
          type="button"
          onClick={() => {
            shopStore.devResetLimits();
            setTick((n) => n + 1);
          }}
        >
          Reset Shop Limits
        </button>
        <button
          type="button"
          onClick={() => {
            shopStore.setForceEligible(!forceEligible);
            setTick((n) => n + 1);
          }}
        >
          Force Eligibility: {forceEligible ? 'ON' : 'OFF'}
        </button>
        <button
          type="button"
          onClick={() => {
            clearEconomyLedger();
            setTick((n) => n + 1);
          }}
        >
          Clear Ledger
        </button>
        <button type="button" onClick={() => setTick((n) => n + 1)}>
          Refresh
        </button>
      </div>

      <h4>Economy Ledger (últimas {ledger.length})</h4>
      <ul className="character-lab__hint">
        {ledger.length === 0 ? (
          <li>—</li>
        ) : (
          ledger.map((tx) => (
            <li key={tx.id}>
              {tx.direction === 'in' ? '+' : '-'}
              {tx.amount} {tx.currency} — {tx.source}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
