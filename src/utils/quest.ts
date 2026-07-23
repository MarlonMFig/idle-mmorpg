import { getQuest } from '@/data/quests';
import type {
  QuestDefinition,
  QuestObjectiveDef,
  QuestProgress,
  QuestStatus,
} from '@/types/quest';

export function emptyCounts(quest: QuestDefinition): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const objective of quest.objectives) {
    counts[objective.id] = 0;
  }
  return counts;
}

export function isObjectiveComplete(
  objective: QuestObjectiveDef,
  count: number,
): boolean {
  return count >= objective.amount;
}

export function areAllObjectivesComplete(
  quest: QuestDefinition,
  counts: Record<string, number>,
): boolean {
  return quest.objectives.every((objective) =>
    isObjectiveComplete(objective, counts[objective.id] ?? 0),
  );
}

export function matchesKillTarget(enemyId: string, enemyName: string, targetId: string): boolean {
  const needle = targetId.toLowerCase();
  return enemyId.toLowerCase().includes(needle) || enemyName.toLowerCase().includes(needle);
}

export function resolveQuestStatus(
  quest: QuestDefinition,
  progress: Record<string, QuestProgress>,
): QuestStatus {
  const entry = progress[quest.id];
  if (entry?.status === 'completed') return 'completed';
  if (entry?.status === 'ready') return 'ready';
  if (entry?.status === 'active') return 'active';

  if (quest.requiresQuestId) {
    const required = progress[quest.requiresQuestId];
    if (!required || required.status !== 'completed') return 'locked';
  }

  return 'available';
}

export function getActiveQuests(progress: Record<string, QuestProgress>): QuestProgress[] {
  return Object.values(progress).filter(
    (entry) => entry.status === 'active' || entry.status === 'ready',
  );
}

export function formatObjectiveProgress(
  objective: QuestObjectiveDef,
  count: number,
): string {
  const current = Math.min(count, objective.amount);
  return `${objective.description} (${current}/${objective.amount})`;
}

export function getQuestTitle(questId: string): string {
  return getQuest(questId)?.name ?? questId;
}
