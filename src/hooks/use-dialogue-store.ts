'use client';

import { useStore } from '@/hooks/use-store';
import { dialogueStore } from '@/stores/dialogue-store';
import type { DialogueStoreState } from '@/types/dialogue';

export function useDialogueStore(): DialogueStoreState {
  return useStore(dialogueStore);
}
