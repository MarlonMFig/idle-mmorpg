import { and, eq } from 'drizzle-orm';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import type { SocialDb } from '@/server/db/client';
import { playerSaves, serverEconomyEvents } from '@/server/db/schema';
import type { BossReward } from '@/types/boss';
import type { CloudSavePayload } from '@/server/social/save-service';
import { SocialError } from '@/server/social/errors';

type Tx = Parameters<Parameters<SocialDb['transaction']>[0]>[0];
type DbOrTx = SocialDb | Tx;

export interface ServerRewardResult {
  alreadyApplied: boolean;
  serverApplied: boolean;
  rewards: BossReward[];
  payload?: CloudSavePayload;
}

function addItem(payload: Record<string, unknown>, itemId: string, amount: number): void {
  const inventory =
    payload.inventory && typeof payload.inventory === 'object' && !Array.isArray(payload.inventory)
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
  const existing = slots.find((slot) => slot?.itemId === itemId);
  if (existing) {
    existing.quantity += amount;
  } else {
    slots.push({ itemId, quantity: amount });
  }
  payload.inventory = { ...inventory, slots };
}

function applyRewards(payload: CloudSavePayload, rewards: readonly BossReward[]): CloudSavePayload {
  const next = JSON.parse(JSON.stringify(payload)) as CloudSavePayload & Record<string, unknown>;
  for (const reward of rewards) {
    const amount = Math.floor(reward.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (reward.type === 'copper') {
      addItem(next, SHOP_CURRENCY_ITEM_ID, amount);
      continue;
    }
    if (reward.type === 'item') {
      addItem(next, reward.id, amount);
      continue;
    }
    const gems =
      next.gems && typeof next.gems === 'object' && !Array.isArray(next.gems)
        ? (next.gems as Record<string, unknown>)
        : {};
    const current =
      typeof gems.balance === 'number' && Number.isFinite(gems.balance)
        ? Math.max(0, Math.floor(gems.balance))
        : 0;
    next.gems = { ...gems, balance: current + amount };
  }
  return next;
}

export async function grantServerRewards(
  db: DbOrTx,
  input: {
    eventId: string;
    playerId: string;
    source: string;
    rewards: readonly BossReward[];
  },
): Promise<ServerRewardResult> {
  const existingEvent = await db
    .select({ rewardsJson: serverEconomyEvents.rewardsJson })
    .from(serverEconomyEvents)
    .where(
      and(
        eq(serverEconomyEvents.eventId, input.eventId),
        eq(serverEconomyEvents.playerId, input.playerId),
      ),
    )
    .limit(1);
  if (existingEvent[0]) {
    const saveRows = await db
      .select({ payload: playerSaves.payload })
      .from(playerSaves)
      .where(eq(playerSaves.playerId, input.playerId))
      .limit(1);
    return {
      alreadyApplied: true,
      serverApplied: Boolean(saveRows[0]),
      rewards: (existingEvent[0].rewardsJson as BossReward[]) ?? [],
      payload: saveRows[0]?.payload as CloudSavePayload | undefined,
    };
  }

  const saveRows = await db
    .select({ payload: playerSaves.payload })
    .from(playerSaves)
    .where(eq(playerSaves.playerId, input.playerId))
    .for('update')
    .limit(1);
  const save = saveRows[0];
  if (!save) {
    if (process.env.NODE_ENV === 'production') {
      throw new SocialError(
        'CONFLICT',
        'Save em nuvem obrigatório para receber a recompensa.',
        409,
      );
    }
    await db.insert(serverEconomyEvents).values({
      eventId: input.eventId,
      playerId: input.playerId,
      source: input.source,
      rewardsJson: [...input.rewards],
    });
    return {
      alreadyApplied: false,
      serverApplied: false,
      rewards: [...input.rewards],
    };
  }

  const payload = save.payload as CloudSavePayload;
  const nextPayload = applyRewards(payload, input.rewards);
  const updatedAt = new Date();
  await db.insert(serverEconomyEvents).values({
    eventId: input.eventId,
    playerId: input.playerId,
    source: input.source,
    rewardsJson: [...input.rewards],
  });
  await db
    .update(playerSaves)
    .set({ payload: nextPayload, updatedAt })
    .where(eq(playerSaves.playerId, input.playerId));

  return {
    alreadyApplied: false,
    serverApplied: true,
    rewards: [...input.rewards],
    payload: nextPayload,
  };
}
