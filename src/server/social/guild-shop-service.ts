/**
 * Item 45 — Guild Shop backend (Postgres / Drizzle).
 * The transaction debits copper and adds the item to the authenticated cloud
 * save. The client mirrors that result for immediate UI feedback.
 * Limits keyed by playerId + offerId + cycleId (NOT guildId).
 */

import { and, eq, sql } from 'drizzle-orm';
import { getGuildShopOffer, listGuildShopOffers } from '@/data/guild-shop';
import type { SocialDb } from '@/server/db/client';
import {
  guildMembers,
  guildShopPurchases,
  guildShopTransactions,
  guilds,
  playerSaves,
} from '@/server/db/schema';
import { SocialError } from '@/server/social/errors';
import { findGuildIdByPlayer } from '@/server/social/guild-service';
import {
  attemptResetCycleIdServer,
  getServerDailyCycleId,
  getServerWeeklyCycleId,
} from '@/server/social/server-time';
import type {
  GuildShopAuthorizeResult,
  GuildShopCatalogEntry,
  GuildShopOffer,
  GuildShopPurchaseLimitReset,
} from '@/types/guild-shop';

type Tx = Parameters<Parameters<SocialDb['transaction']>[0]>[0];
type DbOrTx = SocialDb | Tx;

export function cycleIdForGuildShopOffer(
  resetType: GuildShopPurchaseLimitReset,
  daily = getServerDailyCycleId(),
  weekly = getServerWeeklyCycleId(),
): string {
  if (resetType === 'none') return '';
  return attemptResetCycleIdServer(resetType, daily, weekly);
}

async function assertMembership(db: DbOrTx, guildId: string, playerId: string): Promise<void> {
  const rows = await db
    .select({ playerId: guildMembers.playerId })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.playerId, playerId)))
    .limit(1);
  if (!rows[0]) {
    throw new SocialError('NOT_MEMBER', 'Você não é membro desta Guild.', 403);
  }
}

async function loadGuildLevel(db: DbOrTx, guildId: string): Promise<number> {
  const rows = await db
    .select({ level: guilds.level })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1);
  if (!rows[0]) throw new SocialError('NOT_FOUND', 'Guild não encontrada.', 404);
  return rows[0].level;
}

async function getBought(
  db: DbOrTx,
  playerId: string,
  offerId: string,
  cycleId: string,
): Promise<number> {
  const rows = await db
    .select({ bought: guildShopPurchases.bought })
    .from(guildShopPurchases)
    .where(
      and(
        eq(guildShopPurchases.playerId, playerId),
        eq(guildShopPurchases.offerId, offerId),
        eq(guildShopPurchases.cycleId, cycleId),
      ),
    )
    .limit(1);
  return rows[0]?.bought ?? 0;
}

function entitlementFields(offer: GuildShopOffer, transactionId: string) {
  return {
    transactionId,
    offerId: offer.id,
    itemId: offer.itemId,
    quantity: offer.quantityPerPurchase,
    currency: offer.currency,
    price: offer.price,
  };
}

function buildEntry(
  offer: GuildShopOffer,
  guildLevel: number,
  bought: number,
  copperBalance: number,
): GuildShopCatalogEntry {
  const cycleId = cycleIdForGuildShopOffer(offer.resetType);
  const unlocked = guildLevel >= offer.guildLevelRequirement;
  const limit = offer.purchaseLimit;
  const remaining = limit == null ? null : Math.max(0, limit - bought);
  return {
    offer,
    guildLevel,
    unlocked,
    bought,
    remaining,
    cycleId,
    canAfford: copperBalance >= offer.price,
  };
}

