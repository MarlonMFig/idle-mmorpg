import { guildXpForLevel } from '@/constants/guild';
import type { Guild } from '@/types/guild';

/** Aplica Guild XP e sobe níveis com excesso preservado. */
export function applyGuildXp(guild: Guild, amount: number): { guild: Guild; levelsGained: number } {
  let level = Math.max(1, guild.level);
  let xp = Math.max(0, guild.xp) + Math.max(0, Math.floor(amount));
  let levelsGained = 0;
  let need = guildXpForLevel(level);
  while (xp >= need && level < 99) {
    xp -= need;
    level += 1;
    levelsGained += 1;
    need = guildXpForLevel(level);
  }
  return { guild: { ...guild, level, xp }, levelsGained };
}

export function normalizeGuildName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 24);
}

export function normalizeGuildTag(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function isValidGuildName(name: string, min = 3, max = 24): boolean {
  const n = normalizeGuildName(name);
  return n.length >= min && n.length <= max;
}

export function isValidGuildTag(tag: string, min = 2, max = 4): boolean {
  const t = normalizeGuildTag(tag);
  return t.length >= min && t.length <= max;
}
