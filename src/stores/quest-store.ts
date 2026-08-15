import {
  getQuest,
  listQuestsForNpc,
  listQuestsWithTalkTarget,
  QUEST_DEFINITIONS,
} from '@/data/quests';
import { getItem } from '@/data/items';
import { onItemGained } from '@/lib/item-events';
import { createStore } from '@/stores/create-store';
import { inventoryStore } from '@/stores/inventory-store';
import { villageStore } from '@/stores/village-store';
import { grantPlayerXp } from '@/lib/grant-player-xp';
import type {
  DialogueQuestAction,
  QuestDefinition,
  QuestLogState,
  QuestProgress,
  QuestStatus,
} from '@/types/quest';
import {
  areAllObjectivesComplete,
  emptyCounts,
  matchesKillTarget,
  resolveQuestStatus,
} from '@/utils/quest';

const store = createStore<QuestLogState>({
  progress: {},
  isOpen: true,
});

function updateProgress(questId: string, patch: QuestProgress): void {
  const state = store.getSnapshot();
  store.setState({
    ...state,
    progress: { ...state.progress, [questId]: patch },
  });
}

function refreshReadyState(questId: string): void {
  const state = store.getSnapshot();
  const quest = getQuest(questId);
  const entry = state.progress[questId];
  if (!quest || !entry || entry.status === 'completed') return;

  const complete = areAllObjectivesComplete(quest, entry.counts);
  const nextStatus = complete ? 'ready' : 'active';
  if (entry.status === nextStatus) return;
  updateProgress(questId, { ...entry, status: nextStatus });
}

function bumpObjective(questId: string, objectiveId: string, amount = 1): void {
  const state = store.getSnapshot();
  const quest = getQuest(questId);
  const entry = state.progress[questId];
  if (!quest || !entry || entry.status === 'completed' || entry.status === 'ready') return;

  const objective = quest.objectives.find((item) => item.id === objectiveId);
  if (!objective) return;

  const current = entry.counts[objectiveId] ?? 0;
  if (current >= objective.amount) return;

  const counts = {
    ...entry.counts,
    [objectiveId]: Math.min(objective.amount, current + amount),
  };
  updateProgress(questId, { ...entry, counts });
  refreshReadyState(questId);
}

/**
 * Missões — progresso, recompensas e cadeias (requires/next).
 */
