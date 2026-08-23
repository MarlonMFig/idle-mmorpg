/**
 * Item 31 — Persistência de Inventário / Copper (obrigatórios).
 * Run: npx --yes tsx scripts/test-inventory-persist.ts
 */
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { HP_POTION_ITEM_ID, REVIVE_ITEM_ID } from '../src/data/helper-items';
import { economyService } from '../src/lib/economy-service';
import {
  parsePersistedInventory,
  sanitizeInventorySlot,
  snapshotInventorySlots,
  slotsFromPersisted,
} from '../src/lib/inventory-persist';
import { clearEconomyLedger } from '../src/lib/economy-ledger';
import { inventoryStore } from '../src/stores/inventory-store';
import { shopStore } from '../src/stores/shop-store';
import { gemStore } from '../src/stores/gem-store';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function wipeCopper(): void {
  const n = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  if (n > 0) inventoryStore.removeItem(SHOP_CURRENCY_ITEM_ID, n);
}

function roundTrip(): void {
  const snap = inventoryStore.getPersistedInventory();
  inventoryStore.reset();
  inventoryStore.hydrate(snap);
}

function counts(): Record<string, number> {
  const ids = [
    SHOP_CURRENCY_ITEM_ID,
    HP_POTION_ITEM_ID,
    REVIVE_ITEM_ID,
    'item-anime-naruto-bandagem',
    'item-sealing-scroll',
  ];
  const out: Record<string, number> = {};
  for (const id of ids) out[id] = inventoryStore.countItem(id);
  return out;
}

