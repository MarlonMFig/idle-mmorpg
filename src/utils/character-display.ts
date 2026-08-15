import {
  CHARACTER_QUALITY_RANK_LABELS,
  CHARACTER_CLAN_LABELS,
} from '@/constants/character-progression';
import type { SealedCharacter } from '@/types/team';

/** Nível do personagem (próprio; fallback 1). */
export function displayLevelForCharacter(memberLevel: number): number {
  return Math.max(1, Math.floor(memberLevel || 1));
}

export function formatStars(stars: number): string {
  const n = Math.max(0, Math.min(5, Math.floor(stars)));
  return n === 0 ? '☆0' : `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
}

export function characterMetaLine(member: SealedCharacter, liveLevel?: number): string {
  const level = displayLevelForCharacter(liveLevel ?? member.level);
  return `Nv.${level} · ${CHARACTER_QUALITY_RANK_LABELS[member.quality]} · ${formatStars(member.stars)} · ${CHARACTER_CLAN_LABELS[member.clanId]}`;
}
