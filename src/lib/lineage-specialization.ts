import { LINEAGE_SPECIALIZATION_UNLOCK_RANK } from '@/constants/lineage-rank-requirements';
import {
  emitLineageSpecializationLeveled,
  emitLineageSpecializationSelected,
} from '@/lib/lineage-events';
import { evaluateLineageSpecializationRequirements } from '@/lib/lineage-specialization-evaluation';
import {
  getLineageIdProgress,
  patchSpecializationSlot,
  setLineageIdProgress,
} from '@/lib/lineage-progress';
import { accountStore } from '@/stores/account-store';
import { attributesStore } from '@/stores/attributes-store';
import { teamStore } from '@/stores/team-store';
import type { LineageId } from '@/types/character-meta';
import type { LineageSpecializationSlot } from '@/types/lineage';

export type SelectLineageSpecializationResult =
  | { ok: true; lineageId: LineageId; specializationId: LineageSpecializationSlot }
  | { ok: false; missing: string[] };

export type EvolveLineageSpecializationResult =
  | {
      ok: true;
      lineageId: LineageId;
      specializationId: LineageSpecializationSlot;
      oldLevel: number;
      newLevel: number;
    }
  | { ok: false; missing: string[] };

function refreshAttributes(): void {
  try {
    attributesStore.recalculate(false);
  } catch {
    /* store pode não estar pronto em scripts */
  }
}

/**
 * Escolha inicial da especialização (Rank II+).
 * Não apaga progresso de outros caminhos.
 */
export function selectLineageSpecialization(
  specializationId: LineageSpecializationSlot,
  lineageId?: LineageId,
): SelectLineageSpecializationResult {
  const progress = accountStore.getLineageProgress();
  const id = lineageId ?? progress.lineageId;
  if (!id) return { ok: false, missing: ['Nenhuma Linhagem ativa'] };
  const current = getLineageIdProgress(progress, id);
  if (current.rank < LINEAGE_SPECIALIZATION_UNLOCK_RANK) {
    return { ok: false, missing: ['Alcance a segunda Graduação para desbloquear.'] };
  }
  if (current.selectedSpecializationId) {
    return { ok: false, missing: ['Especialização já selecionada'] };
  }
  const slot = current.specializationProgress[specializationId];
  const nextLevel = slot.level > 0 ? slot.level : 1;
  let next = setLineageIdProgress(progress, id, { selectedSpecializationId: specializationId });
  next = patchSpecializationSlot(next, id, specializationId, { level: nextLevel });
  accountStore.applyLineageProgress(next);
  emitLineageSpecializationSelected({ lineageId: id, specializationId });
  refreshAttributes();
  return { ok: true, lineageId: id, specializationId };
}

/**
 * Troca o caminho ativo sem apagar progresso. Sem custo neste item.
 */
export function respecSpecialization(
  specializationId: LineageSpecializationSlot,
  lineageId?: LineageId,
): SelectLineageSpecializationResult {
  const progress = accountStore.getLineageProgress();
  const id = lineageId ?? progress.lineageId;
  if (!id) return { ok: false, missing: ['Nenhuma Linhagem ativa'] };
  const current = getLineageIdProgress(progress, id);
  if (current.rank < LINEAGE_SPECIALIZATION_UNLOCK_RANK) {
    return { ok: false, missing: ['Alcance a segunda Graduação para desbloquear.'] };
  }
  const slot = current.specializationProgress[specializationId];
  const nextLevel = slot.level > 0 ? slot.level : 1;
  let next = setLineageIdProgress(progress, id, { selectedSpecializationId: specializationId });
  next = patchSpecializationSlot(next, id, specializationId, { level: nextLevel });
  accountStore.applyLineageProgress(next);
  emitLineageSpecializationSelected({ lineageId: id, specializationId });
  refreshAttributes();
  return { ok: true, lineageId: id, specializationId };
}

export function evolveLineageSpecialization(lineageId?: LineageId): EvolveLineageSpecializationResult {
  const progress = accountStore.getLineageProgress();
  const id = lineageId ?? progress.lineageId;
  if (!id) return { ok: false, missing: ['Nenhuma Linhagem ativa'] };
  const current = getLineageIdProgress(progress, id);
  const selected = current.selectedSpecializationId;
  if (!selected) return { ok: false, missing: ['Nenhuma especialização selecionada'] };

  const evaluation = evaluateLineageSpecializationRequirements({
    lineageId: id,
    progress,
    collection: teamStore.getSnapshot().collection,
  });
  if (!evaluation.eligible || !evaluation.targetLevel) {
    return { ok: false, missing: evaluation.missing };
  }

  const oldLevel = current.specializationProgress[selected].level;
  const newLevel = evaluation.targetLevel;
  const next = patchSpecializationSlot(progress, id, selected, { level: newLevel });
  accountStore.applyLineageProgress(next);
  emitLineageSpecializationLeveled({
    lineageId: id,
    specializationId: selected,
    oldLevel,
    newLevel,
  });
  refreshAttributes();
  return { ok: true, lineageId: id, specializationId: selected, oldLevel, newLevel };
}
