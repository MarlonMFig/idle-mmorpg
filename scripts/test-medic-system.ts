/**
 * Item 42 — Médico / recuperação da equipe (Hub, Copper sink).
 * Run: npx --yes tsx scripts/test-medic-system.ts
 */
import { MEDIC_CONFIG } from '../src/constants/medic';
import { SHOP_CURRENCY_ITEM_ID } from '../src/constants/sealing';
import { REVIVE_ITEM_ID } from '../src/data/helper-items';
import { clearEconomyLedger, listEconomyLedger } from '../src/lib/economy-ledger';
import { economyService } from '../src/lib/economy-service';
import {
  calculateMedicCost,
  quoteMedicRecovery,
  recoverTeamAtMedic,
  resetMedicBusyForTests,
} from '../src/lib/medic-service';
import { inventoryStore } from '../src/stores/inventory-store';
import { skillsStore } from '../src/stores/skills-store';
import { vitalsStore } from '../src/stores/vitals-store';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

function wipeCopper(): void {
  const n = inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID);
  if (n > 0) inventoryStore.removeItem(SHOP_CURRENCY_ITEM_ID, n);
}

function setHp(hp: number, hpMax = 100): void {
  vitalsStore.reset({
    level: 1,
    xp: 0,
    xpMax: 100,
    hp,
    hpMax,
  });
}

function main(): void {
  resetMedicBusyForTests();
  inventoryStore.reset();
  wipeCopper();
  clearEconomyLedger();
  skillsStore.clearCooldowns();

  assert('config minimumCost', MEDIC_CONFIG.minimumCost === 25);
  assert('config baseCost', MEDIC_CONFIG.baseCost === 10);
  assert('config costPerMissingHp', MEDIC_CONFIG.costPerMissingHp === 0.35);
  assert('config maximumCost', MEDIC_CONFIG.maximumCost === 280);

  assert('full hp cost 0', calculateMedicCost(0, 100) === 0);
  assert('small missing uses minimum', calculateMedicCost(1, 100) === MEDIC_CONFIG.minimumCost);
  const mid = calculateMedicCost(50, 100);
  const high = calculateMedicCost(100, 100);
  assert('monotonic mid < high or equal', mid <= high);
  assert('high >= minimum', high >= MEDIC_CONFIG.minimumCost);
  assert(
    'cap at maximum',
    calculateMedicCost(100_000, 100_000) === MEDIC_CONFIG.maximumCost,
  );

  // —— Teste 1: cura parcial ——
  setHp(20, 100);
  economyService.grantCurrency('copper', 10_000, 'dev');
  clearEconomyLedger();
  let result = recoverTeamAtMedic();
  assert('partial heal ok', result.ok === true);
  assert('partial hp full', vitalsStore.getSnapshot().hp.eq(100));
  assert('partial cost charged', !result.ok || result.cost > 0);

  // —— Teste 3: full HP ——
  setHp(100, 100);
  const balBeforeFull = economyService.getBalance('copper');
  result = recoverTeamAtMedic();
  assert('full hp rejected', result.ok === false && result.reason === 'full');
  assert('full hp no copper spend', economyService.getBalance('copper') === balBeforeFull);

  // —— Teste 2: KO ——
  inventoryStore.reset();
  wipeCopper();
  inventoryStore.addItem(REVIVE_ITEM_ID, 3, 'dev');
  const reviveBefore = inventoryStore.countItem(REVIVE_ITEM_ID);
  economyService.grantCurrency('copper', 5_000, 'dev');
  setHp(0, 100);
  clearEconomyLedger();
  result = recoverTeamAtMedic();
  assert('ko heal ok', result.ok === true);
  assert('ko hp full', vitalsStore.getSnapshot().hp.eq(100));
  assert('revive untouched', inventoryStore.countItem(REVIVE_ITEM_ID) === reviveBefore);

  // —— Teste 4: sem copper ——
  wipeCopper();
  setHp(10, 100);
  const hpBefore = vitalsStore.getSnapshot().hp;
  result = recoverTeamAtMedic();
  assert('no copper fail', result.ok === false && result.reason === 'insufficient-copper');
  assert('hp unchanged', vitalsStore.getSnapshot().hp.eq(hpBefore));
  assert('copper still 0', economyService.getBalance('copper') === 0);

  // —— Teste 5: cobrança + ledger ——
  wipeCopper();
  economyService.grantCurrency('copper', 10_000, 'dev');
  clearEconomyLedger();
  setHp(50, 100);
  const quote = quoteMedicRecovery();
  result = recoverTeamAtMedic();
  assert('charge ok', result.ok === true);
  assert('balance 10000-cost', economyService.getBalance('copper') === 10_000 - quote.cost);
  const ledger = listEconomyLedger();
  const medicOut = ledger.find((row) => row.source === 'medic' && row.direction === 'out');
  assert('ledger medic out', Boolean(medicOut && medicOut.amount === quote.cost));

  // —— Teste 6: monotonicidade ——
  const lowCost = calculateMedicCost(10, 100);
  const highCost = calculateMedicCost(90, 100);
  assert('monotonic low <= high', lowCost <= highCost);

  // —— Teste 7: double click ——
  wipeCopper();
  economyService.grantCurrency('copper', 10_000, 'dev');
  clearEconomyLedger();
  setHp(40, 100);
  const first = recoverTeamAtMedic();
  const balAfterFirst = economyService.getBalance('copper');
  const second = recoverTeamAtMedic();
  assert('first recover ok', first.ok === true);
  assert('second is full', second.ok === false && second.reason === 'full');
  assert('single charge', economyService.getBalance('copper') === balAfterFirst);
  assert(
    'one medic ledger out',
    listEconomyLedger().filter((row) => row.source === 'medic' && row.direction === 'out').length === 1,
  );

  // —— Teste 9: não chama clearCooldowns ——
  skillsStore.startCooldown('skill-test-medic', 60_000);
  const cdBefore = skillsStore.getCooldownRemainingMs('skill-test-medic');
  setHp(30, 100);
  wipeCopper();
  economyService.grantCurrency('copper', 1_000, 'dev');
  recoverTeamAtMedic();
  const cdAfter = skillsStore.getCooldownRemainingMs('skill-test-medic');
  assert('cooldown still running', cdBefore > 0 && cdAfter > 0);

  // —— Teste 10: energia não criada / persistida ——
  assert(
    'no energy on vitals',
    !('currentEnergy' in vitalsStore.getSnapshot()) && !('energy' in vitalsStore.getSnapshot()),
  );

  // —— Quote UI helpers ——
  setHp(100, 100);
  const qFull = quoteMedicRecovery();
  assert('quote full needsRecovery false', qFull.needsRecovery === false && qFull.cost === 0);

  console.log('test-medic-system: all passed');
}

main();
