import { LINEAGE_SPECIALIZATION_LEVEL_REQUIREMENTS } from '@/constants/lineage-specialization';
import { computeLineageCollectionStats } from '@/lib/lineage-rank-stats';
import { getLineageIdProgress } from '@/lib/lineage-progress';
import type { LineageRequirementProgress } from '@/lib/lineage-rank-evaluation';
import type { LineageId } from '@/types/character-meta';
import type { LineageSpecializationLevelIndex, PlayerLineageProgress } from '@/types/lineage';
import type { SealedCharacter } from '@/types/team';

export interface LineageSpecializationEvaluation {
  eligible: boolean;
  maxed: boolean;
  locked: boolean;
  currentLevel: number;
  targetLevel: LineageSpecializationLevelIndex | null;
  requirements: LineageRequirementProgress[];
  missing: string[];
}

export function evaluateLineageSpecializationRequirements(input: {
  lineageId: LineageId;
  progress: PlayerLineageProgress;
  collection: readonly SealedCharacter[];
}): LineageSpecializationEvaluation {
  const idProgress = getLineageIdProgress(input.progress, input.lineageId);
  const selected = idProgress.selectedSpecializationId;
  const currentLevel = selected
    ? idProgress.specializationProgress[selected].level
    : 0;
  const empty = (missing: string[], extra?: Partial<LineageSpecializationEvaluation>): LineageSpecializationEvaluation => ({
    eligible: false,
    maxed: currentLevel >= 4,
    locked: false,
    currentLevel,
    targetLevel: null,
    requirements: [],
    missing,
    ...extra,
  });

  if (!selected) {
    return empty(['Nenhuma especialização selecionada'], { locked: idProgress.rank < 2 });
  }
  if (currentLevel >= 4) {
    return empty(['Especialização no nível máximo'], { maxed: true });
  }
  const targetLevel = (currentLevel + 1) as LineageSpecializationLevelIndex;
  if (!(targetLevel === 2 || targetLevel === 3 || targetLevel === 4)) {
    return empty(['Evolução inválida']);
  }

  const reqs = LINEAGE_SPECIALIZATION_LEVEL_REQUIREMENTS[targetLevel];
  const stats = computeLineageCollectionStats(input.collection, input.lineageId);
  const onlineKills = idProgress.specializationProgress[selected].onlineKills;
  const requirements: LineageRequirementProgress[] = [];
  const missing: string[] = [];

  for (const req of reqs) {
    switch (req.type) {
      case 'lineageRank': {
        const completed = idProgress.rank >= req.value;
        requirements.push({
          type: req.type,
          label: 'Graduação',
          current: idProgress.rank,
          required: req.value,
          completed,
        });
        if (!completed) missing.push(`Graduação ${req.value}`);
        break;
      }
      case 'specializationOnlineKills': {
        const completed = onlineKills >= req.value;
        requirements.push({
          type: req.type,
          label: 'Inimigos derrotados Online',
          current: onlineKills,
          required: req.value,
          completed,
        });
        if (!completed) missing.push(`${req.value} kills da especialização`);
        break;
      }
      case 'masteryCharacters': {
        const current = stats.masteryAtLeast(req.masteryLevel);
        const completed = current >= req.count;
        requirements.push({
          type: req.type,
          label: `Maestria ${req.masteryLevel}+`,
          current,
          required: req.count,
          completed,
        });
        if (!completed) missing.push(`Maestria ${req.masteryLevel} (${req.count})`);
        break;
      }
      case 'starCharacters': {
        const current = stats.starsAtLeast(req.minStars);
        const completed = current >= req.count;
        requirements.push({
          type: req.type,
          label: `${req.minStars}★ ou mais`,
          current,
          required: req.count,
          completed,
        });
        if (!completed) missing.push(`${req.minStars}★ (${req.count})`);
        break;
      }
      default:
        break;
    }
  }

  return {
    eligible: missing.length === 0,
    maxed: false,
    locked: false,
    currentLevel,
    targetLevel,
    requirements,
    missing,
  };
}
