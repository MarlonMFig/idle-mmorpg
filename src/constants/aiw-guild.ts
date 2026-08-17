/** Guild spec — bônus passivos e loja de fragmento rotativo. */

export const GUILD_COMBINED_BONUS_CAP = 0.4;

export const GUILD_FRAGMENT_DAILY_LIMIT = 2;

/** Preço em Selos (guildCoins) por tier narrativo 1–5. */
export const GUILD_FRAGMENT_PRICE_BY_TIER: Record<number, number> = {
  1: 30,
  2: 60,
  3: 150,
  4: 400,
  5: 1000,
};

/** Mapeamento skill id → bônus percentual por nível (spec Instinto/Disciplina). */
export const GUILD_SKILL_BONUS: Record<
  string,
  { kind: 'exp' | 'loot' | 'copper' | 'hp' | 'seal'; percentPerLevel: number }
> = {
  'sk-exp': { kind: 'exp', percentPerLevel: 0.01 },
  'sk-gold': { kind: 'copper', percentPerLevel: 0.01 },
  'sk-atk': { kind: 'hp', percentPerLevel: 0.02 },
  'sk-hp': { kind: 'hp', percentPerLevel: 0.02 },
  'sk-seal': { kind: 'seal', percentPerLevel: 0.005 },
};
