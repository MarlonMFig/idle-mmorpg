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

/** Item assinado + secundário do personagem (pools permitem extras sem remover os atuais). */
export interface NarutoCharacterLootProfile {
  /** Assinatura “primária” (legado / display / economia). */
  signatureItemId: string;
  /** Secundário/raro “primário” (legado / display / economia). */
  secondaryItemId: string;
  /** Assinaturas extras — entram no mesmo roll de signature. */
  extraSignatureItemIds?: readonly string[];
  /** Secundários/raros extras — entram no mesmo roll de secondary. */
  extraSecondaryItemIds?: readonly string[];
  /** @deprecated use signatureItemId */
  signature: string;
  /** @deprecated use secondaryItemId */
  secondary: string;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export function secondaryItemIdsOf(profile: NarutoCharacterLootProfile): string[] {
  return uniqueIds([profile.secondaryItemId, ...(profile.extraSecondaryItemIds ?? [])]);
}

export function signatureItemIdsOf(profile: NarutoCharacterLootProfile): string[] {
  return uniqueIds([profile.signatureItemId, ...(profile.extraSignatureItemIds ?? [])]);
}

function pickFromPool(ids: readonly string[], rng: () => number): string {
  return ids[Math.floor(rng() * ids.length)] ?? ids[0]!;
}

function profile(
  signatureItemId: string,
  secondaryItemId: string,
  extras?: { signature?: readonly string[]; secondary?: readonly string[] },
): NarutoCharacterLootProfile {
  const extraSignature = extras?.signature?.length
    ? uniqueIds(extras.signature.filter((id) => id !== signatureItemId))
    : undefined;
  const extraSecondary = extras?.secondary?.length
    ? uniqueIds(extras.secondary.filter((id) => id !== secondaryItemId))
    : undefined;
  return {
    signatureItemId,
    secondaryItemId,
    signature: signatureItemId,
    secondary: secondaryItemId,
    ...(extraSignature?.length ? { extraSignatureItemIds: extraSignature } : {}),
    ...(extraSecondary?.length ? { extraSecondaryItemIds: extraSecondary } : {}),
  };
}

/** Ids reutilizados do catálogo genérico antigo. */
const I = {
  casulo: 'item-anime-naruto-casulo-insetos',
  cabaca: 'item-anime-naruto-cabaca-areia',
  mascaraAnbu: 'item-anime-naruto-mascara-anbu',
} as const;

/**
 * Pack id → assinatura / secundário.
 * Ids = catálogo `anime-items` (+ drops em `naruto-character-drop-items`).
 * Extras = lista oficial raro/assinatura — NÃO remove os itens legados.
 */
export const NARUTO_CHARACTER_LOOT: Record<string, NarutoCharacterLootProfile> = {
  // —— Tier 1 (tabela oficial de 30) ——
  'naruto-classic': profile('item-anime-naruto-kunai-gasta', 'item-anime-naruto-racao-militar', {
    signature: ['item-anime-naruto-espiral-uzumaki'],
    secondary: ['item-anime-naruto-papel-pergaminho'],
  }),
  'sasuke-classic': profile('item-anime-naruto-shuriken', 'item-anime-naruto-bolsa-shuriken', {
    signature: ['item-anime-naruto-brasao-uchiha'],
    secondary: ['item-anime-naruto-shuriken-gasta'],
  }),
  sakura: profile('item-anime-naruto-bandagem', 'item-anime-naruto-pilula-soldado'),
  ino: profile('item-anime-naruto-pilula-soldado', 'item-anime-naruto-papel-chakra', {
    signature: ['item-anime-naruto-essencia-mental'],
    secondary: ['item-anime-naruto-petala-flor'],
  }),
  chouji: profile('item-anime-naruto-racao-militar', 'item-anime-naruto-pilula-soldado', {
    signature: ['item-anime-naruto-armadura-akimichi'],
    secondary: ['item-anime-naruto-pilula-calorias'],
  }),
  kiba: profile('item-anime-naruto-presa-ninken', 'item-anime-naruto-fio-aco', {
    signature: ['item-anime-naruto-presa-akamaru'],
    secondary: ['item-anime-naruto-tufo-pelo-canino'],
  }),

  // —— Tier 2 ——
  shikamaru: profile('item-anime-naruto-fio-aco', 'item-anime-naruto-pergaminho-basico', {
    signature: ['item-anime-naruto-peca-shogi'],
    secondary: ['item-anime-naruto-essencia-sombra'],
  }),
  hinata: profile('item-anime-naruto-lente-ocular', 'item-anime-naruto-bandagem', {
    signature: ['item-anime-naruto-luvas-juuken'],
    secondary: ['item-anime-naruto-essencia-byakugan'],
  }),
  shino: profile(I.casulo, 'item-anime-naruto-pergaminho-basico', {
    signature: ['item-anime-naruto-enxame-kikaichu'],
    secondary: [I.casulo],
  }),
  tenten: profile('item-anime-naruto-bolsa-shuriken', 'item-anime-naruto-fuma-shuriken', {
    signature: ['item-anime-naruto-selo-armamento'],
    secondary: ['item-anime-naruto-kunai-enferrujada'],
  }),
  'rock-lee': profile('item-anime-naruto-bandagem', 'item-anime-naruto-colete-tatico', {
    signature: ['item-anime-naruto-peso-tornozelo'],
    secondary: ['item-anime-naruto-bandagem-usada'],
  }),
  neji: profile('item-anime-naruto-lente-ocular', 'item-anime-naruto-papel-chakra', {
    signature: ['item-anime-naruto-selo-passaro-gaiola'],
    secondary: ['item-anime-naruto-essencia-byakugan'],
  }),

  // —— Tier 3 ——
  temari: profile('item-anime-naruto-papel-chakra', 'item-anime-naruto-selo-elemental', {
    signature: ['item-anime-naruto-leque-tessen'],
    secondary: ['item-anime-naruto-papel-leque'],
  }),
  gaara: profile(I.cabaca, 'item-anime-naruto-bandana-riscada', {
    secondary: ['item-anime-naruto-areia-fina'],
  }),
  'sakura-shippuden': profile(
    'item-anime-naruto-pergaminho-selamento',
    'item-anime-naruto-pilula-soldado',
    {
      signature: ['item-anime-naruto-luva-forca-sobre-humana'],
      secondary: ['item-anime-naruto-erva-medicinal'],
    },
  ),
  tayuya: profile('item-anime-naruto-papel-bomba', 'item-anime-naruto-contrato-invocacao', {
    signature: ['item-anime-naruto-flauta-doki'],
    secondary: ['item-anime-naruto-bocal-flauta'],
  }),
  jirobo: profile('item-anime-naruto-racao-militar', 'item-anime-naruto-colete-tatico', {
    signature: ['item-anime-naruto-nucleo-prisao-terra'],
    secondary: ['item-anime-naruto-cascalho-doton'],
  }),
  kabuto: profile('item-anime-naruto-frasco-veneno', 'item-anime-naruto-bandagem', {
    signature: ['item-anime-naruto-bisturi-chakra'],
    secondary: ['item-anime-naruto-oculos-redondos'],
  }),
  kimimaro: profile('item-anime-naruto-tanto', 'item-anime-naruto-selo-elemental', {
    signature: ['item-anime-naruto-medula-shikotsumyaku'],
    secondary: ['item-anime-naruto-osso-cla-kaguya'],
  }),

  // —— Tier 4 ——
  kakashi: profile('item-anime-naruto-mascara-anbu', 'item-anime-naruto-livro-bingo', {
    signature: ['item-anime-naruto-livro-icha-icha'],
    secondary: ['item-anime-naruto-faisca-chidori'],
  }),
  guy: profile('item-anime-naruto-colete-tatico', 'item-anime-naruto-bandagem', {
    signature: ['item-anime-naruto-chakra-oitavo-portao'],
    secondary: ['item-anime-naruto-vapor-portoes'],
  }),
  jiraiya: profile('item-anime-naruto-contrato-invocacao', 'item-anime-naruto-pergaminho-selamento', {
    signature: ['item-anime-naruto-pergaminho-myoboku'],
    secondary: ['item-anime-naruto-oleo-sapo'],
  }),
  tsunade: profile('item-anime-naruto-pergaminho-selamento', 'item-anime-naruto-pilula-soldado', {
    signature: ['item-anime-naruto-selo-yin-byakugou'],
    secondary: ['item-anime-naruto-erva-medicinal'],
  }),
  kisame: profile('item-anime-naruto-tanto', 'item-anime-naruto-bandana-riscada', {
    signature: ['item-anime-naruto-fragmento-samehada'],
    secondary: ['item-anime-naruto-escama-tubarao'],
  }),
  deidara: profile('item-anime-naruto-papel-bomba', 'item-anime-naruto-frasco-veneno', {
    signature: ['item-anime-naruto-argila-explosiva'],
    secondary: ['item-anime-naruto-argila-bruta'],
  }),
  'sasuke-cursed': profile('item-anime-naruto-selo-elemental', 'item-anime-naruto-bandana-riscada', {
    signature: ['item-anime-naruto-marca-maldita-ceu'],
    secondary: ['item-anime-naruto-chakra-amaldicoado'],
  }),

  // Extra de pack (fora da tabela de 30) — Hunt continua a dropar.
  'naruto-shippuden': profile('item-anime-naruto-nucleo-chakra', 'item-anime-naruto-bandana-riscada', {
    signature: ['item-anime-naruto-nucleo-rasengan'],
    secondary: ['item-anime-naruto-papel-pergaminho'],
  }),

  // —— Tier 5 ——
  'uchiha-itachi': profile('item-anime-naruto-lente-ocular', 'item-anime-naruto-mascara-anbu', {
    signature: ['item-anime-naruto-olho-mangekyou'],
    secondary: ['item-anime-naruto-pena-corvo'],
  }),
  orochimaru: profile('item-anime-naruto-pergaminho-proibido', 'item-anime-naruto-frasco-veneno', {
    signature: ['item-anime-naruto-kusanagi-grama'],
    secondary: ['item-anime-naruto-escama-serpente'],
  }),
  'naruto-sennin': profile('item-anime-naruto-nucleo-chakra', 'item-anime-naruto-contrato-invocacao'),
  'naruto-kyubi': profile('item-anime-naruto-fragmento-bestial', 'item-anime-naruto-nucleo-chakra', {
    signature: ['item-anime-naruto-nucleo-kurama'],
    secondary: ['item-anime-naruto-chakra-bijuu'],
  }),

  // Extra de pack (fora da tabela de 30).
  shisui: profile('item-anime-naruto-lente-ocular', 'item-anime-naruto-bandana-riscada', {
    signature: ['item-anime-naruto-essencia-kotoamatsukami'],
    secondary: ['item-anime-naruto-folha-teletransporte'],
  }),

  // —— Novos perfis (só a lista oficial; sem loot legado) ——
  'naruto-1-tail': profile(
    'item-anime-naruto-manto-chakra-vermelho',
    'item-anime-naruto-chakra-residual',
  ),
  'naruto-4-tails': profile(
    'item-anime-naruto-garra-quatro-caudas',
    'item-anime-naruto-chakra-residual',
  ),
  'sasuke-g6': profile('item-anime-naruto-lamina-kusanagi', 'item-anime-naruto-fio-condutor-raiton'),
  'rock-lee-g6': profile('item-anime-naruto-selo-sexto-portao', 'item-anime-naruto-vapor-portoes'),
  'hinata-kid': profile('item-anime-naruto-casaco-bege', 'item-anime-naruto-tecido-branco'),
  'hinata-g6': profile(
    'item-anime-naruto-chakra-punhos-leao',
    'item-anime-naruto-essencia-byakugan',
  ),
  hanabi: profile('item-anime-naruto-insignia-casa-principal', 'item-anime-naruto-tecido-branco'),
  'choji-jf': profile('item-anime-naruto-pilula-borboleta', 'item-anime-naruto-pilula-calorias'),
  asuma: profile('item-anime-naruto-laminas-chakra', 'item-anime-naruto-maco-cigarros'),
  kurenai: profile('item-anime-naruto-espinho-ilusorio', 'item-anime-naruto-essencia-genjutsu'),
  'shino-g6': profile('item-anime-naruto-rainha-kikaichu', I.casulo),
  'kiba-kid': profile('item-anime-naruto-coleira-filhote', 'item-anime-naruto-tufo-pelo-canino'),
  'tenten-kid': profile('item-anime-naruto-fita-coque', 'item-anime-naruto-kunai-enferrujada'),
  'tenten-g6': profile('item-anime-naruto-leque-bashosen', 'item-anime-naruto-selo-armamento'),
  'temari-kid': profile('item-anime-naruto-leque-treino', 'item-anime-naruto-papel-leque'),
  'temari-g6': profile('item-anime-naruto-pergaminho-kirikiri-mai', 'item-anime-naruto-chakra-futon'),
  konohamaru: profile('item-anime-naruto-insignia-sarutobi', 'item-anime-naruto-cachecol-azul'),
  'kakashi-g6': profile('item-anime-naruto-lente-kamui', 'item-anime-naruto-faisca-chidori'),
  hiruzen: profile('item-anime-naruto-bastao-enma', 'item-anime-naruto-cinzas-cachimbo'),
  shizune: profile('item-anime-naruto-lancador-senbon', 'item-anime-naruto-erva-medicinal'),
  anko: profile('item-anime-naruto-casaco-malha', 'item-anime-naruto-espeto-dango'),
  yamato: profile(I.mascaraAnbu, 'item-anime-naruto-seiva-mokuton'),
  sai: profile('item-anime-naruto-pincel-choju-giga', 'item-anime-naruto-tinta-nanquim'),
  danzo: profile('item-anime-naruto-braco-izanagi', 'item-anime-naruto-bandagem-raiz'),
  'minato-jonin': profile('item-anime-naruto-marca-hiraishin', 'item-anime-naruto-kunai-tres-pontas'),
  hashirama: profile('item-anime-naruto-cristal-primeiro', 'item-anime-naruto-seiva-mokuton'),
  tobirama: profile('item-anime-naruto-selo-edo-tensei', 'item-anime-naruto-gota-suiton-pura'),
  'gaara-shukaku': profile('item-anime-naruto-chakra-shukaku', 'item-anime-naruto-areia-dourada'),
  kankuro: profile('item-anime-naruto-peca-karasu', 'item-anime-naruto-madeira-marionete'),
  chiyo: profile('item-anime-naruto-selo-dez-marionetes', 'item-anime-naruto-fio-chakra'),
  zabuza: profile('item-anime-naruto-kubikiribocho', 'item-anime-naruto-frasco-nevoa'),
  haku: profile('item-anime-naruto-senbon-congelada', 'item-anime-naruto-cristal-gelo'),
  'haku-jf': profile('item-anime-naruto-espelho-demoniaco', 'item-anime-naruto-cristal-gelo'),
  'orochimaru-g6': profile('item-anime-naruto-essencia-yamata', 'item-anime-naruto-frasco-experimento'),
  'tayuya-nun5': profile('item-anime-naruto-flauta-doki', 'item-anime-naruto-bocal-flauta'),
  sakon: profile('item-anime-naruto-celula-parasita', 'item-anime-naruto-retalho-duplo'),
  'sakon-nun5': profile('item-anime-naruto-celula-parasita', 'item-anime-naruto-retalho-duplo'),
  kidomaru: profile('item-anime-naruto-arco-teia', 'item-anime-naruto-teia-dourada'),
  sasori: profile('item-anime-naruto-nucleo-vivo-sasori', 'item-anime-naruto-madeira-marionete'),
  'sasori-puppet': profile('item-anime-naruto-cauda-ferrao', 'item-anime-naruto-placa-hiruko'),
  pain: profile('item-anime-naruto-olho-rinnegan', 'item-anime-naruto-bastao-negro-chakra'),
};

export const NARUTO_CHARACTER_TIER: Record<string, NarutoLootTier> = {
  'naruto-classic': 1,
  'sasuke-classic': 1,
  sakura: 1,
  ino: 1,
  chouji: 1,
  kiba: 1,
  'hinata-kid': 1,
  'tenten-kid': 1,
  'temari-kid': 1,
  'kiba-kid': 1,
  konohamaru: 1,
  shikamaru: 2,
  hinata: 2,
  shino: 2,
  tenten: 2,
  'rock-lee': 2,
  neji: 2,
  asuma: 2,
  kurenai: 2,
  shizune: 2,
  anko: 2,
  sai: 2,
  yamato: 2,
  kankuro: 2,
  temari: 3,
  gaara: 3,
  'sakura-shippuden': 3,
  tayuya: 3,
  'tayuya-nun5': 3,
  jirobo: 3,
  kabuto: 3,
  kimimaro: 3,
  sakon: 3,
  'sakon-nun5': 3,
  kidomaru: 3,
  haku: 3,
  zabuza: 3,
  chiyo: 3,
  'sasori-puppet': 3,
  'choji-jf': 3,
  hanabi: 3,
  kakashi: 4,
  guy: 4,
  jiraiya: 4,
  tsunade: 4,
  kisame: 4,
  deidara: 4,
  'sasuke-cursed': 4,
  'naruto-shippuden': 4,
  'sasuke-g6': 4,
  'rock-lee-g6': 4,
  'kakashi-g6': 4,
  'tenten-g6': 4,
  'temari-g6': 4,
  'shino-g6': 4,
  'orochimaru-g6': 4,
  'gaara-shukaku': 4,
  'naruto-1-tail': 4,
  'hinata-g6': 4,
  'haku-jf': 4,
  hiruzen: 4,
  danzo: 4,
  sasori: 4,
  'minato-jonin': 4,
  'uchiha-itachi': 5,
  shisui: 5,
  orochimaru: 5,
  'naruto-sennin': 5,
  'naruto-kyubi': 5,
  'naruto-4-tails': 5,
  hashirama: 5,
  tobirama: 5,
  pain: 5,
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
  'naruto-1-tail': 'Naruto (1 Cauda)',
  'naruto-4-tails': 'Naruto (4 Caudas)',
  'sasuke-g6': 'Sasuke (G6)',
  'rock-lee-g6': 'Rock Lee (G6)',
  'hinata-kid': 'Hinata (Kid)',
  'hinata-g6': 'Hinata (G6)',
  hanabi: 'Hanabi',
  'choji-jf': 'Choji (Jump Force)',
  asuma: 'Asuma',
  kurenai: 'Kurenai',
  'shino-g6': 'Shino (G6)',
  'kiba-kid': 'Kiba (Kid)',
  'tenten-kid': 'Tenten (Kid)',
  'tenten-g6': 'Tenten (G6)',
  'temari-kid': 'Temari (Kid)',
  'temari-g6': 'Temari (G6)',
  konohamaru: 'Konohamaru',
  'kakashi-g6': 'Kakashi (G6)',
  hiruzen: 'Hiruzen',
  shizune: 'Shizune',
  anko: 'Anko',
  yamato: 'Yamato',
  sai: 'Sai',
  danzo: 'Danzo',
  'minato-jonin': 'Minato (Jonin)',
  hashirama: 'Hashirama',
  tobirama: 'Tobirama',
  'gaara-shukaku': 'Gaara (Shukaku)',
  kankuro: 'Kankuro',
  chiyo: 'Chiyo',
  zabuza: 'Zabuza',
  haku: 'Haku',
  'haku-jf': 'Haku (Jump Force)',
  'orochimaru-g6': 'Orochimaru (G6)',
  'tayuya-nun5': 'Tayuya (NUN5)',
  sakon: 'Sakon e Ukon',
  'sakon-nun5': 'Sakon e Ukon (NUN5)',
  kidomaru: 'Kidomaru',
  sasori: 'Sasori',
  'sasori-puppet': 'Sasori (Hiruko)',
  pain: 'Pain (Deva)',
};

export function narutoFragmentItemId(characterId: string): string {
  return `item-anime-naruto-frag-${characterId}`;
}

export function narutoSignatureItemIds(characterId: string): string[] {
  const profile = characterId ? NARUTO_CHARACTER_LOOT[characterId] : null;
  return profile ? signatureItemIdsOf(profile) : [];
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
    for (const itemId of signatureItemIdsOf(profile)) set.add(itemId);
    for (const itemId of secondaryItemIdsOf(profile)) set.add(itemId);
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
    .filter(([, profile]) => signatureItemIdsOf(profile).includes(itemId))
    .map(([id]) => id);
}

export function listSecondaryCharacterIdsForItem(itemId: string): string[] {
  return Object.entries(NARUTO_CHARACTER_LOOT)
    .filter(([, profile]) => secondaryItemIdsOf(profile).includes(itemId))
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
 * Se o perfil tem pool (legado + extras), sorteia 1 item do pool.
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
    const secondaryPool = secondaryItemIdsOf(profile);
    const signaturePool = signatureItemIdsOf(profile);
    return {
      secondaryItemId: rng() < secondaryP ? pickFromPool(secondaryPool, rng) : null,
      signatureItemId: rng() < signatureP ? pickFromPool(signaturePool, rng) : null,
    };
  };

  let result = rollOnce();
  const vip = opts.vipEmptyReroll ?? 0;
  if (vip > 0 && !result.secondaryItemId && !result.signatureItemId && rng() < vip) {
    result = rollOnce();
  }
  return result;
}
