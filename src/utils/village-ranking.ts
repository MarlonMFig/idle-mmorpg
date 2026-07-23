import { VILLAGES } from '@/data/villages';
import type { VillageId, VillageRankEntry, VillageStanding } from '@/types/village';

export function buildSeedStandings(
  seed: Record<VillageId, Omit<VillageStanding, 'villageId'>>,
): Record<VillageId, VillageStanding> {
  const standings = {} as Record<VillageId, VillageStanding>;
  for (const village of VILLAGES) {
    const base = seed[village.id];
    standings[village.id] = {
      villageId: village.id,
      score: base.score,
      playerCount: base.playerCount,
    };
  }
  return standings;
}

/** Ranking por pontuação (desc), desempate por jogadores. */
export function rankVillages(
  standings: Record<VillageId, VillageStanding>,
): VillageRankEntry[] {
  const sorted = [...VILLAGES]
    .map((village) => {
      const standing = standings[village.id];
      return {
        villageId: village.id,
        name: village.name,
        shortLabel: village.shortLabel,
        score: standing?.score ?? 0,
        playerCount: standing?.playerCount ?? 0,
        rank: 0,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.playerCount - a.playerCount;
    });

  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function getVillageRank(
  standings: Record<VillageId, VillageStanding>,
  villageId: VillageId,
): number {
  return rankVillages(standings).find((entry) => entry.villageId === villageId)?.rank ?? 0;
}
