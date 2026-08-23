import {
  LINEAGE_RANK_REQUIREMENTS,
  type LineageRankRequirement,
} from '@/constants/lineage-rank-requirements';
import { computeLineageCollectionStats } from '@/lib/lineage-rank-stats';
import { getLineageIdProgress } from '@/lib/lineage-progress';
import type { LineageId } from '@/types/character-meta';
import type { LineageRankIndex, PlayerLineageProgress } from '@/types/lineage';
import type { SealedCharacter } from '@/types/team';
import { vitalsStore } from '@/stores/vitals-store';

export interface LineageRequirementProgress {
  type: string;
  label: string;
  current: number;
  required: number;
  completed: boolean;
}

export interface LineageRankEvaluation {
  eligible: boolean;
  maxed: boolean;
  currentRank: number;
  targetRank: LineageRankIndex | null;
  requirements: LineageRequirementProgress[];
  missing: string[];
}

function labelForRequirement(req: LineageRankRequirement, lineageId: LineageId): string {
  switch (req.type) {
    case 'playerLevel':
      return 'Player Level';
    case 'onlineKills':
      return 'Inimigos derrotados Online';
    case 'uniqueLineageCharacters':
      return `Personagens ${lineageId}`;
    case 'masteryCharacters':
      return `Maestria ${req.masteryLevel}+`;
    case 'starCharacters':
      return `${req.minStars}★ ou mais`;
    case 'huntsCompleted':
      return 'Hunts concluídas';
    default: {
      const _exhaustive: never = req;
      return String(_exhaustive);
    }
  }
}

/**
 * Avalia requisitos para promover de currentRank → currentRank+1.
 * targetRank explícito só para testes/DEV.
 */
export function evaluateLineageRankRequirements(input: {
  lineageId: LineageId;
  progress: PlayerLineageProgress;
  collection: readonly SealedCharacter[];
  targetRank?: LineageRankIndex;
  playerLevel?: number;
}): LineageRankEvaluation {
  const idProgress = getLineageIdProgress(input.progress, input.lineageId);
  const currentRank = idProgress.rank;
  const targetRank = input.targetRank ?? ((currentRank + 1) as LineageRankIndex);
  const empty: LineageRankEvaluation = {
    eligible: false,
    maxed: currentRank >= 4,
    currentRank,
    targetRank: null,
    requirements: [],
    missing: currentRank >= 4 ? ['Graduação máxima'] : ['Rank inválido'],
  };

  if (currentRank >= 4) return { ...empty, maxed: true, missing: ['Graduação máxima'] };
  if (
    !(targetRank === 2 || targetRank === 3 || targetRank === 4) ||
    targetRank !== currentRank + 1
  ) {
    return { ...empty, missing: ['Promoção inválida'] };
  }

  const reqs = LINEAGE_RANK_REQUIREMENTS[targetRank];
  const playerLevel = input.playerLevel ?? vitalsStore.getLevel();
  const onlineKills = idProgress.onlineKills;
  const stats = computeLineageCollectionStats(input.collection, input.lineageId);
  const requirements: LineageRequirementProgress[] = [];
  const missing: string[] = [];

  for (const req of reqs) {
    switch (req.type) {
      case 'playerLevel': {
        const completed = playerLevel >= req.value;
        requirements.push({
          type: req.type,
          label: labelForRequirement(req, input.lineageId),
          current: playerLevel,
          required: req.value,
          completed,
        });
        if (!completed) missing.push(`Player Level ${req.value}`);
        break;
      }
      case 'onlineKills': {
        const completed = onlineKills >= req.value;
        requirements.push({
          type: req.type,
          label: labelForRequirement(req, input.lineageId),
          current: onlineKills,
          required: req.value,
          completed,
        });
        if (!completed) missing.push(`${req.value} kills online`);
        break;
      }
      case 'uniqueLineageCharacters': {
        const completed = stats.uniqueCharacters >= req.value;
        requirements.push({
          type: req.type,
          label: labelForRequirement(req, input.lineageId),
          current: stats.uniqueCharacters,
          required: req.value,
          completed,
        });
        if (!completed) missing.push(`${req.value} personagens diferentes`);
        break;
      }
      case 'masteryCharacters': {
        const current = stats.masteryAtLeast(req.masteryLevel);
        const completed = current >= req.count;
        requirements.push({
          type: req.type,
          label: `${req.count} personagem(ns) Maestria ${req.masteryLevel}+`,
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
          label: `${req.count} personagem(ns) ${req.minStars}★+`,
          current,
          required: req.count,
          completed,
        });
        if (!completed) missing.push(`${req.minStars}★ (${req.count})`);
        break;
      }
      case 'huntsCompleted': {
        requirements.push({
          type: req.type,
          label: labelForRequirement(req, input.lineageId),
          current: 0,
          required: req.value,
          completed: false,
        });
        missing.push('Hunts não implementado');
        break;
      }
      default:
        break;
    }
  }

  return {
    eligible: missing.length === 0,
    maxed: false,
    currentRank,
    targetRank,
    requirements,
    missing,
  };
}
