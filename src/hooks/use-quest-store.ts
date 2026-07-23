'use client';

import { useStore } from '@/hooks/use-store';
import { questStore } from '@/stores/quest-store';
import type { QuestLogState } from '@/types/quest';

export function useQuestStore(): QuestLogState {
  return useStore(questStore);
}
