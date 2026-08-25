import { GAME_LIMITS, getMaxStarsForRarity } from '@/config/gameConfig';
import {
  CHARACTER_QUALITY_RANK_LABELS,
} from '@/constants/character-progression';
import { formatQualityStatMultiplier } from '@/constants/character-quality-stats';
import { LINEAGE_LABELS } from '@/constants/lineage';
import { getInstanceLineageId } from '@/lib/lineage-compatibility';
import type { SealedCharacter } from '@/types/team';

/** Nível do personagem (próprio; fallback 1). */
export function displayLevelForCharacter(memberLevel: number): number {
  return Math.max(1, Math.floor(memberLevel || 1));
}

export function formatStars(stars: number, maxStars?: number): string {
  const max = Math.max(0, Math.floor(maxStars ?? GAME_LIMITS.absoluteMaxStars));
  const n = Math.max(0, Math.min(max, Math.floor(stars)));
  if (max <= 0) return '☆0';
  return n === 0 ? `☆0` : `${'★'.repeat(n)}${'☆'.repeat(max - n)}`;
}

export function characterMetaLine(member: SealedCharacter, liveLevel?: number): string {
  const level = displayLevelForCharacter(liveLevel ?? member.level);
  return `Nv.${level} · ${CHARACTER_QUALITY_RANK_LABELS[member.quality]} · ${formatQualityStatMultiplier(member.qualityStatMultiplier)} · ${formatStars(member.stars, getMaxStarsForRarity(member.quality))} · Linhagem: ${LINEAGE_LABELS[getInstanceLineageId(member)]}`;
}
