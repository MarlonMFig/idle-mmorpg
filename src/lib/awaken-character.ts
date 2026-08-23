import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { isDevMode } from '@/config/devConfig';
import { emitCharacterAwakened } from '@/lib/awakening-events';
import { isAwakeningRewardConfigured } from '@/lib/awakening-rewards';
import {
  clampAwakeningLevel,
  evaluateAwakening,
  getAwakeningReward,
  type AwakeningValidation,
} from '@/lib/character-awakening';
import { economyService } from '@/lib/economy-service';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import { attributesStore } from '@/stores/attributes-store';

const inFlight = new Set<string>();

function walletFromInventory() {
  return {
    copper: inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID),
    countItem: (itemId: string) => inventoryStore.countItem(itemId),
  };
}

export function canAwakenCharacter(instanceId: string): AwakeningValidation {
  const instance = teamStore.getCharacterInstance(instanceId);
  if (!instance) {
    return {
      eligible: false,
      available: false,
      maxed: false,
      nextLevel: null,
      requirement: null,
      missing: ['Character instance not found'],
      checks: [],
      copperCost: 0,
      itemCosts: [],
      fragmentCost: 0,
      fragmentItemId: null,
    };
  }
  const validation = evaluateAwakening(instance, walletFromInventory());
  if (!validation.eligible || !validation.nextLevel) return validation;
  if (!isDevMode()) {
    const reward = getAwakeningReward(validation.nextLevel, instance.characterId);
    if (!isAwakeningRewardConfigured(reward)) {
      return {
        ...validation,
        eligible: false,
        missing: [...validation.missing, 'Reward not configured'],
      };
    }
  }
  return validation;
}

export type AwakenCharacterResult =
  | {
      ok: true;
      instanceId: string;
      oldAwakening: number;
      newAwakening: number;
    }
  | {
      ok: false;
      eligible: false;
      missing: string[];
      inProgress?: boolean;
    };

function refund(rows: { itemId: string; quantity: number }[]): void {
  for (const row of rows) {
    if (row.quantity > 0) inventoryStore.addItem(row.itemId, row.quantity);
  }
}

/**
 * Transação atômica: valida → consome itens/cobre → awakeningLevel+1 → salva → evento.
 * Falha = nada consumido. Um clique = no máximo +1 nível.
 */
export function awakenCharacter(
  instanceId: string,
  expectedLevel?: number,
): AwakenCharacterResult {
  if (!instanceId) {
    return { ok: false, eligible: false, missing: ['Character instance not found'] };
  }
  if (inFlight.has(instanceId)) {
    return {
      ok: false,
      eligible: false,
      missing: ['Awakening already in progress'],
      inProgress: true,
    };
  }

  inFlight.add(instanceId);
  try {
    const instance = teamStore.getCharacterInstance(instanceId);
    if (!instance) {
      return { ok: false, eligible: false, missing: ['Character instance not found'] };
    }

    const current = clampAwakeningLevel(instance.awakeningLevel);
    if (expectedLevel != null && current !== expectedLevel) {
      return { ok: false, eligible: false, missing: ['Awakening already in progress'] };
    }

    const validation = evaluateAwakening(instance, walletFromInventory());
    if (!validation.eligible || validation.nextLevel == null) {
      return { ok: false, eligible: false, missing: validation.missing };
    }
    if (!isDevMode()) {
      const reward = getAwakeningReward(validation.nextLevel, instance.characterId);
      if (!isAwakeningRewardConfigured(reward)) {
        return { ok: false, eligible: false, missing: ['Reward not configured'] };
      }
    }

    const consumed: { itemId: string; quantity: number }[] = [];

    for (const row of validation.itemCosts) {
      if (!inventoryStore.removeItem(row.itemId, row.quantity)) {
        refund(consumed);
        return { ok: false, eligible: false, missing: [`Need ${row.quantity} ${row.itemId}`] };
      }
      consumed.push(row);
    }

    if (validation.fragmentCost > 0 && validation.fragmentItemId) {
      if (!inventoryStore.removeItem(validation.fragmentItemId, validation.fragmentCost)) {
        refund(consumed);
        return { ok: false, eligible: false, missing: [`Need ${validation.fragmentCost} Fragments`] };
      }
      consumed.push({ itemId: validation.fragmentItemId, quantity: validation.fragmentCost });
    }

    if (validation.copperCost > 0) {
      if (!economyService.spendCurrency('copper', validation.copperCost, 'awakening')) {
        refund(consumed);
        return { ok: false, eligible: false, missing: [`Need ${validation.copperCost} Copper`] };
      }
      consumed.push({ itemId: SHOP_CURRENCY_ITEM_ID, quantity: validation.copperCost });
    }

    const applied = teamStore.setCharacterAwakening(instanceId, validation.nextLevel);
    if (!applied) {
      refund(consumed);
      return { ok: false, eligible: false, missing: ['Failed to persist awakening'] };
    }
    if (teamStore.getActive()?.id === instanceId) {
      attributesStore.onActiveCharacterChanged(false);
    }

    emitCharacterAwakened({
      instanceId,
      oldAwakening: current,
      newAwakening: validation.nextLevel,
    });

    return {
      ok: true,
      instanceId,
      oldAwakening: current,
      newAwakening: validation.nextLevel,
    };
  } finally {
    inFlight.delete(instanceId);
  }
}
