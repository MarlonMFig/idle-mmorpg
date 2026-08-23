import { isDevMode } from '@/config/devConfig';
import type { EconomyTransaction } from '@/types/economy';
import { ECONOMY_LEDGER_LIMIT } from '@/types/economy';

const ledger: EconomyTransaction[] = [];
const recentFingerprints = new Map<string, number>();

function newTxId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `eco-${crypto.randomUUID()}`;
  }
  return `eco-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ledger DEV — últimas N transações. */
export function pushEconomyTransaction(
  partial: Omit<EconomyTransaction, 'id' | 'timestamp'> & { timestamp?: number },
): EconomyTransaction {
  const tx: EconomyTransaction = {
    id: newTxId(),
    timestamp: partial.timestamp ?? Date.now(),
    currency: partial.currency,
    amount: Math.floor(Math.abs(partial.amount)),
    direction: partial.direction,
    source: partial.source,
    meta: partial.meta,
  };
  ledger.unshift(tx);
  if (ledger.length > ECONOMY_LEDGER_LIMIT) ledger.length = ECONOMY_LEDGER_LIMIT;

  if (isDevMode()) {
    const fp = `${tx.currency}|${tx.direction}|${tx.amount}|${tx.source}|${JSON.stringify(tx.meta ?? {})}`;
    const prev = recentFingerprints.get(fp);
    if (prev != null && tx.timestamp - prev < 80) {
      console.warn('[Economy] Transação repetida suspeita (DEV):', fp);
    }
    recentFingerprints.set(fp, tx.timestamp);
    if (recentFingerprints.size > 200) {
      const first = recentFingerprints.keys().next().value;
      if (first) recentFingerprints.delete(first);
    }
  }
  return tx;
}

export function listEconomyLedger(): readonly EconomyTransaction[] {
  return ledger;
}

export function clearEconomyLedger(): void {
  ledger.length = 0;
  recentFingerprints.clear();
}

export function summarizeEconomyLedger(): {
  copperIn: number;
  copperOut: number;
  animeIn: number;
  animeOut: number;
  bySource: Record<string, number>;
} {
  let copperIn = 0;
  let copperOut = 0;
  let animeIn = 0;
  let animeOut = 0;
  const bySource: Record<string, number> = {};
  for (const tx of ledger) {
    const signed = tx.direction === 'in' ? tx.amount : -tx.amount;
    bySource[tx.source] = (bySource[tx.source] ?? 0) + signed;
    if (tx.currency === 'copper') {
      if (tx.direction === 'in') copperIn += tx.amount;
      else copperOut += tx.amount;
    } else {
      if (tx.direction === 'in') animeIn += tx.amount;
      else animeOut += tx.amount;
    }
  }
  return { copperIn, copperOut, animeIn, animeOut, bySource };
}
