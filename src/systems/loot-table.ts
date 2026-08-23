import { resolveLoot, rewardItemsToRolled } from '@/systems/loot-engine';
import type { LootDropEntry, RolledLoot } from '@/types/loot';

/** Compat: uma kill da tabela clássica via Loot Engine. */
export function rollDropTable(table: readonly LootDropEntry[]): RolledLoot[] {
  const result = resolveLoot({
    kills: 1,
    enemyLevel: 1,
    table,
    includeCopper: false,
  });
  return rewardItemsToRolled(result.items);
}
