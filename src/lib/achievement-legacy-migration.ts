/**
 * Item 38 — Migration Achievement legado (gem-store) → achievementsStore oficial.
 *
 * Mapping explícito por ID (não por texto).
 * Legacy unlock() marcava claimed + concedia Gems de imediato.
 * Migration só move estado — NUNCA concede reward.
 */

import type { AchievementProgressState } from '@/types/achievements';

/** legacyAchievementId → officialAchievementId */
export const LEGACY_TO_OFFICIAL_ACHIEVEMENT: Readonly<Record<string, string>> = {
  'ach-kills-100': 'online-kills-100',
  'ach-kills-1000': 'online-kills-1000',
  'ach-kills-10000': 'online-kills-10000',
  'ach-level-10': 'player-level-10',
  'ach-level-25': 'player-level-25',
  'ach-level-50': 'player-level-50',
  'ach-level-100': 'player-level-100',
};

export interface LegacyAchievementClaimMap {
  /** IDs legacy com claimed=true (unlock+reward já aplicados no sistema antigo). */
  claimedAchievements: Record<string, boolean>;
}

export interface AchievementLegacyMigrationResult {
  /** Progresso oficial após merge (não grava sozinho). */
  progress: AchievementProgressState;
  /** IDs oficiais marcados unlocked por esta migration. */
  unlockedFromLegacy: string[];
  /** IDs oficiais marcados claimed por esta migration. */
  claimedFromLegacy: string[];
  /** Legacy IDs sem equivalente — reportados, não inventados. */
  unmappedLegacyIds: string[];
  /** Se houve qualquer alteração no progresso. */
  changed: boolean;
}

function trueKeys(
  map: Record<string, boolean> | Record<string, true> | null | undefined,
): string[] {
  if (!map) return [];
  return Object.keys(map).filter((k) => map[k]);
}

/**
 * Merge idempotente: legacy claimed ⇒ official unlocked+claimed.
 * Official claimed prevalece (união). Não concede copper/gems.
 */
export function mergeLegacyGemAchievements(
  official: AchievementProgressState,
  legacy: LegacyAchievementClaimMap | null | undefined,
): AchievementLegacyMigrationResult {
  const unlocked: Record<string, true> = { ...official.unlocked };
  const claimed: Record<string, true> = { ...official.claimed };
  const unlockedTitles: Record<string, true> = { ...official.unlockedTitles };
  const unlockedFromLegacy: string[] = [];
  const claimedFromLegacy: string[] = [];
  const unmappedLegacyIds: string[] = [];

  const legacyClaimed = trueKeys(legacy?.claimedAchievements);
  for (const legacyId of legacyClaimed) {
    const officialId = LEGACY_TO_OFFICIAL_ACHIEVEMENT[legacyId];
    if (!officialId) {
      unmappedLegacyIds.push(legacyId);
      continue;
    }
    if (!unlocked[officialId]) {
      unlocked[officialId] = true;
      unlockedFromLegacy.push(officialId);
    }
    if (!claimed[officialId]) {
      claimed[officialId] = true;
      claimedFromLegacy.push(officialId);
    }
    // claimed implica unlocked
    unlocked[officialId] = true;
  }

  const changed = unlockedFromLegacy.length > 0 || claimedFromLegacy.length > 0;

  return {
    progress: {
      unlocked,
      claimed,
      unlockedTitles,
      equippedTitleId: official.equippedTitleId,
    },
    unlockedFromLegacy,
    claimedFromLegacy,
    unmappedLegacyIds,
    changed,
  };
}

/** True se ainda há mapa legado não-vazio a migrar. */
export function hasPendingLegacyAchievementClaims(
  claimedAchievements: Record<string, boolean> | null | undefined,
): boolean {
  return trueKeys(claimedAchievements).length > 0;
}