function main(): void {
  // —— Sanitização ——
  assert('unknown item ignored', sanitizeInventorySlot({ itemId: 'item-nope', quantity: 5 }) === null);
  assert('negative qty ignored', sanitizeInventorySlot({ itemId: HP_POTION_ITEM_ID, quantity: -3 }) === null);
  assert('zero qty ignored', sanitizeInventorySlot({ itemId: HP_POTION_ITEM_ID, quantity: 0 }) === null);
  assert(
    'fraction floored',
    sanitizeInventorySlot({ itemId: HP_POTION_ITEM_ID, quantity: 4.9 })?.quantity === 4,
  );
  assert('missing inventory blob → null', parsePersistedInventory(undefined) === null);
  assert('corrupt inventory → null', parsePersistedInventory({ slots: 'nope' }) === null);

  // —— Migration: save antigo sem inventory ——
  inventoryStore.reset();
  const starterCopper = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  inventoryStore.hydrate(null);
  assert('null hydrate = starter reset', inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID) === starterCopper);

  // —— 25 Copper reload ——
  inventoryStore.reset();
  wipeCopper();
  clearEconomyLedger();
  economyService.grantCurrency('copper', 10_000, 'dev');
  assert('copper 10000', economyService.getBalance('copper') === 10_000);
  assert('buy 50 packs blocked or ok with funds', shopStore.buy('offer-hp-potion', 50) === true);
  // 50 * 40 = 2000
  assert('copper 8000 after buy', economyService.getBalance('copper') === 8_000);
  assert('50 potions', inventoryStore.countItem(HP_POTION_ITEM_ID) === 50);
  roundTrip();
  assert('copper after reload 8000', economyService.getBalance('copper') === 8_000);
  assert('potions after reload 50', inventoryStore.countItem(HP_POTION_ITEM_ID) === 50);

  // —— 26 Loot-like add ——
  inventoryStore.addItem('item-anime-naruto-bandagem', 3, 'combat');
  roundTrip();
  assert('loot item persists', inventoryStore.countItem('item-anime-naruto-bandagem') === 3);

  // —— 27 Potion consume ——
  assert('consume 3 potions', inventoryStore.consumeItem(HP_POTION_ITEM_ID, 3));
  assert('47 left', inventoryStore.countItem(HP_POTION_ITEM_ID) === 47);
  roundTrip();
  assert('47 after reload', inventoryStore.countItem(HP_POTION_ITEM_ID) === 47);

  // —— 28 Revive ——
  inventoryStore.addItem(REVIVE_ITEM_ID, 5, 'dev');
  inventoryStore.consumeItem(REVIVE_ITEM_ID, 2);
  roundTrip();
  assert('revive 3 after reload', inventoryStore.countItem(REVIVE_ITEM_ID) === 3);

  // —— 29 Shop buy already covered; 30 sell ——
  const beforeSell = economyService.getBalance('copper');
  assert('sell bandagem', shopStore.sell('item-anime-naruto-bandagem', 2));
  const afterSell = economyService.getBalance('copper');
  assert('copper increased', afterSell > beforeSell);
  assert('1 bandagem left', inventoryStore.countItem('item-anime-naruto-bandagem') === 1);
  roundTrip();
  assert('sell state after reload copper', economyService.getBalance('copper') === afterSell);
  assert('sell state after reload item', inventoryStore.countItem('item-anime-naruto-bandagem') === 1);

  // —— Snapshot coerente (race mitigation: single snapshot) ——
  const snapA = inventoryStore.getPersistedInventory();
  const snapB = snapshotInventorySlots(inventoryStore.getSnapshot().slots);
  assert('snapshot equals getPersisted', JSON.stringify(snapA) === JSON.stringify(snapB));

  // —— 46 Ten reloads ——
  const expected = counts();
  for (let i = 0; i < 10; i += 1) {
    roundTrip();
  }
  const after10 = counts();
  assert('10 reloads identical', JSON.stringify(expected) === JSON.stringify(after10));

  // —— 47 Ten transactions then reload ——
  inventoryStore.reset();
  wipeCopper();
  clearEconomyLedger();
  shopStore.reset();
  gemStore.hydrate({ balance: 0 });

  economyService.grantCurrency('copper', 5_000, 'dev'); // reward
  inventoryStore.addItem('item-anime-naruto-bandagem', 10, 'combat'); // loot
  shopStore.buy('offer-hp-potion', 5); // buy
  shopStore.sell('item-anime-naruto-bandagem', 3); // sell
  inventoryStore.consumeItem(HP_POTION_ITEM_ID, 2); // consume
  economyService.grantCurrency('copper', 100, 'missionReward'); // reward
  shopStore.buy('offer-revive', 1); // buy
  inventoryStore.addItem('item-anime-naruto-shuriken', 4, 'combat'); // loot
  inventoryStore.consumeItem(REVIVE_ITEM_ID, 1); // consume (if bought)
  shopStore.sell('item-anime-naruto-shuriken', 2); // sell
  economyService.grantCurrency('copper', 50, 'dailyLogin'); // reward

  const expectedTx = {
    copper: economyService.getBalance('copper'),
    potions: inventoryStore.countItem(HP_POTION_ITEM_ID),
    revive: inventoryStore.countItem(REVIVE_ITEM_ID),
    bandagem: inventoryStore.countItem('item-anime-naruto-bandagem'),
    shuriken: inventoryStore.countItem('item-anime-naruto-shuriken'),
  };
  roundTrip();
  assert('tx copper', economyService.getBalance('copper') === expectedTx.copper);
  assert('tx potions', inventoryStore.countItem(HP_POTION_ITEM_ID) === expectedTx.potions);
  assert('tx revive', inventoryStore.countItem(REVIVE_ITEM_ID) === expectedTx.revive);
  assert('tx bandagem', inventoryStore.countItem('item-anime-naruto-bandagem') === expectedTx.bandagem);
  assert('tx shuriken', inventoryStore.countItem('item-anime-naruto-shuriken') === expectedTx.shuriken);

  // —— Idempotent migration (no dupe copper) ——
  const copperOnce = economyService.getBalance('copper');
  const blob = inventoryStore.getPersistedInventory();
  inventoryStore.hydrate(blob);
  inventoryStore.hydrate(blob);
  assert('hydrate idempotent copper', economyService.getBalance('copper') === copperOnce);

  // —— slotsFromPersisted length ——
  const rebuilt = slotsFromPersisted(blob);
  assert('40 slots', rebuilt.length === 40);

  // Anime Coins remain in gemStore (not inventory)
  gemStore.hydrate({ balance: 12 });
  roundTrip();
  assert('anime coins untouched by inventory RT', gemStore.getSnapshot().balance === 12);

  console.log('\nAll inventory persist tests passed.');
  console.log('Note: Awakening/Forge/Daily/Mission/Boss/Helper persistence = same slot hydrate path.');
}

main();
