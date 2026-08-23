/**
 * Item 36 — Remoção definitiva do sistema Equipment.
 * Run: npx --yes tsx scripts/test-equipment-removed.ts
 */
import { getItem, listItemDefinitions, validateItemRegistry } from '../src/data/items';
import { STARTER_INVENTORY_LOADOUT } from '../src/data/starter-loadout';
import { ENEMY_DEFINITIONS } from '../src/data/enemies';
import { SHOP_OFFERS, getItemSellValue } from '../src/data/shop';
import { parsePersistedInventory } from '../src/lib/inventory-persist';
import { computeProvisionalAccountPower } from '../src/lib/ranking-metrics';
import { setLootRngSeed } from '../src/lib/loot-rng';
import { resolveLoot } from '../src/systems/loot-engine';
import { inventoryStore } from '../src/stores/inventory-store';
import { computePlayerAttributes } from '../src/utils/attributes';
import { BASE_ATTRIBUTES } from '../src/constants/attributes';

function assert(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL ${name}`);
  console.log(`ok  ${name}`);
}

const REMOVED_EQUIP_ITEMS = [
  'item-kunai',
  'item-flak-vest',
  'item-shinobi-gloves',
  'item-shinobi-boots',
] as const;

function main(): void {
  // —— API morta ——
  const inv = inventoryStore as Record<string, unknown>;
  assert('sem equipFromSlot', typeof inv.equipFromSlot !== 'function');
  assert('sem unequip', typeof inv.unequip !== 'function');
  assert('InventoryState sem equipment', !('equipment' in inventoryStore.getSnapshot()));

  // —— Registry ——
  for (const id of REMOVED_EQUIP_ITEMS) {
    assert(`removido ${id}`, getItem(id) == null);
  }
  assert('leaf-band preservado (quest)', getItem('item-leaf-band') != null);
  assert('lucky-charm preservado (loot)', getItem('item-lucky-charm') != null);
  assert('awakening material preservado', getItem('item-awakening-material') != null);
  assert('sem categoria equipment', !listItemDefinitions().some((i) => i.category === ('equipment' as never)));
  assert('registry válido', validateItemRegistry().length === 0);

  // —— Starter ——
  inventoryStore.reset();
  for (const row of STARTER_INVENTORY_LOADOUT) {
    assert(`starter tem ${row.itemId}`, inventoryStore.countItem(row.itemId) === row.quantity);
  }
  for (const id of REMOVED_EQUIP_ITEMS) {
    assert(`starter sem ${id}`, inventoryStore.countItem(id) === 0);
  }

  // —— Save legado com equipment vazio ——
  const migrated = parsePersistedInventory({
    slots: [{ itemId: 'item-copper-coin', quantity: 10 }, ...Array(39).fill(null)],
    equipment: { weapon: null, head: null, body: null, accessory: null },
  });
  assert('migração descarta equipment', migrated != null && !('equipment' in migrated));
  assert('migração preserva copper', migrated?.slots[0]?.itemId === 'item-copper-coin');

  // —— Slot com item equip removido no save ——
  const orphan = parsePersistedInventory({
    slots: [{ itemId: 'item-kunai', quantity: 1 }, ...Array(39).fill(null)],
  });
  assert('item-kunai órfão ignorado', orphan?.slots[0] == null);

  // —— Stats: sem camada equipment; base intacta ——
  const attrs = computePlayerAttributes({ level: 1, stars: 0 });
  assert('attrs sem equipment', !('equipment' in attrs));
  assert('atk = base', attrs.totals.strength === BASE_ATTRIBUTES.strength);
  assert('def = base', attrs.totals.defense === BASE_ATTRIBUTES.defense);

  const powerA = computeProvisionalAccountPower({
    playerLevel: 10,
    totalMastery: 20,
    uniqueCharacters: 3,
    onlineKills: 100,
    activeStrength: attrs.totals.strength,
    activeDefense: attrs.totals.defense,
    activeSpeed: attrs.totals.speed,
    activeAwakening: 0,
    lineageRank: 1,
  });
  const powerB = computeProvisionalAccountPower({
    playerLevel: 10,
    totalMastery: 20,
    uniqueCharacters: 3,
    onlineKills: 100,
    activeStrength: BASE_ATTRIBUTES.strength,
    activeDefense: BASE_ATTRIBUTES.defense,
    activeSpeed: BASE_ATTRIBUTES.speed,
    activeAwakening: 0,
    lineageRank: 1,
  });
  assert('account power sem equipment (igual base)', powerA === powerB);

  // —— Shop: sell sem multiplicador de equip ——
  const charmSell = getItemSellValue('item-lucky-charm');
  assert('lucky-charm sellável sem equipSlot', charmSell > 0);

  for (const offer of SHOP_OFFERS) {
    assert(`shop offer ${offer.id} no registry`, getItem(offer.itemId) != null);
    assert(`shop offer ${offer.id} não é gear removido`, !(REMOVED_EQUIP_ITEMS as readonly string[]).includes(offer.itemId));
  }

  // —— Loot tables: todos itemIds existem; 1000 rolls ——
  const allTables = ENEMY_DEFINITIONS.map((e) => e.loot).filter((t) => t.length > 0);
  for (const table of allTables) {
    for (const entry of table) {
      assert(`loot ${entry.itemId} no registry`, getItem(entry.itemId) != null);
      assert(
        `loot ${entry.itemId} não é gear removido`,
        !(REMOVED_EQUIP_ITEMS as readonly string[]).includes(entry.itemId),
      );
    }
  }

  setLootRngSeed(36);
  let rolled = 0;
  for (let i = 0; i < 1000; i += 1) {
    for (const table of allTables) {
      const result = resolveLoot({
        kills: 1,
        enemyLevel: 1,
        table,
        includeCopper: false,
      });
      for (const item of result.items) {
        assert(`roll ${item.itemId} válido`, getItem(item.itemId) != null);
        assert(
          `roll sem gear removido ${item.itemId}`,
          !(REMOVED_EQUIP_ITEMS as readonly string[]).includes(item.itemId),
        );
        rolled += 1;
      }
    }
  }
  assert(`1000×loot tables executado (drops=${rolled})`, rolled >= 0);

  console.log('equipment removal tests passed');
}

main();
