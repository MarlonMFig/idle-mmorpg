import { getMaxStarsForRarity } from '@/config/gameConfig';
import { getInstanceLineageId } from '@/lib/lineage-compatibility';
import type { LineageId } from '@/types/character-meta';
import type { SealedCharacter } from '@/types/team';

export interface LineageCollectionStats {
  uniqueCharacters: number;
  masteryAtLeast: (level: number) => number;
  starsAtLeast: (minStars: number) => number;
}

/** Melhor instância por characterId (maestria / estrelas). */
function bestByCharacterId(
  collection: readonly SealedCharacter[],
  lineageId: LineageId,
): Map<string, SealedCharacter> {
  const map = new Map<string, SealedCharacter>();
  for (const entry of collection) {
    if (getInstanceLineageId(entry) !== lineageId) continue;
    const prev = map.get(entry.characterId);
    if (!prev) {
      map.set(entry.characterId, entry);
      continue;
    }
    const prevMastery = prev.masteryLevel ?? 0;
    const nextMastery = entry.masteryLevel ?? 0;
    const prevStars = prev.stars ?? 0;
    const nextStars = entry.stars ?? 0;
    if (nextMastery > prevMastery || (nextMastery === prevMastery && nextStars > prevStars)) {
      map.set(entry.characterId, entry);
    }
  }
  return map;
}

export function computeLineageCollectionStats(
  collection: readonly SealedCharacter[],
  lineageId: LineageId,
): LineageCollectionStats {
  const best = bestByCharacterId(collection, lineageId);
  const instances = [...best.values()];
  return {
    uniqueCharacters: instances.length,
    masteryAtLeast: (level: number) =>
      instances.filter((entry) => (entry.masteryLevel ?? 0) >= level).length,
    starsAtLeast: (minStars: number) =>
      instances.filter((entry) => {
        const cap = getMaxStarsForRarity(entry.quality);
        if (minStars > cap) return false;
        return (entry.stars ?? 0) >= minStars;
      }).length,
  };
}