export async function listCatalog(
  db: SocialDb,
  playerId: string,
  copperBalance: number,
): Promise<{
  ok: boolean;
  reason?: string;
  guildId: string | null;
  guildLevel: number;
  entries: GuildShopCatalogEntry[];
}> {
  const guildId = await findGuildIdByPlayer(db, playerId);
  if (!guildId) {
    return {
      ok: false,
      reason: 'Sem Guild.',
      guildId: null,
      guildLevel: 0,
      entries: [],
    };
  }

  const guildLevel = await loadGuildLevel(db, guildId);
  const offers = listGuildShopOffers();
  const entries: GuildShopCatalogEntry[] = [];
  for (const offer of offers) {
    const cycleId = cycleIdForGuildShopOffer(offer.resetType);
    const bought = await getBought(db, playerId, offer.id, cycleId);
    entries.push(buildEntry(offer, guildLevel, bought, copperBalance));
  }

  return { ok: true, guildId, guildLevel, entries };
}

export async function getPurchaseCount(
  db: SocialDb,
  playerId: string,
  offerId: string,
): Promise<{ bought: number; cycleId: string; limit: number | null }> {
  const offer = getGuildShopOffer(offerId);
  if (!offer) {
    return { bought: 0, cycleId: '', limit: null };
  }
  const cycleId = cycleIdForGuildShopOffer(offer.resetType);
  const bought = await getBought(db, playerId, offerId, cycleId);
  return { bought, cycleId, limit: offer.purchaseLimit ?? null };
}

