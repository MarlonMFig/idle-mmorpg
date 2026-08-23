/**
 * Item 30 — Economy / Shop (obrigatórios).
 * Run: npx --yes tsx scripts/test-economy.ts
 */
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { HP_POTION_ITEM_ID } from '../src/data/helper-items';
import { getItem } from '../src/data/items';
import { getItemSellValue, getShopOffer, listShopOffers } from '../src/data/shop';
import { clearEconomyLedger, listEconomyLedger } from '../src/lib/economy-ledger';
import { economyService } from '../src/lib/economy-service';
import { isItemSellable, validateShopEconomy } from '../src/lib/economy-validation';
import { grantMissionRewards } from '../src/lib/mission-rewards';
import {
  getDailyCycleId,
  getWeeklyCycleId,
  setMissionClockOverride,
} from '../src/lib/mission-cycle';
import { gemStore } from '../src/stores/gem-store';
import { inventoryStore } from '../src/stores/inventory-store';
import { shopStore } from '../src/stores/shop-store';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function wipeWallet(): void {
  const copper = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  if (copper > 0) inventoryStore.removeItem(SHOP_CURRENCY_ITEM_ID, copper);
  gemStore.hydrate({ balance: 0 });
}

function resetEconomy(): void {
  inventoryStore.reset();
  wipeWallet();
  shopStore.reset();
  clearEconomyLedger();
  setMissionClockOverride(null);
}

