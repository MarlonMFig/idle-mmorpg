import { CHARACTER_QUALITIES, type CharacterQuality } from '@/types/character-meta';
import type { SealedCharacter } from '@/types/team';
import type { RankingMetricId, RankingPlayerProfile } from '@/types/ranking';
import { getTotalXpToReachLevel } from '@/lib/player-progression';

const QUALITY_SCORE: Record<CharacterQuality, number> = {
  D: 1,
  C: 2,
  B: 4,
  A: 8,
  S: 16,
  SS: 32,
  SSS: 64,
};

/** Melhor instância por CharacterDefinition (maestria, depois estrelas). */
export function bestInstancesByDefinition(
  collection: readonly SealedCharacter[],
): Map<string, SealedCharacter> {
  const map = new Map<string, SealedCharacter>();
  for (const entry of collection) {
    const prev = map.get(entry.characterId);
    if (!prev) {
      map.set(entry.characterId, entry);
      continue;
    }
    const prevM = prev.masteryLevel ?? 0;
    const nextM = entry.masteryLevel ?? 0;
    const prevS = prev.stars ?? 0;
    const nextS = entry.stars ?? 0;
    if (nextM > prevM || (nextM === prevM && nextS > prevS)) {
      map.set(entry.characterId, entry);
    }
  }
  return map;
}

/**
 * Total Mastery da conta:
 * soma da Maestria da MELHOR instância de cada CharacterDefinition.
 * Duplicatas do mesmo definition NÃO somam.
 */
export function computeTotalMastery(collection: readonly SealedCharacter[]): number {
  let total = 0;
  for (const entry of bestInstancesByDefinition(collection).values()) {
    total += entry.masteryLevel ?? 0;
  }
  return total;
}

export function computeUniqueCharacters(collection: readonly SealedCharacter[]): number {
  return bestInstancesByDefinition(collection).size;
}

/** Desempate Collection: soma de raridade das melhores instâncias únicas. */
export function computeCollectionRarityScore(collection: readonly SealedCharacter[]): number {
  let score = 0;
  for (const entry of bestInstancesByDefinition(collection).values()) {
    const q = entry.quality;
    if (CHARACTER_QUALITIES.includes(q)) score += QUALITY_SCORE[q];
  }
  return score;
}

export function computeTotalXp(playerLevel: number, levelXp: number): number {
  return getTotalXpToReachLevel(Math.max(1, playerLevel)) + Math.max(0, levelXp);
}

/**
 * Account Power — PROVISÓRIO (DEV / validação de UI).
 * Não existe fórmula oficial de combatPower/accountPower no jogo.
 * NÃO usar para balanceamento definitivo.
 *
 * Pesos temporários:
 * level×120 + totalMastery×8 + unique×40 + onlineKills×0.05
 * + activeStrength/Defense/Speed + activeAwakening×25 + lineageRank×80
 */
export function computeProvisionalAccountPower(input: {
  playerLevel: number;
  totalMastery: number;
  uniqueCharacters: number;
  onlineKills: number;
  activeStrength: number;
  activeDefense: number;
  activeSpeed: number;
  activeAwakening: number;
  lineageRank: number;
}): number {
  const raw =
    input.playerLevel * 120 +
    input.totalMastery * 8 +
    input.uniqueCharacters * 40 +
    input.onlineKills * 0.05 +
    input.activeStrength * 2 +
    input.activeDefense * 2 +
    input.activeSpeed * 1.5 +
    input.activeAwakening * 25 +
    input.lineageRank * 80;
  return Math.max(0, Math.floor(raw));
}

/** Chave composta para ordenação de Linhagem (rank >> spec >> kills). */
export function lineageCompositeValue(
  lineageRank: number,
  specializationLevel: number,
  lineageOnlineKills: number,
): number {
  return lineageRank * 1_000_000_000 + specializationLevel * 1_000_000 + lineageOnlineKills;
}

export function profilePrimaryValue(
  profile: RankingPlayerProfile,
  metric: RankingMetricId,
  opts?: { bossId?: string | null; rankingMode?: 'fastestKill' | 'highestDamage' | 'none' },
): number | null {
  switch (metric) {
    case 'accountPower':
      return profile.accountPower;
    case 'playerLevel':
      return profile.playerLevel;
    case 'totalMastery':
      return profile.totalMastery;
    case 'uniqueCharacters':
      return profile.uniqueCharacters;
    case 'onlineKills':
      return profile.onlineKills;
    case 'lineageComposite':
      if (!profile.lineageId) return null;
      return lineageCompositeValue(
        profile.lineageRank,
        profile.specializationLevel,
        profile.lineageOnlineKills,
      );
    case 'bossBest': {
      const bossId = opts?.bossId;
      if (!bossId) return null;
      const best = profile.bossBest[bossId];
      if (!best) return null;
      const mode = opts?.rankingMode ?? 'fastestKill';
      if (mode === 'none') return null;
      if (mode === 'fastestKill') {
        if (!best.victory || best.bestTimeMs == null) return null;
        return best.bestTimeMs;
      }
      return best.bestDamage;
    }
    default:
      return null;
  }
}
