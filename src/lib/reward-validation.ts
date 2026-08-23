import { getItem } from '@/data/items';
import type { RewardBundle, RewardItemEntry } from '@/types/reward';

export function validateRewardBundle(bundle: RewardBundle): string[] {
  const errors: string[] = [];

  const checkAmount = (label: string, value: number | undefined): void => {
    if (value == null) return;
    if (!Number.isFinite(value)) {
      errors.push(`${label}: não finito`);
      return;
    }
    if (!Number.isInteger(value) && value !== Math.floor(value)) {
      // floor later; still reject NaN/Inf already handled
    }
    if (value < 0) errors.push(`${label}: negativo`);
  };

  checkAmount('copper', bundle.copper);
  checkAmount('animeCoins', bundle.animeCoins);

  if (bundle.items) {
    for (const row of bundle.items) {
      if (!row.itemId?.trim()) {
        errors.push('item sem itemId');
        continue;
      }
      if (!getItem(row.itemId)) {
        errors.push(`itemId inválido: ${row.itemId}`);
      }
      checkAmount(`item ${row.itemId}`, row.quantity);
    }
  }

  return errors;
}

/** Junta entradas do mesmo itemId; remove qty ≤ 0. */
export function normalizeRewardBundle(bundle: RewardBundle): RewardBundle {
  const copper =
    bundle.copper != null && Number.isFinite(bundle.copper)
      ? Math.max(0, Math.floor(bundle.copper))
      : 0;
  const animeCoins =
    bundle.animeCoins != null && Number.isFinite(bundle.animeCoins)
      ? Math.max(0, Math.floor(bundle.animeCoins))
      : 0;

  const map = new Map<string, number>();
  for (const row of bundle.items ?? []) {
    if (!row.itemId) continue;
    if (!Number.isFinite(row.quantity)) continue;
    const q = Math.floor(row.quantity);
    if (q <= 0) continue;
    map.set(row.itemId, (map.get(row.itemId) ?? 0) + q);
  }
  const items: RewardItemEntry[] = [...map.entries()].map(([itemId, quantity]) => ({
    itemId,
    quantity,
  }));

  const out: RewardBundle = {};
  if (copper > 0) out.copper = copper;
  if (animeCoins > 0) out.animeCoins = animeCoins;
  if (items.length > 0) out.items = items;
  return out;
}

export function isEmptyRewardBundle(bundle: RewardBundle): boolean {
  return (
    (bundle.copper ?? 0) <= 0 &&
    (bundle.animeCoins ?? 0) <= 0 &&
    (bundle.items?.length ?? 0) === 0
  );
}
