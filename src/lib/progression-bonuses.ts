import { GUILD_COMBINED_BONUS_CAP, GUILD_SKILL_BONUS } from '@/constants/aiw-guild';
import { VIP_EXP_MULT, VIP_LOOT_MULT } from '@/constants/vip';
import { guildStore } from '@/stores/guild-store';
import { vipStore } from '@/stores/vip-store';

function guildBonusPercent(kind: 'exp' | 'loot' | 'copper'): number {
  const guild = guildStore.getMyGuild();
  if (!guild) return 0;
  let total = 0;
  for (const [skillId, spec] of Object.entries(GUILD_SKILL_BONUS)) {
    if (spec.kind !== kind) continue;
    const level = guild.skillLevels[skillId] ?? 0;
    total += level * spec.percentPerLevel;
  }
  return total;
}

function clampCombinedBonus(vipPart: number, guildPart: number): number {
  const raw = vipPart + guildPart;
  const cap = GUILD_COMBINED_BONUS_CAP;
  if (raw <= cap) return raw;
  if (vipPart >= cap) return cap;
  return Math.min(cap, vipPart + Math.max(0, cap - vipPart));
}

/** Multiplicador de EXP (VIP + guild Disciplina, teto 40%). */
export function expProgressMultiplier(): number {
  const vipPart = vipStore.isActive() ? VIP_EXP_MULT - 1 : 0;
  const guildPart = guildBonusPercent('exp');
  const combined = clampCombinedBonus(vipPart, guildPart);
  return 1 + combined;
}

/** Multiplicador de loot — VIP só entra via reroll de kill vazio (anime-loot). */
export function guildLootBonusMultiplier(): number {
  const guildPart = guildBonusPercent('loot');
  return 1 + Math.min(GUILD_COMBINED_BONUS_CAP, guildPart);
}

/** Multiplicador de cobre por kill (guild Prosperidade + potencial Fortuna externo). */
export function guildCopperBonusMultiplier(): number {
  const guildPart = guildBonusPercent('copper');
  return 1 + Math.min(GUILD_COMBINED_BONUS_CAP, guildPart);
}

/** Chance extra de reroll quando o kill não dropa nada (VIP). */
export function vipEmptyLootRerollChance(): number {
  return vipStore.isActive() ? VIP_LOOT_MULT - 1 : 0;
}
