/**
 * Tier de força Naruto (interno — não expor na UI).
 *
 * Por kill:
 * 1) Cobre/Ryo 100% (fora daqui — `copperRewardForKill`)
 * 2) Rolagem de raridade de material (1 resultado: nada ou raridade)
 * 3) Escolha do item: 70% assinatura / 30% resto do tier (+ fallbacks)
 * 4) Fragmento do personagem (chance baixa — ~625 kills T1 / ~5k T5)
 */

import type { ItemRarity } from '@/types/loot';

export type NarutoLootTier = 1 | 2 | 3 | 4 | 5;

export type NarutoMaterialRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

/** Chance de raridade por kill (soma ≤ 1; o resto = nada). T5 não tem “nada”. */
export type NarutoRarityWeights = Partial<Record<NarutoMaterialRarity, number>> & {
  nothing: number;
};

/**
 * Esperado kills por fragmento (calibração): T1≈625 (ex.: Chouji), T5≈5000 (Kyūbi).
 * Intermediários em progressão geométrica.
 */
export const NARUTO_FRAGMENT_EXPECTED_KILLS: Record<NarutoLootTier, number> = {
  1: 625,
  2: 1_051,
  3: 1_768,
  4: 2_973,
  5: 5_000,
};

export function getNarutoFragmentChance(tier: NarutoLootTier): number {
  return 1 / NARUTO_FRAGMENT_EXPECTED_KILLS[tier];
}

export const NARUTO_RARITY_WEIGHTS: Record<NarutoLootTier, NarutoRarityWeights> = {
  1: {
    nothing: 0.45,
    common: 0.5,
    uncommon: 0.046,
    rare: 0.004,
  },
  2: {
    nothing: 0.38,
    common: 0.52,
    uncommon: 0.085,
    rare: 0.014,
    epic: 0.001,
  },
  3: {
    nothing: 0.3,
    common: 0.48,
    uncommon: 0.15,
    rare: 0.055,
    epic: 0.013,
    legendary: 0.0018,
    mythic: 0.0002,
  },
  4: {
    nothing: 0.22,
    common: 0.4,
    uncommon: 0.23,
    rare: 0.11,
    epic: 0.035,
    legendary: 0.0045,
    mythic: 0.0005,
  },
  5: {
    nothing: 0,
    common: 0.28,
    uncommon: 0.33,
    rare: 0.25,
    epic: 0.1,
    legendary: 0.032,
    mythic: 0.008,
  },
};

/** Item assinado + secundário do personagem. */
export interface NarutoCharacterLootProfile {
  signature: string;
  secondary: string;
}

/**
 * Pack id → assinatura / secundário.
 * Ids = catálogo `anime-items`.
 */
