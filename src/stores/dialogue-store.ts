import { createStore } from '@/stores/create-store';
import { questStore } from '@/stores/quest-store';
import type { DialogueSession, DialogueStoreState } from '@/types/dialogue';
import type { NpcDefinition } from '@/types/npc';

const store = createStore<DialogueStoreState>({ session: null });

/** Monta sessão com diálogo dinâmico de missão (se houver). */
export function sessionFromNpc(npc: NpcDefinition): DialogueSession {
  questStore.onNpcTalk(npc.id);

  const primary = questStore.getPrimaryNpcQuest(npc.id);
  const action = questStore.getDialogueAction(npc.id);

  if (primary) {
    const { quest, status } = primary;
    let lines = npc.dialogue;
    if (status === 'available') lines = quest.dialogue.offer;
    else if (status === 'active') lines = quest.dialogue.active;
    else if (status === 'ready') lines = quest.dialogue.turnIn;
    else if (status === 'completed') {
      lines = quest.dialogue.completed?.length ? quest.dialogue.completed : npc.dialogue;
    }

    return {
      npcId: npc.id,
      npcName: npc.name,
      portraitUrl: npc.portraitUrl,
      pages: lines.map((text) => ({ text })),
      pageIndex: 0,
      questHook: { questId: quest.id },
      questAction: action ?? undefined,
    };
  }

  return {
    npcId: npc.id,
    npcName: npc.name,
    portraitUrl: npc.portraitUrl,
    pages: npc.dialogue.map((text) => ({ text })),
    pageIndex: 0,
    questHook: npc.questHook,
  };
}

/**
 * Store de diálogo compartilhada (React ↔ Phaser).
 */
export const dialogueStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  isOpen(): boolean {
    return store.getSnapshot().session != null;
  },

  open(session: DialogueSession): void {
    store.setState({
      session: {
        ...session,
        pageIndex: 0,
        pages: session.pages.length > 0 ? session.pages : [{ text: '…' }],
      },
    });
  },

  openFromNpc(npc: NpcDefinition): void {
    this.open(sessionFromNpc(npc));
  },

  continue(): void {
    const session = store.getSnapshot().session;
    if (!session) return;

    if (session.pageIndex < session.pages.length - 1) {
      store.setState({
        session: { ...session, pageIndex: session.pageIndex + 1 },
      });
      return;
    }

    store.setState({ session: null });
  },

  /** Aceita ou entrega missão a partir do botão da janela. */
  resolveQuestAction(): void {
    const session = store.getSnapshot().session;
    if (!session?.questAction) return;

    const { questAction } = session;
    if (questAction.type === 'accept') {
      questStore.acceptQuest(questAction.questId);
    } else if (questAction.type === 'turnIn') {
      questStore.turnInQuest(questAction.questId);
    }

    store.setState({ session: null });
  },

  close(): void {
    store.setState({ session: null });
  },
};
