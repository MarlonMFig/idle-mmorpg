import { getActiveLineageProgress } from '@/lib/lineage-progress';
import { resolveSpecializationKey } from '@/lib/lineage-specialization-migration';
import { accountStore } from '@/stores/account-store';
import { gemStore } from '@/stores/gem-store';
import { guildStore } from '@/stores/guild-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { AchievementWorldSnapshot } from '@/types/achievements';
import type { LineageSpecializationSlot } from '@/types/lineage';

/**
 * Monta snapshot a partir das fontes oficiais.
 * onlineKills = gemStore.totalKills (kills Online da conta; Offline não incrementa).
 * huntsCompleted = 0 até existir progresso oficial de Hunt.
 */
export function buildAchievementWorldSnapshot(): AchievementWorldSnapshot {
  const collection = teamStore.getSnapshot().collection;
  const unique = new Set(collection.map((entry) => entry.characterId));
  let maxStars = 0;
  let maxMastery = 0;
  let maxAwakening = 0;
  for (const entry of collection) {
    maxStars = Math.max(maxStars, entry.stars ?? 0);
    maxMastery = Math.max(maxMastery, entry.masteryLevel ?? 0);
    maxAwakening = Math.max(maxAwakening, entry.awakeningLevel ?? 0);
  }

  const lineageProgress = accountStore.getLineageProgress();
  const active = getActiveLineageProgress(lineageProgress);
  const selected = active.selectedSpecializationId as LineageSpecializationSlot | null;
  const specLevel = selected
    ? active.specializationProgress[selected]?.level ?? active.specializationLevel
    : 0;
  const specKey =
    lineageProgress.lineageId && selected
      ? resolveSpecializationKey(lineageProgress.lineageId, selected)
      : null;

  return {
    playerLevel: vitalsStore.getLevel(),
    onlineKills: gemStore.getSnapshot().totalKills,
    uniqueCharacters: unique.size,
    maxStars,
    maxMastery,
    maxAwakening,
    hasLineage: lineageProgress.lineageId != null,
    lineageId: lineageProgress.lineageId,
    lineageRank: active.rank,
    hasSpecialization: selected != null,
    specializationLevel: specLevel,
    specializationKey: specKey,
    inGuild: guildStore.getSnapshot().guildId != null,
    huntsCompleted: 0,
  };
}