export const NARUTO_CHARACTER_LOOT: Record<string, NarutoCharacterLootProfile> = {
  // —— Tier 1 ——
  'naruto-classic': {
    signature: 'item-anime-naruto-kunai-gasta',
    secondary: 'item-anime-naruto-racao-militar',
  },
  'sasuke-classic': {
    signature: 'item-anime-naruto-shuriken',
    secondary: 'item-anime-naruto-bolsa-shuriken',
  },
  sakura: {
    signature: 'item-anime-naruto-bandagem',
    secondary: 'item-anime-naruto-pilula-soldado',
  },
  ino: {
    signature: 'item-anime-naruto-pilula-soldado',
    secondary: 'item-anime-naruto-papel-chakra',
  },
  chouji: {
    signature: 'item-anime-naruto-racao-militar',
    secondary: 'item-anime-naruto-pilula-soldado',
  },
  kiba: {
    signature: 'item-anime-naruto-fio-aco',
    secondary: 'item-anime-naruto-presa-ninken',
  },

  // —— Tier 2 ——
  shikamaru: {
    signature: 'item-anime-naruto-fio-aco',
    secondary: 'item-anime-naruto-pergaminho-basico',
  },
  hinata: {
    signature: 'item-anime-naruto-bandagem',
    secondary: 'item-anime-naruto-lente-ocular',
  },
  shino: {
    signature: 'item-anime-naruto-casulo-insetos',
    secondary: 'item-anime-naruto-pergaminho-basico',
  },
  tenten: {
    signature: 'item-anime-naruto-bolsa-shuriken',
    secondary: 'item-anime-naruto-fuma-shuriken',
  },
  'rock-lee': {
    signature: 'item-anime-naruto-bandagem',
    secondary: 'item-anime-naruto-colete-tatico',
  },
  neji: {
    signature: 'item-anime-naruto-papel-chakra',
    secondary: 'item-anime-naruto-lente-ocular',
  },

  // —— Tier 3 ——
  temari: {
    signature: 'item-anime-naruto-papel-chakra',
    secondary: 'item-anime-naruto-selo-elemental',
  },
  gaara: {
    signature: 'item-anime-naruto-cabaca-areia',
    secondary: 'item-anime-naruto-bandana-riscada',
  },
  'sakura-shippuden': {
    signature: 'item-anime-naruto-pergaminho-selamento',
    secondary: 'item-anime-naruto-pilula-soldado',
  },
  tayuya: {
    signature: 'item-anime-naruto-papel-bomba',
    secondary: 'item-anime-naruto-contrato-invocacao',
  },
  jirobo: {
    signature: 'item-anime-naruto-racao-militar',
    secondary: 'item-anime-naruto-colete-tatico',
  },
  kabuto: {
    signature: 'item-anime-naruto-frasco-veneno',
    secondary: 'item-anime-naruto-bandagem',
  },
  kimimaro: {
    signature: 'item-anime-naruto-tanto',
    secondary: 'item-anime-naruto-selo-elemental',
  },

  // —— Tier 4 ——
  kakashi: {
    signature: 'item-anime-naruto-mascara-anbu',
    secondary: 'item-anime-naruto-livro-bingo',
  },
  guy: {
    signature: 'item-anime-naruto-colete-tatico',
    secondary: 'item-anime-naruto-bandagem',
  },
  jiraiya: {
    signature: 'item-anime-naruto-contrato-invocacao',
    secondary: 'item-anime-naruto-pergaminho-selamento',
  },
  tsunade: {
    signature: 'item-anime-naruto-pergaminho-selamento',
    secondary: 'item-anime-naruto-pilula-soldado',
  },
  kisame: {
    signature: 'item-anime-naruto-tanto',
    secondary: 'item-anime-naruto-bandana-riscada',
  },
  deidara: {
    signature: 'item-anime-naruto-papel-bomba',
    secondary: 'item-anime-naruto-frasco-veneno',
  },
  'sasuke-cursed': {
    signature: 'item-anime-naruto-selo-elemental',
    secondary: 'item-anime-naruto-bandana-riscada',
  },
  'naruto-shippuden': {
    signature: 'item-anime-naruto-nucleo-chakra',
    secondary: 'item-anime-naruto-bandana-riscada',
  },

  // —— Tier 5 ——
  'uchiha-itachi': {
    signature: 'item-anime-naruto-lente-ocular',
    secondary: 'item-anime-naruto-mascara-anbu',
  },
  shisui: {
    signature: 'item-anime-naruto-lente-ocular',
    secondary: 'item-anime-naruto-bandana-riscada',
  },
  orochimaru: {
    signature: 'item-anime-naruto-pergaminho-proibido',
    secondary: 'item-anime-naruto-frasco-veneno',
  },
  'naruto-sennin': {
    signature: 'item-anime-naruto-nucleo-chakra',
    secondary: 'item-anime-naruto-contrato-invocacao',
  },
  'naruto-kyubi': {
    signature: 'item-anime-naruto-fragmento-bestial',
    secondary: 'item-anime-naruto-nucleo-chakra',
  },
};

export const NARUTO_CHARACTER_TIER: Record<string, NarutoLootTier> = {
  'naruto-classic': 1,
  'sasuke-classic': 1,
  sakura: 1,
  ino: 1,
  chouji: 1,
  kiba: 1,
  shikamaru: 2,
  hinata: 2,
  shino: 2,
  tenten: 2,
  'rock-lee': 2,
  neji: 2,
  temari: 3,
  gaara: 3,
  'sakura-shippuden': 3,
  tayuya: 3,
  jirobo: 3,
  kabuto: 3,
  kimimaro: 3,
  kakashi: 4,
  guy: 4,
  jiraiya: 4,
  tsunade: 4,
  kisame: 4,
  deidara: 4,
  'sasuke-cursed': 4,
  'naruto-shippuden': 4,
  'uchiha-itachi': 5,
  shisui: 5,
  orochimaru: 5,
  'naruto-sennin': 5,
  'naruto-kyubi': 5,
};

