/**
 * Tier de força Naruto (interno — não expor na UI).
 *
 * Por kill (rolls independentes):
 * 1) Cobre direto 100% (fora daqui — `copperRewardForKill`)
 * 2) Secondary roll
 * 3) Signature roll
 * 4) Fragmento do personagem (chance baixa — ~625 kills T1 / ~5k T5)
 *
 * A raridade do item NÃO escolhe o drop. VIP só rerolla kill sem material.
 */

import type { ItemRarity } from '@/types/loot';

import { LOOT_TIER_ROLL_CHANCES, type NarutoLootTier } from '@/constants/loot-economy';

export type { NarutoLootTier };

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
  signatureItemId: string;
  secondaryItemId: string;
  /** @deprecated use signatureItemId */
  signature: string;
  /** @deprecated use secondaryItemId */
  secondary: string;
}

function profile(signatureItemId: string, secondaryItemId: string): NarutoCharacterLootProfile {
  return {
    signatureItemId,
    secondaryItemId,
    signature: signatureItemId,
    secondary: secondaryItemId,
  };
}

/**
 * Pack id → assinatura / secundário.
 * Ids = catálogo `anime-items`.
 */
export const NARUTO_CHARACTER_LOOT: Record<string, NarutoCharacterLootProfile> = {
  // —— Tier 1 (tabela oficial de 30) ——
  'naruto-classic': profile('item-anime-naruto-kunai-gasta', 'item-anime-naruto-racao-militar'),
  'sasuke-classic': profile('item-anime-naruto-shuriken', 'item-anime-naruto-bolsa-shuriken'),
  sakura: profile('item-anime-naruto-bandagem', 'item-anime-naruto-pilula-soldado'),
  ino: profile('item-anime-naruto-pilula-soldado', 'item-anime-naruto-papel-chakra'),
  chouji: profile('item-anime-naruto-racao-militar', 'item-anime-naruto-pilula-soldado'),
  kiba: profile('item-anime-naruto-presa-ninken', 'item-anime-naruto-fio-aco'),

  // —— Tier 2 ——
  shikamaru: profile('item-anime-naruto-fio-aco', 'item-anime-naruto-pergaminho-basico'),
  hinata: profile('item-anime-naruto-lente-ocular', 'item-anime-naruto-bandagem'),
  shino: profile('item-anime-naruto-casulo-insetos', 'item-anime-naruto-pergaminho-basico'),
  tenten: profile('item-anime-naruto-bolsa-shuriken', 'item-anime-naruto-fuma-shuriken'),
  'rock-lee': profile('item-anime-naruto-bandagem', 'item-anime-naruto-colete-tatico'),
  neji: profile('item-anime-naruto-lente-ocular', 'item-anime-naruto-papel-chakra'),

  // —— Tier 3 ——
  temari: profile('item-anime-naruto-papel-chakra', 'item-anime-naruto-selo-elemental'),
  gaara: profile('item-anime-naruto-cabaca-areia', 'item-anime-naruto-bandana-riscada'),
  'sakura-shippuden': profile('item-anime-naruto-pergaminho-selamento', 'item-anime-naruto-pilula-soldado'),
  tayuya: profile('item-anime-naruto-papel-bomba', 'item-anime-naruto-contrato-invocacao'),
  jirobo: profile('item-anime-naruto-racao-militar', 'item-anime-naruto-colete-tatico'),
  kabuto: profile('item-anime-naruto-frasco-veneno', 'item-anime-naruto-bandagem'),
  kimimaro: profile('item-anime-naruto-tanto', 'item-anime-naruto-selo-elemental'),

  // —— Tier 4 ——
  kakashi: profile('item-anime-naruto-mascara-anbu', 'item-anime-naruto-livro-bingo'),
  guy: profile('item-anime-naruto-colete-tatico', 'item-anime-naruto-bandagem'),
  jiraiya: profile('item-anime-naruto-contrato-invocacao', 'item-anime-naruto-pergaminho-selamento'),
  tsunade: profile('item-anime-naruto-pergaminho-selamento', 'item-anime-naruto-pilula-soldado'),
  kisame: profile('item-anime-naruto-tanto', 'item-anime-naruto-bandana-riscada'),
  deidara: profile('item-anime-naruto-papel-bomba', 'item-anime-naruto-frasco-veneno'),
  'sasuke-cursed': profile('item-anime-naruto-selo-elemental', 'item-anime-naruto-bandana-riscada'),

  // Extra de pack (fora da tabela de 30) — Hunt continua a dropar.
  'naruto-shippuden': profile('item-anime-naruto-nucleo-chakra', 'item-anime-naruto-bandana-riscada'),

  // —— Tier 5 ——
  'uchiha-itachi': profile('item-anime-naruto-lente-ocular', 'item-anime-naruto-mascara-anbu'),
  orochimaru: profile('item-anime-naruto-pergaminho-proibido', 'item-anime-naruto-frasco-veneno'),
  'naruto-sennin': profile('item-anime-naruto-nucleo-chakra', 'item-anime-naruto-contrato-invocacao'),
  'naruto-kyubi': profile('item-anime-naruto-fragmento-bestial', 'item-anime-naruto-nucleo-chakra'),

  // Extra de pack (fora da tabela de 30).
  shisui: profile('item-anime-naruto-lente-ocular', 'item-anime-naruto-bandana-riscada'),
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

export function hasNarutoLootProfile(characterId: string | null | undefined): boolean {
  return Boolean(characterId && NARUTO_CHARACTER_LOOT[characterId]);
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
    set.add(profile.signatureItemId);
    set.add(profile.secondaryItemId);
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
 * @deprecated O kill Naruto já não usa raridade para escolher item.
 * Mantido para referência do modelo antigo.
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

/** Os 30 personagens da tabela oficial (extras de pack ficam de fora). */
export const NARUTO_CORE_THIRTY_IDS: readonly string[] = [
  'naruto-classic',
  'sasuke-classic',
  'sakura',
  'ino',
  'chouji',
  'kiba',
  'shikamaru',
  'hinata',
  'shino',
  'tenten',
  'rock-lee',
  'neji',
  'temari',
  'gaara',
  'sakura-shippuden',
  'tayuya',
  'jirobo',
  'kabuto',
  'kimimaro',
  'kakashi',
  'guy',
  'jiraiya',
  'tsunade',
  'kisame',
  'deidara',
  'sasuke-cursed',
  'uchiha-itachi',
  'orochimaru',
  'naruto-sennin',
  'naruto-kyubi',
];

export function getNarutoLootRollChances(tier: NarutoLootTier): {
  secondary: number;
  signature: number;
} {
  return LOOT_TIER_ROLL_CHANCES[tier];
}

export function listSignatureCharacterIdsForItem(itemId: string): string[] {
  return Object.entries(NARUTO_CHARACTER_LOOT)
    .filter(([, profile]) => profile.signatureItemId === itemId)
    .map(([id]) => id);
}

export function listSecondaryCharacterIdsForItem(itemId: string): string[] {
  return Object.entries(NARUTO_CHARACTER_LOOT)
    .filter(([, profile]) => profile.secondaryItemId === itemId)
    .map(([id]) => id);
}

/**
 * Progressão por assinatura — NÃO implementada.
 * Só o contrato de lookup para o futuro.
 */
export function requiresSignatureItem(_characterId: string): boolean {
  return false;
}

export interface NarutoIndependentMaterialRoll {
  secondaryItemId: string | null;
  signatureItemId: string | null;
}

/**
 * Secondary e Signature são rolls independentes (qty 1).
 * VIP: se os dois falharem, uma chance de reroll dos dois.
 */
export function rollNarutoIndependentMaterials(
  characterId: string | null,
  tier: NarutoLootTier,
  rng: () => number,
  opts: { guildLootMult?: number; vipEmptyReroll?: number } = {},
): NarutoIndependentMaterialRoll {
  const profile = characterId ? NARUTO_CHARACTER_LOOT[characterId] : null;
  const chances = LOOT_TIER_ROLL_CHANCES[tier];
  const guild = opts.guildLootMult ?? 1;
  const secondaryP = Math.min(1, Math.max(0, chances.secondary * guild));
  const signatureP = Math.min(1, Math.max(0, chances.signature * guild));

  const rollOnce = (): NarutoIndependentMaterialRoll => {
    if (!profile) {
      return { secondaryItemId: null, signatureItemId: null };
    }
    return {
      secondaryItemId: rng() < secondaryP ? profile.secondaryItemId : null,
      signatureItemId: rng() < signatureP ? profile.signatureItemId : null,
    };
  };

  let result = rollOnce();
  const vip = opts.vipEmptyReroll ?? 0;
  if (vip > 0 && !result.secondaryItemId && !result.signatureItemId && rng() < vip) {
    result = rollOnce();
  }
  return result;
}
