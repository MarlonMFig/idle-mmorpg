/** Status da missão para o jogador. */
export type QuestStatus = 'locked' | 'available' | 'active' | 'ready' | 'completed';

export type QuestObjectiveKind = 'kill' | 'talk' | 'collect';

export interface QuestObjectiveDef {
  id: string;
  kind: QuestObjectiveKind;
  description: string;
  /**
   * Alvo:
   * - kill: trecho do id/nome do inimigo (ex: `leaf-slime`)
   * - talk: id do NPC
   * - collect: id do item
   */
  targetId: string;
  amount: number;
}

export interface QuestItemReward {
  itemId: string;
  quantity: number;
}

export interface QuestRewards {
  xp: number;
  items?: QuestItemReward[];
}

export interface QuestDialogueSet {
  /** Diálogo ao oferecer a missão. */
  offer: string[];
  /** Enquanto objetivos estão em progresso. */
  active: string[];
  /** Objetivos cumpridos — pronto para entregar. */
  turnIn: string[];
  /** Já concluída. */
  completed?: string[];
}

/**
 * Definição estática de missão.
 * Cadeia: `requiresQuestId` + `nextQuestId`.
 */
export interface QuestDefinition {
  id: string;
  name: string;
  description: string;
  /** NPC que oferece e recebe a missão. */
  npcId: string;
  objectives: QuestObjectiveDef[];
  rewards: QuestRewards;
  dialogue: QuestDialogueSet;
  /** Missão anterior que precisa estar `completed`. */
  requiresQuestId?: string;
  /** Próxima missão liberada ao concluir (cadeia). */
  nextQuestId?: string;
}

/** Progresso runtime de uma missão aceita. */
export interface QuestProgress {
  questId: string;
  status: 'active' | 'ready' | 'completed';
  /** Contagem atual por objective.id */
  counts: Record<string, number>;
}

export interface QuestLogState {
  /** Progresso por questId. */
  progress: Record<string, QuestProgress>;
  isOpen: boolean;
}

export type DialogueQuestAction =
  | { type: 'accept'; questId: string }
  | { type: 'turnIn'; questId: string };