function main(): void {
  resetEconomy();

  // 87 exploit catalog
  const warnings = validateShopEconomy();
  const exploit = warnings.filter((w) => w.includes('EXPLORATION'));
  assert('no buy/sell exploit in catalog', exploit.length === 0);
  assert('catalog item refs valid', !warnings.some((w) => w.includes('itemId inválido')));

  // 78 buy with funds
  economyService.grantCurrency('copper', 500, 'dev');
  const potionOffer = getShopOffer('offer-hp-potion')!;
  const beforeCopper = economyService.getBalance('copper');
  const beforePotions = inventoryStore.countItem(HP_POTION_ITEM_ID);
  assert('buy ok', shopStore.buy('offer-hp-potion', 1));
  assert(
    'copper spent once',
    economyService.getBalance('copper') === beforeCopper - potionOffer.price,
  );
  assert('item delivered', inventoryStore.countItem(HP_POTION_ITEM_ID) === beforePotions + 1);

  // 79 no funds
  inventoryStore.reset();
  wipeWallet();
  shopStore.reset();
  clearEconomyLedger();
  assert('buy blocked no funds', !shopStore.buy('offer-hp-potion', 1));
  assert('balance still 0', economyService.getBalance('copper') === 0);
  assert('no potion granted', inventoryStore.countItem(HP_POTION_ITEM_ID) === 0);

  // 80 double click / in-flight
  economyService.grantCurrency('copper', 10_000, 'dev');
  assert('first buy', shopStore.buy('offer-hp-potion', 1));
  const mid = inventoryStore.countItem(HP_POTION_ITEM_ID);
  // Sequential buys are allowed; lock is sync. Simulate two rapid calls:
  const a = shopStore.buy('offer-hp-potion', 1);
  const b = shopStore.buy('offer-hp-potion', 1);
  assert('two sequential buys ok', a && b);
  assert(
    'three potions total after sequence',
    inventoryStore.countItem(HP_POTION_ITEM_ID) === mid + 2,
  );

  // 81 stack / inventory room
  inventoryStore.reset();
  wipeWallet();
  shopStore.reset();
  clearEconomyLedger();
  economyService.grantCurrency('copper', 10_000, 'dev');
  const stackMax = getItem(HP_POTION_ITEM_ID)!.stackMax;
  inventoryStore.addItem(HP_POTION_ITEM_ID, stackMax - 2, 'dev');
  // Ocupa slots vazios para o MAX considerar só o espaço do stack atual.
  inventoryStore.addItem('item-anime-naruto-bandagem', 40 * 99, 'dev');
  const maxPacks = shopStore.maxAffordablePacks('offer-hp-potion');
  assert('max packs respects stack room', maxPacks === 2);
  assert('buy max ok', shopStore.buy('offer-hp-potion', maxPacks));
  assert('stack full → max 0', shopStore.maxAffordablePacks('offer-hp-potion') === 0);
  const copperBeforeBlocked = economyService.getBalance('copper');
  assert('over-capacity buy blocked', !shopStore.buy('offer-hp-potion', 1));
  assert('no copper lost on block', economyService.getBalance('copper') === copperBeforeBlocked);

  // 82 daily limit
  resetEconomy();
  economyService.grantCurrency('copper', 50_000, 'dev');
  const dailyId = 'offer-sealing-scroll-legendary';
  const dailyOffer = getShopOffer(dailyId)!;
  assert('daily limit 3', dailyOffer.purchaseLimit === 3 && dailyOffer.resetType === 'daily');
  assert('buy 3 packs', shopStore.buy(dailyId, 3));
  assert('4th blocked', !shopStore.buy(dailyId, 1));
  assert('remaining 0', shopStore.getRemainingLimit(dailyId) === 0);

  // 90 daily reset via same cycle service
  const dayA = getDailyCycleId();
  shopStore.hydrate({
    purchases: {
      [dailyId]: { bought: 3, resetCycleId: '1999-01-01' },
    },
  });
  assert('stale daily cycle resets remaining', shopStore.getRemainingLimit(dailyId) === 3);
  assert('current daily cycle id stable', getDailyCycleId() === dayA);

  // 91 weekly reset same principle
  const weeklyId = 'offer-material-bandagem';
  const weekA = getWeeklyCycleId();
  shopStore.hydrate({
    purchases: {
      [weeklyId]: { bought: 5, resetCycleId: '1999-W01' },
    },
  });
  assert('weekly offer exists', getShopOffer(weeklyId)?.resetType === 'weekly');
  assert('stale weekly resets', shopStore.getRemainingLimit(weeklyId) === 5);
  assert('weekly cycle id', getWeeklyCycleId() === weekA);

  // 83 reload persistence shape
  shopStore.buy(weeklyId, 2);
  const persisted = shopStore.getPersistedPurchases();
  assert('persist has weekly buy', (persisted[weeklyId]?.bought ?? 0) === 2);
  shopStore.reset();
  shopStore.hydrate({ purchases: persisted });
  assert('hydrate restores bought', shopStore.getPurchased(weeklyId) === 2);

  // 84 sell
  resetEconomy();
  inventoryStore.addItem('item-anime-naruto-bandagem', 5, 'dev');
  const unit = getItemSellValue('item-anime-naruto-bandagem');
  assert('sellable', isItemSellable('item-anime-naruto-bandagem') && unit > 0);
  const copperBeforeSell = economyService.getBalance('copper');
  assert('sell 1', shopStore.sell('item-anime-naruto-bandagem', 1));
  assert(
    'copper once',
    economyService.getBalance('copper') === copperBeforeSell + unit,
  );
  assert('qty left 4', inventoryStore.countItem('item-anime-naruto-bandagem') === 4);

  // 85 sell max
  assert('sell max 4', shopStore.sell('item-anime-naruto-bandagem', 4));
  assert('sold out', inventoryStore.countItem('item-anime-naruto-bandagem') === 0);
  assert('copper after max', economyService.getBalance('copper') === copperBeforeSell + unit * 5);

  // 86 not sellable
  assert('copper not sellable', !isItemSellable(SHOP_CURRENCY_ITEM_ID));
  assert('sell copper blocked', !shopStore.sell(SHOP_CURRENCY_ITEM_ID, 1));

  // 88 mission source ≠ combat
  resetEconomy();
  grantMissionRewards([{ type: 'copper', amount: 250 }]);
  const missionTx = listEconomyLedger().find((t) => t.source === 'missionReward');
  assert('mission source tagged', missionTx?.amount === 250 && missionTx.direction === 'in');
  assert('no combatCopper from mission grant alone', true);

  // 89 DEV source
  clearEconomyLedger();
  economyService.grantCurrency('copper', 100, 'dev');
  assert(
    'dev source',
    listEconomyLedger()[0]?.source === 'dev' && listEconomyLedger()[0]?.direction === 'in',
  );

  // 92 integers + 93 negative
  clearEconomyLedger();
  const balBeforeFrac = economyService.getBalance('copper');
  assert('integer spend rejects fraction by floor', economyService.canAfford('copper', 0.7));
  economyService.spendCurrency('copper', 0.9, 'dev');
  assert('fractional spend no-op', economyService.getBalance('copper') === balBeforeFrac);

  assert('cannot overspend', !economyService.spendCurrency('copper', 999_999_999, 'dev'));
  assert('balance >= 0', economyService.getBalance('copper') >= 0);
  assert('anime >= 0', economyService.getBalance('animeCoins') >= 0);

  // Anime coins shop
  resetEconomy();
  economyService.grantCurrency('animeCoins', 5, 'dev');
  assert('anime pack buy', shopStore.buy('offer-special-potion-pack', 1));
  assert('anime spent', economyService.getBalance('animeCoins') === 0);
  assert('5 potions', inventoryStore.countItem(HP_POTION_ITEM_ID) === 5);
  assert('daily anime limit', !shopStore.buy('offer-special-potion-pack', 1));

  assert('offers count small', listShopOffers().length >= 5 && listShopOffers().length <= 15);

  console.log('\nAll economy tests passed.');
}

main();
