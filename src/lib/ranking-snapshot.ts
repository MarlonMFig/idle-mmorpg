import { getTitleDefinition } from '@/data/achievements/title-registry';
import { attributesStore } from '@/stores/attributes-store';
import { achievementsStore } from '@/stores/achievements-store';
import { accountStore } from '@/stores/account-store';
import { bossStore } from '@/stores/boss-store';
import { gemStore } from '@/stores/gem-store';
import { guildStore } from '@/stores/guild-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import { getActiveLineageProgress } from '@/lib/lineage-progress';
import { resolveSocialProviderMode } from '@/config/social-backend';
import { getAuthPlayerId } from '@/lib/auth/player-identity';
import { decimalToUnsafeNumber } from '@/lib/decimal';
import {
  computeCollectionRarityScore,
  computeProvisionalAccountPower,
  computeTotalMastery,
  computeTotalXp,
  computeUniqueCharacters,
} from '@/lib/ranking-metrics';
import type { RankingPlayerProfile } from '@/types/ranking';

/**
 * Snapshot derivado das fontes oficiais.
 * Não inclui inventário, save completo ou posição de rank.
 */
export function buildMyRankingProfile(nicknameFallback = 'Jogador'): RankingPlayerProfile {
  guildStore.ensurePlayerId();
  let playerId = guildStore.getSnapshot().playerId ?? 'local-player';
  if (resolveSocialProviderMode() === 'backend') {
    const authPlayerId = getAuthPlayerId();
    if (authPlayerId) playerId = authPlayerId;
  }
  const nickname =
    guildStore.getSnapshot().nickname?.trim() || nicknameFallback.trim() || 'Jogador';

  const vitals = vitalsStore.getSnapshot();
  const collection = teamStore.getSnapshot().collection;
  const totalMastery = computeTotalMastery(collection);
  const uniqueCharacters = computeUniqueCharacters(collection);
  const collectionRarityScore = computeCollectionRarityScore(collection);
  const onlineKills = gemStore.getSnapshot().totalKills;
  const account = accountStore.getLineageProgress();
  const lineage = getActiveLineageProgress(account);
  const active = teamStore.getActive();

  const accountPower = computeProvisionalAccountPower({
    playerLevel: vitals.level,
    totalMastery,
    uniqueCharacters,
    onlineKills,
    activeStrength: attributesStore.getStrength(),
    activeDefense: attributesStore.getDefense(),
    activeSpeed: attributesStore.getSpeed(),
    activeAwakening: active?.awakeningLevel ?? 0,
    lineageRank: lineage.rank,
  });

  const bossBest: RankingPlayerProfile['bossBest'] = {};
  const progress = bossStore.getPersistedProgress();
  for (const [bossId, row] of Object.entries(progress.bestResult)) {
    bossBest[bossId] = {
      bestTimeMs: row.bestTimeMs,
      bestDamage: row.bestDamage,
      victory: Boolean(progress.defeatedBosses[bossId]),
    };
  }

  const titleId = achievementsStore.getEquippedTitleId();

  return {
    playerId,
    nickname,
    playerLevel: vitals.level,
    levelXp: decimalToUnsafeNumber(vitals.xp),
    totalXp: computeTotalXp(vitals.level, vitals.xp),
    accountPower,
    accountPowerProvisional: true,
    totalMastery,
    uniqueCharacters,
    collectionRarityScore,
    onlineKills,
    lineageId: account.lineageId,
    lineageRank: lineage.rank,
    specializationId: lineage.selectedSpecializationId,
    specializationLevel: lineage.specializationLevel,
    lineageOnlineKills: lineage.onlineKills,
    equippedTitleId: titleId && getTitleDefinition(titleId) ? titleId : null,
    bossBest,
  };
}
