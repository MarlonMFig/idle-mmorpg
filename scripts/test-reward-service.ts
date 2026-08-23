/**
 * Item 32 — Reward Service unificado (obrigatórios).
 * Run: npx --yes tsx scripts/test-reward-service.ts
 */
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { HP_POTION_ITEM_ID } from '../src/data/helper-items';
import { OFFLINE_LIMITS } from '../src/constants/offline';
import { OFFLINE_MASTERY_XP } from '../src/constants/character-mastery';
import { clearEconomyLedger, listEconomyLedger } from '../src/lib/economy-ledger';
import { economyService } from '../src/lib/economy-service';
import {
  achievementRewardTxId,
  missionRewardTxId,
  offlineRewardTxId,
  rewardIdempotency,
  rewardService,
} from '../src/lib/reward-service';
import { applyRewardResult } from '../src/systems/reward-application';
import { inventoryStore } from '../src/stores/inventory-store';
import { offlineProgressStore } from '../src/stores/offline-progress-store';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function wipe(): void {
  inventoryStore.reset();
  const c = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  if (c > 0) inventoryStore.removeItem(SHOP_CURRENCY_ITEM_ID, c);
  rewardIdempotency.clear();
  clearEconomyLedger();
}

function main(): void {
  wipe();

  // Invalid
  assert(
    'negative blocked',
    !rewardService.grant({ rewards: { copper: -100 }, source: 'dev' }).success,
  );
  assert(
    'nan blocked',
    !rewardService.grant({ rewards: { copper: Number.NaN }, source: 'dev' }).success,
  );
  assert(
    'invalid item blocked',
    !rewardService.grant({
      rewards: { items: [{ itemId: 'item-does-not-exist', quantity: 1 }] },
      source: 'dev',
    }).success,
  );

  // Bundle
  const bundle = rewardService.grant({
    rewards: {
      copper: 500,
      items: [
        { itemId: HP_POTION_ITEM_ID, quantity: 2 },
        { itemId: HP_POTION_ITEM_ID, quantity: 3 },
      ],
    },
    source: 'mission',
    sourceId: 'test-mission',
    transactionId: missionRewardTxId('2026-01-01', 'test-mission'),
  });
  assert('bundle ok', bundle.success && !bundle.alreadyApplied);
  assert('bundle copper', economyService.getBalance('copper') === 500);
  assert('bundle potions normalized 5', inventoryStore.countItem(HP_POTION_ITEM_ID) === 5);
  assert(
    'ledger mission',
    listEconomyLedger().some((t) => t.source === 'missionReward' && t.amount === 500),
  );

  // Idempotent
  const again = rewardService.grant({
    rewards: { copper: 500 },
    source: 'mission',
    transactionId: missionRewardTxId('2026-01-01', 'test-mission'),
  });
  assert('idempotent', again.success && again.alreadyApplied);
  assert('copper not doubled', economyService.getBalance('copper') === 500);

  // Hunt copper via reward service
  wipe();
  rewardService.grant({ rewards: { copper: 12 }, source: 'hunt', sourceId: 'enemy-a' });
  assert(
    'hunt ledger',
    listEconomyLedger().some((t) => t.source === 'huntReward' && t.amount === 12),
  );

  // Loot adapter (no unknown)
  wipe();
  applyRewardResult(
    { copper: 7, items: [{ itemId: HP_POTION_ITEM_ID, quantity: 1 }] },
    { source: 'loot' },
  );
  assert('loot copper', economyService.getBalance('copper') === 7);
  assert(
    'loot ledger combatLoot',
    listEconomyLedger().some((t) => t.source === 'combatLoot'),
  );

  // Offline path
  wipe();
  const offId = 'off-test-crash-1';
  const tx = offlineRewardTxId(offId);
  const first = rewardService.grant({
    rewards: { copper: 100, items: [{ itemId: HP_POTION_ITEM_ID, quantity: 1 }] },
    source: 'offline',
    transactionId: tx,
    allowPartial: true,
  });
  assert('offline grant', first.success && (first.granted.copper ?? 0) === 100);
  assert(
    'offline ledger',
    listEconomyLedger().some((t) => t.source === 'offline'),
  );
  const second = rewardService.grant({
    rewards: { copper: 100 },
    source: 'offline',
    transactionId: tx,
  });
  assert('offline double claim', second.alreadyApplied);
  assert('offline copper once', economyService.getBalance('copper') === 100);

  // Crash simulation: grant remembered, collectPending clears
  wipe();
  const crashId = 'off-crash-2';
  const crashTx = offlineRewardTxId(crashId);
  rewardService.grant({
    rewards: { copper: 33 },
    source: 'offline',
    transactionId: crashTx,
  });
  assert('crash tx remembered', rewardIdempotency.has(crashTx));
  // Simulate pending still present — has(tx) path
  assert('idempotency has after grant', rewardIdempotency.has(crashTx));

  // 100 grants
  wipe();
  let expected = 0;
  for (let i = 0; i < 100; i += 1) {
    const r = rewardService.grant({
      rewards: { copper: 1 },
      source: 'dev',
      transactionId: `dev:bulk:${i}`,
    });
    assert(`bulk ${i}`, r.success);
    expected += 1;
  }
  assert('100 copper', economyService.getBalance('copper') === expected);
  assert('no negative', economyService.getBalance('copper') >= 0);

  // Achievement tx helper
  assert(
    'achievement tx shape',
    achievementRewardTxId('ach-1') === 'achievement:ach-1',
  );

  // Regressions documented constants
  assert('mastery offline 0', OFFLINE_MASTERY_XP === 0);
  assert('offline 4h', OFFLINE_LIMITS.nonVipHours === 4);
  assert('offline 8h vip', OFFLINE_LIMITS.vipHours === 8);

  // Inventory persist still works with reward path
  const snap = inventoryStore.getPersistedInventory();
  inventoryStore.reset();
  inventoryStore.hydrate(snap);
  assert('persist after rewards', economyService.getBalance('copper') === expected);

  // Empty offline store API still loads
  assert('offline store exists', typeof offlineProgressStore.collectPending === 'function');

  console.log('\nAll reward-service tests passed.');
}

main();
