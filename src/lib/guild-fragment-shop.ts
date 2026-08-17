import {
  GUILD_FRAGMENT_DAILY_LIMIT,
  GUILD_FRAGMENT_PRICE_BY_TIER,
} from '@/constants/aiw-guild';
import {
  NARUTO_CHARACTER_LABEL,
  NARUTO_CHARACTER_LOOT,
  NARUTO_CHARACTER_TIER,
  narutoFragmentItemId,
} from '@/data/naruto-loot-tiers';

/** Roster sorteado para fragmento rotativo diário (spec guild). */
export const GUILD_FRAGMENT_ROSTER = Object.keys(NARUTO_CHARACTER_LOOT).sort();

function hashDay(dayKey: string): number {
  let h = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    h = (h * 31 + dayKey.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function pickDailyFragmentCharacter(dayKey: string): string {
  if (GUILD_FRAGMENT_ROSTER.length === 0) return 'naruto-classic';
  const index = hashDay(dayKey) % GUILD_FRAGMENT_ROSTER.length;
  return GUILD_FRAGMENT_ROSTER[index] ?? 'naruto-classic';
}

export function fragmentPriceForCharacter(charId: string): number {
  const tier = NARUTO_CHARACTER_TIER[charId] ?? 1;
  return GUILD_FRAGMENT_PRICE_BY_TIER[tier] ?? GUILD_FRAGMENT_PRICE_BY_TIER[1];
}

export function dailyFragmentOffer(dayKey: string): {
  characterId: string;
  label: string;
  itemId: string;
  priceCoins: number;
  dailyLimit: number;
} {
  const characterId = pickDailyFragmentCharacter(dayKey);
  return {
    characterId,
    label: NARUTO_CHARACTER_LABEL[characterId] ?? characterId,
    itemId: narutoFragmentItemId(characterId),
    priceCoins: fragmentPriceForCharacter(characterId),
    dailyLimit: GUILD_FRAGMENT_DAILY_LIMIT,
  };
}
