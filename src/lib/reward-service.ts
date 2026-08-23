/**
 * Reward Service (Item 32) — porta única para recompensas econômicas/inventário.
 * Não decide drops, XP, Mastery ou progressão.
 */

import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { economyService } from '@/lib/economy-service';
import { emitRewardGranted } from '@/lib/reward-events';
import {
  isEmptyRewardBundle,
  normalizeRewardBundle,
  validateRewardBundle,
} from '@/lib/reward-validation';
import { flushSessionSaveNow } from '@/lib/session-save-flush';
import { inventoryStore } from '@/stores/inventory-store';
import type { EconomySource } from '@/types/economy';
import type {
  RewardBundle,
  RewardGrantRequest,
  RewardGrantResult,
  RewardItemEntry,
  RewardSource,
} from '@/types/reward';
import { REWARD_TX_HISTORY_LIMIT } from '@/types/reward';
import type { ItemGainSource } from '@/lib/item-events';

const appliedTx = new Set<string>();

function mapEconomySource(source: RewardSource): EconomySource {
  switch (source) {
    case 'hunt':
      return 'huntReward';
    case 'loot':
      return 'combatLoot';
    case 'mission':
      return 'missionReward';
    case 'dailyLogin':
      return 'dailyLogin';
    case 'achievement':
      return 'achievementReward';
    case 'boss':
      return 'bossReward';
    case 'guildBoss':
      return 'guildBossReward';
    case 'worldBoss':
      return 'worldBossReward';
    case 'offline':
      return 'offline';
    case 'shop':
      return 'shopPurchase';
    case 'sell':
      return 'shopSale';
    case 'dev':
      return 'dev';
    default:
      return 'unknown';
  }
}

function mapItemSource(source: RewardSource): ItemGainSource {
  switch (source) {
    case 'mission':
      return 'mission-reward';
    case 'dailyLogin':
      return 'daily-login';
    case 'achievement':
      return 'achievement-reward';
    case 'boss':
    case 'guildBoss':
    case 'worldBoss':
      return 'boss-reward';
    case 'loot':
    case 'hunt':
      return 'combat-loot';
    case 'dev':
      return 'dev';
    default:
      return 'unknown';
  }
}

function emptyGranted(): RewardBundle {
  return {};
}

function fail(errors: string[], transactionId?: string): RewardGrantResult {
  return {
    success: false,
    alreadyApplied: false,
    transactionId,
    granted: emptyGranted(),
    leftover: [],
    errors,
  };
}

/**
 * Persistência leve de transactionIds (session).
 * Cap REWARD_TX_HISTORY_LIMIT — claims recentes, não histórico eterno.
 */
export const rewardIdempotency = {
  hydrate(ids: readonly string[] | null | undefined): void {
    appliedTx.clear();
    if (!ids) return;
    for (const id of ids) {
      if (typeof id === 'string' && id.trim()) appliedTx.add(id);
    }
  },

  list(): string[] {
    return [...appliedTx].slice(-REWARD_TX_HISTORY_LIMIT);
  },

  has(transactionId: string): boolean {
    return appliedTx.has(transactionId);
  },

  remember(transactionId: string): void {
    appliedTx.add(transactionId);
    if (appliedTx.size > REWARD_TX_HISTORY_LIMIT) {
      const ordered = [...appliedTx];
      appliedTx.clear();
      for (const id of ordered.slice(-REWARD_TX_HISTORY_LIMIT)) appliedTx.add(id);
    }
    flushSessionSaveNow();
  },

  /** Testes. */
  clear(): void {
    appliedTx.clear();
  },
};

