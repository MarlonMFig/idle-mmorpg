import { VILLAGE_SYSTEM_BY_ID, type VillageBonusKind } from '@/constants/village-system';
import { villageStore } from '@/stores/village-store';
import type { VillageId } from '@/types/village';

export function villageBonusPercent(
  kind: VillageBonusKind,
  villageId: VillageId | null | undefined = villageStore.getPlayerVillageId(),
): number {
  if (!villageId) return 0;
  const village = VILLAGE_SYSTEM_BY_ID[villageId];
  if (!village) return 0;
  return village.bonuses
    .filter((bonus) => bonus.kind === kind)
    .reduce((sum, bonus) => sum + bonus.value, 0);
}

export function applyVillageBonus(
  baseValue: number,
  kind: VillageBonusKind,
  villageId?: VillageId | null,
): number {
  const percent = villageBonusPercent(kind, villageId);
  return baseValue * (1 + percent);
}

export function villageKillSpeedMultiplier(villageId?: VillageId | null): number {
  return 1 + villageBonusPercent('killSpeed', villageId);
}

export function villageHighRarityLuck(villageId?: VillageId | null): number {
  return 1 + villageBonusPercent('highRarityChance', villageId);
}
