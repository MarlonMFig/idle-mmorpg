import { isCharacterLabSession, characterLabStore } from '@/stores/character-lab-store';
import { accountStore } from '@/stores/account-store';
import {
  cloneDefaultSpecializationProgress,
  getActiveLineageProgress,
} from '@/lib/lineage-progress';
import type { LineageId } from '@/types/character-meta';
import type { LineageSpecializationSlot, PlayerLineageProgress } from '@/types/lineage';

export interface LineageRuntimeContext {
  progress: PlayerLineageProgress;
  /** Campos da Linhagem ativa (ou preview) para UI legível. */
  active: {
    lineageId: LineageId | null;
    rank: number;
    onlineKills: number;
    selectedSpecializationId: LineageSpecializationSlot | null;
    specializationLevel: number;
    specializationOnlineKills: number;
  };
  preview: boolean;
}

/**
 * Conta real ou preview DEV Lab. Preview não grava save.
 */
export function resolveLineageRuntime(): LineageRuntimeContext {
  if (isCharacterLabSession()) {
    const lab = characterLabStore.getSnapshot();
    if (lab.previewLineageId) {
      const specProgress = cloneDefaultSpecializationProgress();
      if (lab.previewSpecializationId) {
        specProgress[lab.previewSpecializationId] = {
          level: lab.previewSpecializationLevel,
          onlineKills: 0,
        };
      }
      return {
        progress: {
          lineageId: lab.previewLineageId,
          byLineage: {
            [lab.previewLineageId]: {
              rank: lab.previewLineageRank,
              onlineKills: 0,
              selectedSpecializationId: lab.previewSpecializationId,
              specializationLevel: lab.previewSpecializationLevel,
              specializationProgress: specProgress,
            },
          },
        },
        active: {
          lineageId: lab.previewLineageId,
          rank: lab.previewLineageRank,
          onlineKills: 0,
          selectedSpecializationId: lab.previewSpecializationId,
          specializationLevel: lab.previewSpecializationLevel,
          specializationOnlineKills: 0,
        },
        preview: true,
      };
    }
  }
  const progress = accountStore.getLineageProgress();
  const idProgress = getActiveLineageProgress(progress);
  const selected = idProgress.selectedSpecializationId;
  return {
    progress,
    active: {
      lineageId: progress.lineageId,
      rank: idProgress.rank,
      onlineKills: idProgress.onlineKills,
      selectedSpecializationId: selected,
      specializationLevel: idProgress.specializationLevel,
      specializationOnlineKills: selected
        ? idProgress.specializationProgress[selected].onlineKills
        : 0,
    },
    preview: false,
  };
}

export function getPlayerLineageId(): LineageId | null {
  return resolveLineageRuntime().active.lineageId;
}
