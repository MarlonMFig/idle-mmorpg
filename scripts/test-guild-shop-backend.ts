/**
 * Item 45 — Guild Shop backend (PGlite) + local provider.
 * Offline/prod note: mode `unavailable` when production without DATABASE_URL.
 * Run: npx --yes tsx scripts/test-guild-shop-backend.ts
 */
import { eq } from 'drizzle-orm';
import {
  LocalGuildShopProvider,
  resetLocalGuildShopProvider,
} from '../src/lib/guild-shop-local-provider';
import { validateGuildShopCatalog } from '../src/lib/guild-shop-validation';
import { createTestSocialDb, resetSocialDbCache } from '../src/server/db/client';
import { guilds } from '../src/server/db/schema';
import { registerGuest } from '../src/server/social/auth';
import * as guildShop from '../src/server/social/guild-shop-service';
import * as guildsSvc from '../src/server/social/guild-service';
import { getLocalGuildProvider, resetLocalGuildProvider } from '../src/lib/guild-local-provider';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

async function setGuildLevel(
  db: Awaited<ReturnType<typeof createTestSocialDb>>['db'],
  guildId: string,
  level: number,
): Promise<void> {
  await db.update(guilds).set({ level, updatedAt: new Date() }).where(eq(guilds.id, guildId));
}

async function runBackendTests(): Promise<void> {
  resetSocialDbCache();
  const { db } = await createTestSocialDb();

  const warnings = validateGuildShopCatalog();
  const exploration = warnings.filter((w) => w.includes('EXPLORATION'));
  assert('catalog 0 EXPLORATION warnings', exploration.length === 0);

  const solo = await registerGuest(db, { nickname: 'Solo', playerId: 'gs-solo' });
  const noGuild = await guildShop.authorizePurchase(db, {
    playerId: solo.playerId,
    offerId: 'gshop-hp-potion',
    transactionId: 'tx-no-guild',
  });
  assert('no guild → blocked', noGuild.ok === false);

  const a = await registerGuest(db, { nickname: 'PlayerA', playerId: 'gs-a' });
  const helper = await registerGuest(db, { nickname: 'Helper', playerId: 'gs-helper' });
  const b = await registerGuest(db, { nickname: 'PlayerB', playerId: 'gs-b' });

  const guildA = await guildsSvc.createGuild(
    db,
    { name: 'Guild Alpha', tag: 'ALPH', joinMode: 'open' },
    { playerId: a.playerId, nickname: 'PlayerA', playerLevel: 50 },
  );
  await guildsSvc.joinGuild(db, guildA.id, {
    playerId: helper.playerId,
    nickname: 'Helper',
    playerLevel: 40,
  });

  // Level 1 guild — offer requiring Lv2 blocked
  await setGuildLevel(db, guildA.id, 1);
  const lowLv = await guildShop.authorizePurchase(db, {
    playerId: a.playerId,
    offerId: 'gshop-hp-concentrated', // req Lv2, daily limit 3
    transactionId: 'tx-low-lv',
  });
  assert('guild lv insufficient → blocked', lowLv.ok === false);

  // Level ok — authorize increments
  await setGuildLevel(db, guildA.id, 10);
  const buy1 = await guildShop.authorizePurchase(db, {
    playerId: a.playerId,
    offerId: 'gshop-hp-concentrated',
    transactionId: 'tx-buy-1',
  });
  assert('level ok authorize', buy1.ok === true && buy1.alreadyProcessed !== true);
  assert('entitlement fields', buy1.price === 130 && buy1.itemId === 'item-hp-potion-ultra');
  let count = await guildShop.getPurchaseCount(db, a.playerId, 'gshop-hp-concentrated');
  assert('bought=1 after authorize', count.bought === 1);

  // Daily limit 3 then 4th blocked
  for (let i = 2; i <= 3; i += 1) {
    const r = await guildShop.authorizePurchase(db, {
      playerId: a.playerId,
      offerId: 'gshop-hp-concentrated',
      transactionId: `tx-daily-${i}`,
    });
    assert(`daily buy ${i}`, r.ok === true);
  }
  const dailyBlocked = await guildShop.authorizePurchase(db, {
    playerId: a.playerId,
    offerId: 'gshop-hp-concentrated',
    transactionId: 'tx-daily-4',
  });
  assert('daily limit 3 then 4th blocked', dailyBlocked.ok === false);
  count = await guildShop.getPurchaseCount(db, a.playerId, 'gshop-hp-concentrated');
  assert('daily bought stays 3', count.bought === 3);

  // Weekly limit (gshop-bandagem: weekly, limit 5, req Lv1)
  for (let i = 1; i <= 5; i += 1) {
    const r = await guildShop.authorizePurchase(db, {
      playerId: a.playerId,
      offerId: 'gshop-bandagem',
      transactionId: `tx-weekly-${i}`,
    });
    assert(`weekly buy ${i}`, r.ok === true);
  }
  const weeklyBlocked = await guildShop.authorizePurchase(db, {
    playerId: a.playerId,
    offerId: 'gshop-bandagem',
    transactionId: 'tx-weekly-6',
  });
  assert('weekly limit blocks 6th', weeklyBlocked.ok === false);

  // Same transactionId idempotent
  const idemp1 = await guildShop.authorizePurchase(db, {
    playerId: a.playerId,
    offerId: 'gshop-hp-potion',
    transactionId: 'tx-idempotent',
  });
  const idemp2 = await guildShop.authorizePurchase(db, {
    playerId: a.playerId,
    offerId: 'gshop-hp-potion',
    transactionId: 'tx-idempotent',
  });
  assert('idempotent first ok', idemp1.ok === true && !idemp1.alreadyProcessed);
  assert('idempotent second alreadyProcessed', idemp2.ok === true && idemp2.alreadyProcessed === true);
  const potionCount = await guildShop.getPurchaseCount(db, a.playerId, 'gshop-hp-potion');
  assert('idempotent no double count', potionCount.bought === 1);

  // Guild hop: buy on A, leave, join B — same offer/cycle still limited
  // Use gshop-seal-common daily limit 10; buy once then hop
  const hopOffer = 'gshop-seal-common';
  await guildShop.resetPurchaseLimit(db, a.playerId, hopOffer);
  const hopBuy = await guildShop.authorizePurchase(db, {
    playerId: a.playerId,
    offerId: hopOffer,
    transactionId: 'tx-hop-buy',
  });
  assert('hop buy on guild A', hopBuy.ok === true);
  const beforeHop = await guildShop.getPurchaseCount(db, a.playerId, hopOffer);
  assert('hop bought=1', beforeHop.bought === 1);

  await guildsSvc.transferLeadership(db, guildA.id, a.playerId, helper.playerId);
  await guildsSvc.leaveGuild(db, guildA.id, a.playerId);

  const guildB = await guildsSvc.createGuild(
    db,
    { name: 'Guild Beta', tag: 'BETA', joinMode: 'open' },
    { playerId: b.playerId, nickname: 'PlayerB', playerLevel: 50 },
  );
  await setGuildLevel(db, guildB.id, 10);
  await guildsSvc.joinGuild(db, guildB.id, {
    playerId: a.playerId,
    nickname: 'PlayerA',
    playerLevel: 50,
  });

  const afterHop = await guildShop.getPurchaseCount(db, a.playerId, hopOffer);
  assert('guild hop keeps limit count', afterHop.bought === 1 && afterHop.cycleId === beforeHop.cycleId);

  // Membership race: leave then authorize fails
  await guildsSvc.leaveGuild(db, guildB.id, a.playerId);
  const afterLeave = await guildShop.authorizePurchase(db, {
    playerId: a.playerId,
    offerId: 'gshop-hp-potion',
    transactionId: 'tx-after-leave',
  });
  assert('membership race leave → authorize fails', afterLeave.ok === false);

  // Catalog list when in guild
  await guildsSvc.joinGuild(db, guildB.id, {
    playerId: a.playerId,
    nickname: 'PlayerA',
    playerLevel: 50,
  });
  const catalog = await guildShop.listCatalog(db, a.playerId, 10_000);
  assert('listCatalog ok', catalog.ok === true && catalog.entries.length === 10);
  assert('catalog has unlocked entries', catalog.entries.some((e) => e.unlocked));

  console.log('Backend guild-shop tests passed.');
}

