import { getItem } from '@/data/items';
import type { LootDropEntry, RolledLoot } from '@/types/loot';

/** Rola a tabela de drop do inimigo. */
export function rollDropTable(table: readonly LootDropEntry[]): RolledLoot[] {
  const drops: RolledLoot[] = [];

  for (const entry of table) {
    if (Math.random() > entry.chance) continue;

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
