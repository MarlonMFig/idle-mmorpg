'use client';

import { useStore } from '@/hooks/use-store';
import { attributesStore } from '@/stores/attributes-store';
import type { PlayerAttributes } from '@/types/attributes';

export function useAttributesStore(): PlayerAttributes {
  return useStore(attributesStore);
}