export async function authorizePurchase(
  db: SocialDb,
  input: {
    playerId: string;
    offerId: string;
    transactionId: string;
  },
): Promise<GuildShopAuthorizeResult> {
  const { playerId, offerId, transactionId } = input;
  if (!transactionId.trim()) {
    return { ok: false, reason: 'transactionId obrigatório.' };
  }
  if (!offerId.trim()) {
    return { ok: false, reason: 'offerId inválido.' };
  }

  const offer = getGuildShopOffer(offerId);
  if (!offer) {
    return { ok: false, reason: 'Oferta inexistente.' };
  }

  const cycleId = cycleIdForGuildShopOffer(offer.resetType);
  const fields = entitlementFields(offer, transactionId);

  const existing = await db
    .select()
    .from(guildShopTransactions)
    .where(eq(guildShopTransactions.transactionId, transactionId))
    .limit(1);
  if (existing[0]) {
    if (existing[0].playerId !== playerId) {
      return { ok: false, reason: 'transactionId de outro jogador.' };
    }
    return {
      ok: true,
      alreadyProcessed: true,
      transactionId,
      offerId: existing[0].offerId,
      itemId: offer.itemId,
      quantity: existing[0].quantity,
      currency: offer.currency,
      price: existing[0].price,
    };
  }

  const guildId = await findGuildIdByPlayer(db, playerId);
  if (!guildId) {
    return { ok: false, reason: 'Sem Guild.' };
  }

  try {
    await db.transaction(async (tx) => {
      await assertMembership(tx, guildId, playerId);
      const guildLevel = await loadGuildLevel(tx, guildId);
      if (guildLevel < offer.guildLevelRequirement) {
        throw new SocialError(
          'FORBIDDEN',
          `Guild Level insuficiente (requer ${offer.guildLevelRequirement}).`,
          403,
        );
      }

      const again = await tx
        .select()
        .from(guildShopTransactions)
        .where(eq(guildShopTransactions.transactionId, transactionId))
        .limit(1);
      if (again[0]) {
        throw new SocialError('CONFLICT', 'ALREADY_PROCESSED', 409);
      }

      const bought = await getBought(tx, playerId, offer.id, cycleId);
      if (offer.purchaseLimit != null && bought >= offer.purchaseLimit) {
        throw new SocialError('FORBIDDEN', 'Limite de compra atingido.', 403);
      }

      if (offer.currency !== 'copper') {
        throw new SocialError('VALIDATION', 'Moeda da oferta não suportada.', 400);
      }
      const saveRows = await tx
        .select()
        .from(playerSaves)
        .where(eq(playerSaves.playerId, playerId))
        .for('update')
        .limit(1);
      const save = saveRows[0];
      if (!save || !save.payload || typeof save.payload !== 'object') {
        if (process.env.NODE_ENV === 'production') {
          throw new SocialError('CONFLICT', 'Save em nuvem obrigatório para comprar.', 409);
        }
      } else {
        const payload = save.payload as Record<string, unknown>;
        const inventory =
          payload.inventory && typeof payload.inventory === 'object'
            ? (payload.inventory as Record<string, unknown>)
            : {};
        const rawSlots = Array.isArray(inventory.slots) ? inventory.slots : [];
        const slots = rawSlots
          .filter((slot) => slot === null || (typeof slot === 'object' && slot !== null))
          .map((slot) => {
            if (!slot) return null;
            const row = slot as Record<string, unknown>;
            return {
              itemId: typeof row.itemId === 'string' ? row.itemId : '',
              quantity:
                typeof row.quantity === 'number' && Number.isFinite(row.quantity)
                  ? Math.max(0, Math.floor(row.quantity))
                  : 0,
            };
          });
        let copper = 0;
        for (const slot of slots) {
          if (slot?.itemId === 'item-copper-coin') copper += slot.quantity;
        }
        if (copper < offer.price) {
          throw new SocialError('FORBIDDEN', 'Copper insuficiente.', 403);
        }

        let remainingPrice = offer.price;
        for (const slot of slots) {
          if (slot?.itemId !== 'item-copper-coin' || remainingPrice <= 0) continue;
          const removed = Math.min(slot.quantity, remainingPrice);
          slot.quantity -= removed;
          remainingPrice -= removed;
        }
        const nextSlots = slots.map((slot) => (slot && slot.quantity > 0 ? slot : null));
        const existingItem = nextSlots.find((slot) => slot?.itemId === offer.itemId);
        if (existingItem) {
          existingItem.quantity += offer.quantityPerPurchase;
        } else {
          nextSlots.push({ itemId: offer.itemId, quantity: offer.quantityPerPurchase });
        }
        const updatedAt = new Date();
        await tx
          .update(playerSaves)
          .set({
            payload: {
              ...payload,
              inventory: { ...inventory, slots: nextSlots },
            },
            updatedAt,
          })
          .where(eq(playerSaves.playerId, playerId));
      }

      await tx.insert(guildShopTransactions).values({
        transactionId,
        playerId,
        offerId: offer.id,
        cycleId,
        price: offer.price,
        quantity: offer.quantityPerPurchase,
      });

      await tx
        .insert(guildShopPurchases)
        .values({
          playerId,
          offerId: offer.id,
          cycleId,
          bought: 1,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            guildShopPurchases.playerId,
            guildShopPurchases.offerId,
            guildShopPurchases.cycleId,
          ],
          set: {
            bought: sql`${guildShopPurchases.bought} + 1`,
            updatedAt: new Date(),
          },
        });
    });
  } catch (err) {
    if (err instanceof SocialError) {
      if (err.message === 'ALREADY_PROCESSED') {
        return { ok: true, alreadyProcessed: true, ...fields };
      }
      return { ok: false, reason: err.message };
    }
    // Unique violation on transaction_id (concurrent same id)
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate|primary key/i.test(msg)) {
      const row = await db
        .select()
        .from(guildShopTransactions)
        .where(eq(guildShopTransactions.transactionId, transactionId))
        .limit(1);
      if (row[0]?.playerId === playerId) {
        return { ok: true, alreadyProcessed: true, ...fields };
      }
    }
    throw err;
  }

  return { ok: true, alreadyProcessed: false, serverApplied: true, ...fields };
}

/** DEV — zera limites do player (todas as ofertas ou uma). */
export async function resetPurchaseLimit(
  db: SocialDb,
  playerId: string,
  offerId?: string,
): Promise<void> {
  if (offerId) {
    await db
      .delete(guildShopPurchases)
      .where(
        and(eq(guildShopPurchases.playerId, playerId), eq(guildShopPurchases.offerId, offerId)),
      );
    return;
  }
  await db.delete(guildShopPurchases).where(eq(guildShopPurchases.playerId, playerId));
}
