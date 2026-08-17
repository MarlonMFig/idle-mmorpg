import { getItem } from '@/data/items';
import { guildLootBonusMultiplier, vipEmptyLootRerollChance } from '@/lib/progression-bonuses';
import type { LootDropEntry, RolledLoot } from '@/types/loot';

/** Rola a tabela de drop do inimigo. VIP: reroll em miss, não infla raridade. */
export function rollDropTable(table: readonly LootDropEntry[]): RolledLoot[] {
  const drops: RolledLoot[] = [];
  const lootMult = guildLootBonusMultiplier();

  for (const entry of table) {
    const chance = Math.min(1, entry.chance * lootMult);
    let hit = Math.random() <= chance;
    if (!hit && vipEmptyLootRerollChance() > 0 && Math.random() < vipEmptyLootRerollChance()) {
      hit = Math.random() <= chance;
    }
    if (!hit) continue;

    const min = Math.max(1, entry.quantityMin);
    const max = Math.max(min, entry.quantityMax);
    const quantity = min + Math.floor(Math.random() * (max - min + 1));
    const item = getItem(entry.itemId);

    drops.push({
      itemId: entry.itemId,
      name: item?.name ?? entry.itemId,
      quantity,
      rarity: entry.rarity,
    });
  }

  return drops;
}