export const NARUTO_CHARACTER_LABEL: Record<string, string> = {
  'naruto-classic': 'Naruto',
  'sasuke-classic': 'Sasuke',
  sakura: 'Sakura',
  ino: 'Ino',
  chouji: 'Chouji',
  kiba: 'Kiba',
  shikamaru: 'Shikamaru',
  hinata: 'Hinata',
  shino: 'Shino',
  tenten: 'Tenten',
  'rock-lee': 'Rock Lee',
  neji: 'Neji',
  temari: 'Temari',
  gaara: 'Gaara',
  'sakura-shippuden': 'Sakura (Shippuden)',
  tayuya: 'Tayuya',
  jirobo: 'Jirobo',
  kabuto: 'Kabuto',
  kimimaro: 'Kimimaro',
  kakashi: 'Kakashi',
  guy: 'Might Guy',
  jiraiya: 'Jiraiya',
  tsunade: 'Tsunade',
  kisame: 'Kisame',
  deidara: 'Deidara',
  'sasuke-cursed': 'Sasuke (Selo Amaldiçoado)',
  'uchiha-itachi': 'Itachi',
  shisui: 'Shisui',
  'naruto-shippuden': 'Naruto Shippuden',
  orochimaru: 'Orochimaru',
  'naruto-sennin': 'Naruto Sennin',
  'naruto-kyubi': 'Naruto Kyūbi',
};

export function narutoFragmentItemId(characterId: string): string {
  return `item-anime-naruto-frag-${characterId}`;
}

export function getNarutoCharacterTier(characterId: string | null | undefined): NarutoLootTier | null {
  if (!characterId) return null;
  return NARUTO_CHARACTER_TIER[characterId] ?? null;
}

export function listNarutoTierCharacterIds(): string[] {
  return Object.keys(NARUTO_CHARACTER_TIER);
}

/** Pool de itens (sig + sec) de todos os personagens do tier. */
export function listNarutoTierItemPool(tier: NarutoLootTier): string[] {
  const set = new Set<string>();
  for (const [id, t] of Object.entries(NARUTO_CHARACTER_TIER)) {
    if (t !== tier) continue;
    const profile = NARUTO_CHARACTER_LOOT[id];
    if (!profile) continue;
    set.add(profile.signature);
    set.add(profile.secondary);
  }
  return Array.from(set);
}

const RARITY_ORDER: readonly NarutoMaterialRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

/** Sorteia raridade (ou null = nada) a partir dos pesos do tier. */
export function rollNarutoMaterialRarity(
  tier: NarutoLootTier,
  rng: () => number = Math.random,
): NarutoMaterialRarity | null {
  const weights = NARUTO_RARITY_WEIGHTS[tier];
  let roll = rng();
  if (roll < weights.nothing) return null;
  roll -= weights.nothing;
  for (const rarity of RARITY_ORDER) {
    const w = weights[rarity] ?? 0;
    if (w <= 0) continue;
    if (roll < w) return rarity;
    roll -= w;
  }
  return null;
}

/**
 * 70% assinatura (se for da raridade); senão secundário se bater;
 * 30% resto do tier da raridade; se vazio → sorteio livre no tier.
 */
export function pickNarutoMaterialItem(
  characterId: string | null,
  tier: NarutoLootTier,
  rarity: NarutoMaterialRarity,
  itemRarityOf: (itemId: string) => ItemRarity | undefined,
  rng: () => number = Math.random,
): string | null {
  const profile = characterId ? NARUTO_CHARACTER_LOOT[characterId] : null;
  const tierPool = listNarutoTierItemPool(tier);
  const ofRarity = (ids: readonly string[]) =>
    ids.filter((id) => itemRarityOf(id) === rarity);

  const freePick = (): string | null => {
    const pool = ofRarity(tierPool);
    if (pool.length === 0) return null;
    return pool[Math.floor(rng() * pool.length)] ?? null;
  };

  if (profile) {
    const preferSignature = rng() < 0.7;
    if (preferSignature) {
      if (itemRarityOf(profile.signature) === rarity) return profile.signature;
      if (itemRarityOf(profile.secondary) === rarity) return profile.secondary;
      return freePick();
    }
    // 30% — resto do tier (tudo do tier desta raridade, menos a assinatura se possível)
    const rest = ofRarity(tierPool).filter((id) => id !== profile.signature);
    if (rest.length > 0) {
      return rest[Math.floor(rng() * rest.length)] ?? null;
    }
    if (itemRarityOf(profile.secondary) === rarity) return profile.secondary;
    if (itemRarityOf(profile.signature) === rarity) return profile.signature;
    return freePick();
  }

  return freePick();
}
