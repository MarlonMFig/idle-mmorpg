import { emitLineageRankPromoted } from '@/lib/lineage-events';
import {
  evaluateLineageRankRequirements,
  type LineageRankEvaluation,
} from '@/lib/lineage-rank-evaluation';
import {
  getLineageIdProgress,
  setLineageIdProgress,
} from '@/lib/lineage-progress';
import { accountStore } from '@/stores/account-store';
import { teamStore } from '@/stores/team-store';
import type { LineageId } from '@/types/character-meta';
import type { LineageRankIndex } from '@/types/lineage';

export type PromoteLineageRankResult =
  | {
      ok: true;
      lineageId: LineageId;
      oldRank: number;
      newRank: LineageRankIndex;
    }
  | {
      ok: false;
      missing: string[];
      evaluation: LineageRankEvaluation;
    };

const inFlight = new Set<string>();

/**
 * Promoção manual — revalida requisitos no serviço. Transação atômica.
 */
export function promoteLineageRank(lineageId?: LineageId): PromoteLineageRankResult {
  const progress = accountStore.getLineageProgress();
  const id = lineageId ?? progress.lineageId;
  if (!id) {
    return {
      ok: false,
      missing: ['Nenhuma Linhagem ativa'],
      evaluation: {
        eligible: false,
        maxed: false,
        currentRank: 0,
        targetRank: null,
        requirements: [],
        missing: ['Nenhuma Linhagem ativa'],
      },
    };
  }
  if (inFlight.has(id)) {
    return {
      ok: false,
      missing: ['Promoção em andamento'],
      evaluation: {
        eligible: false,
        maxed: false,
        currentRank: getLineageIdProgress(progress, id).rank,
        targetRank: null,
        requirements: [],
        missing: ['Promoção em andamento'],
      },
    };
  }

  inFlight.add(id);
  try {
    const evaluation = evaluateLineageRankRequirements({
      lineageId: id,
      progress,
      collection: teamStore.getSnapshot().collection,
    });
    if (!evaluation.eligible || !evaluation.targetRank) {
      return { ok: false, missing: evaluation.missing, evaluation };
    }

    const current = getLineageIdProgress(progress, id);
    const newRank = evaluation.targetRank;
    const next = setLineageIdProgress(progress, id, { rank: newRank });
    accountStore.applyLineageProgress(next);

    emitLineageRankPromoted({
      lineageId: id,
      oldRank: current.rank,
      newRank,
    });

    return { ok: true, lineageId: id, oldRank: current.rank, newRank };
  } finally {
    inFlight.delete(id);
  }
}

export function canPromoteLineageRank(lineageId?: LineageId): LineageRankEvaluation {
  const progress = accountStore.getLineageProgress();
  const id = lineageId ?? progress.lineageId;
  if (!id) {
    return {
      eligible: false,
      maxed: false,
      currentRank: 0,
      targetRank: null,
      requirements: [],
      missing: ['Nenhuma Linhagem ativa'],
    };
  }
  return evaluateLineageRankRequirements({
    lineageId: id,
    progress,
    collection: teamStore.getSnapshot().collection,
  });
}

/** +1 kill ONLINE para a Linhagem ativa. Lab/offline não chamam. */
export function grantLineageOnlineKill(kills = 1, _options?: { force?: boolean }): number {
  if (kills <= 0) return 0;
  const progress = accountStore.getLineageProgress();
  const lineageId = progress.lineageId;
  if (!lineageId) return 0;
  const current = getLineageIdProgress(progress, lineageId);
  const onlineKills = current.onlineKills + kills;
  let next = setLineageIdProgress(progress, lineageId, { onlineKills });
  const selected = current.selectedSpecializationId;
  if (selected) {
    const slot = current.specializationProgress[selected];
    const updated = getLineageIdProgress(next, lineageId);
    next = setLineageIdProgress(next, lineageId, {
      specializationProgress: {
        ...updated.specializationProgress,
        [selected]: { ...slot, onlineKills: slot.onlineKills + kills },
      },
    });
  }
  accountStore.applyLineageProgress(next);
  return kills;
}
