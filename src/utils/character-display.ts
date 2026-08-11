import {
  CHARACTER_QUALITY_RANK_LABELS,
  CHARACTER_CLAN_LABELS,
} from '@/constants/character-progression';
import type { SealedCharacter } from '@/types/team';

/** Nível espelhado da conta (UI). */
export function displayLevelForCharacter(accountLevel: number): number {
  return Math.max(1, Math.floor(accountLevel));
}

export function formatStars(stars: number): string {
  const n = Math.max(0, Math.min(5, Math.floor(stars)));
  return n === 0 ? '☆0' : `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
}

export function characterMetaLine(member: SealedCharacter, accountLevel: number): string {
  const level = displayLevelForCharacter(accountLevel);
  return `Nv.${level} · ${CHARACTER_QUALITY_RANK_LABELS[member.quality]} · ${formatStars(member.stars)} · ${CHARACTER_CLAN_LABELS[member.clanId]}`;
}