export const questStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({ progress: {}, isOpen: true });
  },

  toggleOpen(): void {
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setOpen(isOpen: boolean): void {
    store.setState({ ...store.getSnapshot(), isOpen });
  },

  getStatus(questId: string): QuestStatus {
    const quest = getQuest(questId);
    if (!quest) return 'locked';
    return resolveQuestStatus(quest, store.getSnapshot().progress);
  },

  getProgress(questId: string): QuestProgress | undefined {
    return store.getSnapshot().progress[questId];
  },

  listTracked(): QuestProgress[] {
    return Object.values(store.getSnapshot().progress).filter(
      (entry) => entry.status === 'active' || entry.status === 'ready',
    );
  },

  listAllWithStatus(): { quest: QuestDefinition; status: QuestStatus }[] {
    return QUEST_DEFINITIONS.map((quest) => ({
      quest,
      status: resolveQuestStatus(quest, store.getSnapshot().progress),
    }));
  },

  /** Missão principal a oferecer/entregar neste NPC (prioridade: ready > available > active). */
  getPrimaryNpcQuest(npcId: string): {
    quest: QuestDefinition;
    status: QuestStatus;
  } | null {
    const progress = store.getSnapshot().progress;
    const quests = listQuestsForNpc(npcId);
    const ranked = quests
      .map((quest) => ({ quest, status: resolveQuestStatus(quest, progress) }))
      .filter((entry) => entry.status !== 'locked');

    const ready = ranked.find((entry) => entry.status === 'ready');
    if (ready) return ready;
    const available = ranked.find((entry) => entry.status === 'available');
    if (available) return available;
    const active = ranked.find((entry) => entry.status === 'active');
    if (active) return active;
    const completed = ranked.find((entry) => entry.status === 'completed');
    return completed ?? null;
  },

  getDialogueAction(npcId: string): DialogueQuestAction | null {
    const primary = this.getPrimaryNpcQuest(npcId);
    if (!primary) return null;
    if (primary.status === 'available') {
      return { type: 'accept', questId: primary.quest.id };
    }
    if (primary.status === 'ready') {
      return { type: 'turnIn', questId: primary.quest.id };
    }
    return null;
  },

  acceptQuest(questId: string): boolean {
    const quest = getQuest(questId);
    if (!quest) return false;
    if (this.getStatus(questId) !== 'available') return false;

    updateProgress(questId, {
      questId,
      status: 'active',
      counts: emptyCounts(quest),
    });

    // Coleta: sincroniza com inventário atual.
    for (const objective of quest.objectives) {
      if (objective.kind !== 'collect') continue;
      const owned = countInventoryItem(objective.targetId);
      if (owned > 0) {
        bumpObjective(questId, objective.id, Math.min(owned, objective.amount));
      }
    }

    return true;
  },

  turnInQuest(questId: string): boolean {
    const quest = getQuest(questId);
    const entry = store.getSnapshot().progress[questId];
    if (!quest || !entry || entry.status !== 'ready') return false;

    // Consome itens de coleta.
    for (const objective of quest.objectives) {
      if (objective.kind !== 'collect') continue;
      if (!consumeInventoryItems(objective.targetId, objective.amount)) {
        return false;
      }
    }

    grantRewards(quest);
    updateProgress(questId, { ...entry, status: 'completed' });

    // Cadeia: a próxima fica `available` automaticamente (sem progresso até aceitar).
    if (quest.nextQuestId && getQuest(quest.nextQuestId)) {
      // Nada a gravar — resolveQuestStatus libera via requiresQuestId.
    }

    return true;
  },

  onEnemyKilled(enemyId: string, enemyName: string): void {
    for (const entry of Object.values(store.getSnapshot().progress)) {
      if (entry.status !== 'active') continue;
      const quest = getQuest(entry.questId);
      if (!quest) continue;

      for (const objective of quest.objectives) {
        if (objective.kind !== 'kill') continue;
        if (!matchesKillTarget(enemyId, enemyName, objective.targetId)) continue;
        bumpObjective(quest.id, objective.id, 1);
      }
    }
  },

  onNpcTalk(npcId: string): void {
    // Objetivos "talk" em missões ativas (giver pode ser outro NPC).
    for (const quest of listQuestsWithTalkTarget(npcId)) {
      const entry = store.getSnapshot().progress[quest.id];
      if (!entry || entry.status !== 'active') continue;
      for (const objective of quest.objectives) {
        if (objective.kind === 'talk' && objective.targetId === npcId) {
          bumpObjective(quest.id, objective.id, 1);
        }
      }
    }
  },

  onItemGained(itemId: string, quantity: number): void {
    if (quantity <= 0) return;
    for (const entry of Object.values(store.getSnapshot().progress)) {
      if (entry.status !== 'active') continue;
      const quest = getQuest(entry.questId);
      if (!quest) continue;
      for (const objective of quest.objectives) {
        if (objective.kind === 'collect' && objective.targetId === itemId) {
          bumpObjective(quest.id, objective.id, quantity);
        }
      }
    }
  },
};

function countInventoryItem(itemId: string): number {
  const { slots } = inventoryStore.getSnapshot();
  return slots.reduce((sum, slot) => {
    if (!slot || slot.itemId !== itemId) return sum;
    return sum + slot.quantity;
  }, 0);
}

function consumeInventoryItems(itemId: string, amount: number): boolean {
  if (countInventoryItem(itemId) < amount) return false;
  let remaining = amount;
  const { slots } = inventoryStore.getSnapshot();

  for (let i = 0; i < slots.length && remaining > 0; i += 1) {
    const slot = slots[i];
    if (!slot || slot.itemId !== itemId) continue;
    const remove = Math.min(slot.quantity, remaining);
    inventoryStore.discardSlot(i, remove);
    remaining -= remove;
  }

  return remaining <= 0;
}

function grantRewards(quest: QuestDefinition): void {
  if (quest.rewards.xp > 0) {
    grantPlayerXp(quest.rewards.xp);
    villageStore.onQuestCompleted(quest.rewards.xp);
  }

  for (const item of quest.rewards.items ?? []) {
    if (!getItem(item.itemId)) continue;
    inventoryStore.addItem(item.itemId, item.quantity);
  }
}

onItemGained((itemId, qty) => questStore.onItemGained(itemId, qty));
