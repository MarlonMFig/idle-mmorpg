'use client';

import { useStore } from '@/hooks/use-store';
import { villageStore } from '@/stores/village-store';
import type { VillageSystemState } from '@/types/village';

export function useVillageStore(): VillageSystemState {
  return useStore(villageStore);
}