async function runLocalProviderTests(): Promise<void> {
  resetLocalGuildProvider();
  resetLocalGuildShopProvider();
  const guildP = getLocalGuildProvider();
  const shop = new LocalGuildShopProvider();

  const founder = { playerId: 'local-a', nickname: 'LocalA', playerLevel: 50 };
  const g = await guildP.createGuild(
    { name: 'Local Guild', tag: 'LOCL', joinMode: 'open' },
    founder,
  );
  // Raise level via XP mock — use addGuildXp many times or set via memory
  await guildP.addGuildXp(g.id, 999_999);

  await shop.setMockGuildLevel(99);
  const auth = await shop.authorizePurchase({
    playerId: founder.playerId,
    nickname: founder.nickname,
    offerId: 'gshop-hp-concentrated',
    transactionId: 'local-tx-1',
  });
  assert('local authorize ok', auth.ok === true);

  for (let i = 2; i <= 3; i += 1) {
    const r = await shop.authorizePurchase({
      playerId: founder.playerId,
      nickname: founder.nickname,
      offerId: 'gshop-hp-concentrated',
      transactionId: `local-tx-${i}`,
    });
    assert(`local daily ${i}`, r.ok === true);
  }
  const blocked = await shop.authorizePurchase({
    playerId: founder.playerId,
    nickname: founder.nickname,
    offerId: 'gshop-hp-concentrated',
    transactionId: 'local-tx-4',
  });
  assert('local buy limit blocks 4th', blocked.ok === false);

  const id1 = await shop.authorizePurchase({
    playerId: founder.playerId,
    nickname: founder.nickname,
    offerId: 'gshop-hp-potion',
    transactionId: 'local-idem',
  });
  const id2 = await shop.authorizePurchase({
    playerId: founder.playerId,
    nickname: founder.nickname,
    offerId: 'gshop-hp-potion',
    transactionId: 'local-idem',
  });
  assert('local idempotent', id1.ok && id2.ok && id2.alreadyProcessed === true);

  console.log('Local guild-shop provider tests passed.');
  console.log(
    'NOTE: production without DATABASE_URL → resolveSocialProviderMode() = unavailable (no silent mock).',
  );
}

async function main(): Promise<void> {
  await runBackendTests();
  await runLocalProviderTests();
  console.log('All guild-shop tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
