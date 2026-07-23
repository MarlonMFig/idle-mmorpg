'use client';

import { useStore } from '@/hooks/use-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { VitalsState } from '@/types/hud';

export function useVitalsStore(): VitalsState {
  return useStore(vitalsStore);
}
