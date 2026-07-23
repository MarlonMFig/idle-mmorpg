import type { DialogueQuestAction } from '@/types/quest';

/**
 * Sistema de diálogo — tipos independentes da engine.
 */
export interface DialoguePage {
  text: string;
  choices?: DialogueChoice[];
}

export interface DialogueChoice {
  id: string;
  label: string;
  questId?: string;
}

export interface DialogueQuestHook {
  questId?: string;
  onCompleteEvent?: string;
}

export interface DialogueSession {
  npcId: string;
  npcName: string;
  portraitUrl: string;
  pages: DialoguePage[];
  pageIndex: number;
  questHook?: DialogueQuestHook;
  /** Ação de missão na última página (aceitar / entregar). */
  questAction?: DialogueQuestAction;
}

export interface DialogueStoreState {
  session: DialogueSession | null;
}