export const rewardService = {
  /**
   * Aplica RewardBundle de forma tipada.
   * Copper/Anime Coins → EconomyService. Itens → Inventory.
   */
  grant(request: RewardGrantRequest): RewardGrantResult {
    const transactionId = request.transactionId?.trim() || undefined;

    if (transactionId && rewardIdempotency.has(transactionId)) {
      return {
        success: true,
        alreadyApplied: true,
        transactionId,
        granted: emptyGranted(),
        leftover: [],
        errors: [],
      };
    }

    // Validar payload bruto (negaivos/NaN) antes de normalizar.
    const rawErrors = validateRewardBundle(request.rewards);
    if (rawErrors.length > 0) {
      return fail(rawErrors, transactionId);
    }

    const normalized = normalizeRewardBundle(request.rewards);
    if (isEmptyRewardBundle(normalized)) {
      if (transactionId) rewardIdempotency.remember(transactionId);
      return {
        success: true,
        alreadyApplied: false,
        transactionId,
        granted: emptyGranted(),
        leftover: [],
        errors: [],
      };
    }

    const validationErrors = validateRewardBundle(normalized);
    if (validationErrors.length > 0) {
      return fail(validationErrors, transactionId);
    }

    const allowPartial = request.allowPartial === true;
    const ecoSource = mapEconomySource(request.source);
    const itemSource = mapItemSource(request.source);
    const meta = {
      ...(request.meta ?? {}),
      ...(request.sourceId != null ? { sourceId: request.sourceId } : {}),
      ...(transactionId ? { transactionId } : {}),
    };

    const fitItems: RewardItemEntry[] = [...(normalized.items ?? [])];
    if ((normalized.copper ?? 0) > 0) {
      fitItems.push({ itemId: SHOP_CURRENCY_ITEM_ID, quantity: normalized.copper! });
    }

    if (!allowPartial && fitItems.length > 0 && !inventoryStore.canFit(fitItems)) {
      return fail(['Inventário sem espaço para o bundle completo'], transactionId);
    }

    const granted: RewardBundle = {};
    const leftover: RewardItemEntry[] = [];

    if ((normalized.copper ?? 0) > 0) {
      const got = economyService.grantCurrency('copper', normalized.copper!, ecoSource, meta);
      if (got > 0) granted.copper = got;
      if (got < normalized.copper! && !allowPartial) {
        // não deveria ocorrer após canFit; refund defensivo
        if (got > 0) economyService.spendCurrency('copper', got, ecoSource, { refund: true });
        return fail(['Falha ao conceder Copper'], transactionId);
      }
    }

    if ((normalized.animeCoins ?? 0) > 0) {
      const got = economyService.grantCurrency(
        'animeCoins',
        normalized.animeCoins!,
        ecoSource,
        meta,
      );
      if (got > 0) granted.animeCoins = got;
    }

    const grantedItems: RewardItemEntry[] = [];
    for (const row of normalized.items ?? []) {
      const remaining = inventoryStore.addItem(row.itemId, row.quantity, itemSource);
      const applied = row.quantity - remaining;
      if (applied > 0) grantedItems.push({ itemId: row.itemId, quantity: applied });
      if (remaining > 0) leftover.push({ itemId: row.itemId, quantity: remaining });
    }
    if (grantedItems.length > 0) granted.items = grantedItems;

    if (!allowPartial && leftover.length > 0) {
      // Rollback parcial
      if ((granted.copper ?? 0) > 0) {
        economyService.spendCurrency('copper', granted.copper!, ecoSource, { refund: true });
      }
      if ((granted.animeCoins ?? 0) > 0) {
        economyService.spendCurrency('animeCoins', granted.animeCoins!, ecoSource, {
          refund: true,
        });
      }
      for (const row of grantedItems) {
        inventoryStore.removeItem(row.itemId, row.quantity);
      }
      return fail(['Entrega parcial de itens — bundle revertido'], transactionId);
    }

    // Só marca idempotência quando bundle completo (sem leftover).
    // Offline/loot parciais podem retentar o restante sem bloquear.
    if (transactionId && leftover.length === 0) {
      rewardIdempotency.remember(transactionId);
    }

    emitRewardGranted({
      source: request.source,
      sourceId: request.sourceId,
      transactionId,
      rewards: {
        copper: granted.copper ?? 0,
        animeCoins: granted.animeCoins ?? 0,
        items: granted.items ?? [],
      },
    });

    return {
      success: true,
      alreadyApplied: false,
      transactionId,
      granted,
      leftover,
      errors: [],
    };
  },
};

/** Helpers de transactionId estáveis. */
export function missionRewardTxId(cycleId: string, missionId: string): string {
  return `mission:${cycleId}:${missionId}`;
}

export function dailyLoginRewardTxId(cycleId: string, day: number): string {
  return `daily:${cycleId}:${day}`;
}

export function achievementRewardTxId(achievementId: string): string {
  return `achievement:${achievementId}`;
}

export function bossRewardTxId(claimId: string): string {
  return `boss:${claimId}`;
}

export function guildBossRewardTxId(claimId: string): string {
  return `guildBoss:${claimId}`;
}

export function worldBossRewardTxId(claimId: string): string {
  return `worldBoss:${claimId}`;
}

export function offlineRewardTxId(offlineRewardId: string): string {
  return `offline:${offlineRewardId}`;
}
