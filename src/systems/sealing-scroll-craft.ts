import { SCROLL_CRAFT_PER_STEP } from '@/constants/capture-system';
import {
  SEALING_SCROLL_TIERS,
  type SealingScrollTierId,
} from '@/constants/sealing';
import { inventoryStore } from '@/stores/inventory-store';
import { consumeItem } from '@/systems/reward-application';
import { emitSystemMessage } from '@/lib/system-log';

const LADDER: Array<{ from: SealingScrollTierId; to: SealingScrollTierId }> = [
  { from: 'item-sealing-scroll', to: 'item-sealing-scroll-rare' },
  { from: 'item-sealing-scroll-rare', to: 'item-sealing-scroll-epic' },
  { from: 'item-sealing-scroll-epic', to: 'item-sealing-scroll-legendary' },
];

export function sealingScrollCraftTarget(fromId: string): SealingScrollTierId | null {
  return LADDER.find((step) => step.from === fromId)?.to ?? null;
}

export function craftSealingScroll(fromId: string): { ok: boolean; toId: string | null; error?: string } {
  const toId = sealingScrollCraftTarget(fromId);
  if (!toId) return { ok: false, toId: null, error: 'invalid-tier' };
  if (inventoryStore.countItem(fromId) < SCROLL_CRAFT_PER_STEP) {
    return { ok: false, toId, error: 'insufficient' };
  }
  if (!consumeItem(fromId, SCROLL_CRAFT_PER_STEP)) {
    return { ok: false, toId, error: 'insufficient' };
  }
  inventoryStore.addItem(toId, 1);
  const fromLabel = SEALING_SCROLL_TIERS.find((tier) => tier.itemId === fromId)?.label ?? fromId;
  const toLabel = SEALING_SCROLL_TIERS.find((tier) => tier.itemId === toId)?.label ?? toId;
  emitSystemMessage(`Craft: 7× ${fromLabel} → 1× ${toLabel}.`);
  return { ok: true, toId };
}
