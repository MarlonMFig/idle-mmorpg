import { getActiveLineageProgress } from '@/lib/lineage-progress';
import { accountStore } from '@/stores/account-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { MissionWorldSnapshot } from '@/types/missions';

export function buildMissionWorldSnapshot(): MissionWorldSnapshot {
  const collection = teamStore.getSnapshot().collection;
  const unique = new Set(collection.map((entry) => entry.characterId));
  let maxCharacterLevel = 1;
  let maxStars = 0;
  let maxMastery = 0;
  for (const entry of collection) {
    maxCharacterLevel = Math.max(maxCharacterLevel, entry.level ?? 1);
    maxStars = Math.max(maxStars, entry.stars ?? 0);
    maxMastery = Math.max(maxMastery, entry.masteryLevel ?? 0);
  }

  const lineageProgress = accountStore.getLineageProgress();
  const active = getActiveLineageProgress(lineageProgress);
  const selected = active.selectedSpecializationId;
  const specLevel = selected
    ? active.specializationProgress[selected]?.level ?? active.specializationLevel
    : 0;

  return {
    playerLevel: vitalsStore.getLevel(),
    maxCharacterLevel,
    maxMastery,
    maxStars,
    maxAwakening: 0,
    uniqueCharacters: unique.size,
    hasLineage: lineageProgress.lineageId != null,
    lineageId: lineageProgress.lineageId,
    lineageRank: active.rank,
    hasSpecialization: selected != null,
    specializationLevel: specLevel,
  };
}
