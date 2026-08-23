import type { AnimeId } from '@/types/anime';
import type { ItemDefinition, ItemRarity } from '@/types/loot';
import {
  listNarutoTierCharacterIds,
  NARUTO_CHARACTER_LABEL,
  narutoFragmentItemId,
} from '@/data/naruto-loot-tiers';

const STACK_BY_RARITY: Record<ItemRarity, number> = {
  common: 99,
  uncommon: 99,
  rare: 50,
  epic: 30,
  legendary: 20,
  mythic: 10,
};

function animeItem(
  id: string,
  name: string,
  rarity: ItemRarity,
  iconFile?: string,
  stackMax?: number,
): ItemDefinition {
  return {
    id,
    name,
    rarity,
    stackMax: stackMax ?? STACK_BY_RARITY[rarity],
    ...(iconFile
      ? { iconSrc: `/ui/items/naruto/${iconFile}` }
      : undefined),
  };
}

/**
 * Materiais de loot por franquia (anime).
 * Naruto: pack completo (ícones SVG + nomes oficiais da tabela de drop).
 */
export const ANIME_LOOT_ITEMS: Record<string, ItemDefinition> = {
  // —— Naruto ——
  // Comum
  'item-anime-naruto-essencia-chakra': animeItem(
    'item-anime-naruto-essencia-chakra',
    'Essência de Chakra',
    'common',
    'essencia_chakra.png',
  ),
  'item-anime-naruto-kunai-gasta': animeItem(
    'item-anime-naruto-kunai-gasta',
    'Kunai Gasta',
    'common',
    'kunai_gasta.png',
  ),
  'item-anime-naruto-shuriken': animeItem(
    'item-anime-naruto-shuriken',
    'Shuriken Enferrujada',
    'common',
    'shuriken.png',
  ),
  'item-anime-naruto-papel-bomba': animeItem(
    'item-anime-naruto-papel-bomba',
    'Papel Bomba',
    'common',
    'papel_bomba.png',
  ),
  'item-anime-naruto-bandagem': animeItem(
    'item-anime-naruto-bandagem',
    'Bandagem Rasgada',
    'common',
    'bandagem.png',
  ),
  'item-anime-naruto-pilula-soldado': animeItem(
    'item-anime-naruto-pilula-soldado',
    'Pílula de Soldado',
    'common',
    'pilula_soldado.png',
  ),
  'item-anime-naruto-fio-aco': animeItem(
    'item-anime-naruto-fio-aco',
    'Fio de Aço Ninja',
    'common',
    'fio_aco.png',
  ),
  'item-anime-naruto-bandana-riscada': animeItem(
    'item-anime-naruto-bandana-riscada',
    'Bandana Riscada',
    'common',
    'bandana_riscada.png',
  ),

  // Incomum
  'item-anime-naruto-pergaminho-basico': animeItem(
    'item-anime-naruto-pergaminho-basico',
    'Pergaminho Básico',
    'uncommon',
    'pergaminho_basico.png',
  ),
  'item-anime-naruto-bolsa-shuriken': animeItem(
    'item-anime-naruto-bolsa-shuriken',
    'Bolsa de Shuriken',
    'uncommon',
    'bolsa_shuriken.png',
  ),
  'item-anime-naruto-racao-militar': animeItem(
    'item-anime-naruto-racao-militar',
    'Ração Militar',
    'uncommon',
    'racao_militar.png',
  ),
  'item-anime-naruto-papel-chakra': animeItem(
    'item-anime-naruto-papel-chakra',
    'Papel de Chakra',
    'uncommon',
    'papel_chakra.svg',
  ),

  // Raro
  'item-anime-naruto-mascara-anbu': animeItem(
    'item-anime-naruto-mascara-anbu',
    'Máscara ANBU',
    'rare',
    'mascara_anbu.png',
  ),
  'item-anime-naruto-tanto': animeItem(
    'item-anime-naruto-tanto',
    'Tantō',
    'rare',
    'tanto.png',
  ),
  'item-anime-naruto-pergaminho-selamento': animeItem(
    'item-anime-naruto-pergaminho-selamento',
    'Pergaminho de Selamento',
    'rare',
    'pergaminho_selamento.png',
  ),
  'item-anime-naruto-colete-tatico': animeItem(
    'item-anime-naruto-colete-tatico',
    'Colete Tático',
    'rare',
    'colete_tatico.png',
  ),
  'item-anime-naruto-livro-bingo': animeItem(
    'item-anime-naruto-livro-bingo',
    'Livro Bingo',
    'rare',
    'livro_bingo.png',
  ),
  'item-anime-naruto-fuma-shuriken': animeItem(
    'item-anime-naruto-fuma-shuriken',
    'Fūma Shuriken',
    'rare',
    'fuma_shuriken.svg',
  ),

  // Épico
  'item-anime-naruto-frasco-veneno': animeItem(
    'item-anime-naruto-frasco-veneno',
    'Frasco de Veneno',
    'epic',
    'frasco_veneno.png',
  ),
  'item-anime-naruto-peca-marionete': animeItem(
    'item-anime-naruto-peca-marionete',
    'Peça de Marionete',
    'epic',
    'peca_marionete.png',
  ),
  'item-anime-naruto-casulo-insetos': animeItem(
    'item-anime-naruto-casulo-insetos',
    'Casulo de Insetos',
    'epic',
    'casulo_insetos.png',
  ),
  'item-anime-naruto-selo-elemental': animeItem(
    'item-anime-naruto-selo-elemental',
    'Selo Elemental',
    'epic',
    'selo_elemental.png',
  ),
  'item-anime-naruto-cabaca-areia': animeItem(
    'item-anime-naruto-cabaca-areia',
    'Cabaça de Areia',
    'epic',
    'cabaca_areia.png',
  ),
  'item-anime-naruto-lente-ocular': animeItem(
    'item-anime-naruto-lente-ocular',
    'Lente Ocular',
    'epic',
    'lente_ocular.png',
  ),

  // Lendário
  'item-anime-naruto-fragmento-bestial': animeItem(
    'item-anime-naruto-fragmento-bestial',
    'Fragmento de Chakra Bestial',
    'legendary',
    'fragmento_bestial.png',
  ),
  'item-anime-naruto-nucleo-chakra': animeItem(
    'item-anime-naruto-nucleo-chakra',
    'Núcleo de Chakra Puro',
    'legendary',
    'nucleo_chakra.png',
  ),
  'item-anime-naruto-presa-ninken': animeItem(
    'item-anime-naruto-presa-ninken',
    'Presa de Cão Ninja',
    'legendary',
    'presa_ninken.png',
  ),
  'item-anime-naruto-contrato-invocacao': animeItem(
    'item-anime-naruto-contrato-invocacao',
    'Contrato de Invocação',
    'legendary',
    'contrato_invocacao.svg',
  ),

  // Mítico
  'item-anime-naruto-pergaminho-proibido': animeItem(
    'item-anime-naruto-pergaminho-proibido',
    'Pergaminho Proibido',
    'mythic',
    'pergaminho_proibido.svg',
  ),
  'item-anime-naruto-fragmento-personagem': animeItem(
    'item-anime-naruto-fragmento-personagem',
    'Fragmento de Personagem',
    'mythic',
    'fragmento_personagem.svg',
  ),
  /**
   * Legado: existia só para refino de Potencial (Poder/Sorte/Fortuna), removido.
   * Permanece no registry para não quebrar inventários/saves. Sem uso no jogo.
   * Pode ser apagado definitivamente numa limpeza futura de itens mortos.
   */
  'item-cristal-refinamento': animeItem(
    'item-cristal-refinamento',
    'Cristal de Refinamento',
    'epic',
    'pergaminho_proibido.svg',
  ),

  // Fragmentos por personagem (tier define %; personagem define o item)
  ...Object.fromEntries(
    listNarutoTierCharacterIds().map((characterId) => {
      const id = narutoFragmentItemId(characterId);
      const label = NARUTO_CHARACTER_LABEL[characterId] ?? characterId;
      return [
        id,
        animeItem(id, `Fragmento de ${label}`, 'mythic', 'fragmento_personagem.svg'),
      ];
    }),
  ),

  // —— Bleach ——
  'item-anime-bleach-soul-candy': {
    id: 'item-anime-bleach-soul-candy',
    name: 'Doce de Alma',
    rarity: 'common',
    stackMax: 99,
  },
  'item-anime-bleach-zanpakuto-flake': {
    id: 'item-anime-bleach-zanpakuto-flake',
    name: 'Lasca de Zanpakutō',
    rarity: 'uncommon',
    stackMax: 99,
  },
  'item-anime-bleach-reiatsu': {
    id: 'item-anime-bleach-reiatsu',
    name: 'Fragmento de Reiatsu',
    rarity: 'rare',
    stackMax: 50,
  },

  // —— One Piece ——
  'item-anime-op-berry': {
    id: 'item-anime-op-berry',
    name: 'Berry',
    rarity: 'common',
    stackMax: 999,
  },
  'item-anime-op-map-scrap': {
    id: 'item-anime-op-map-scrap',
    name: 'Pedaço de Mapa Marítimo',
    rarity: 'uncommon',
    stackMax: 99,
  },
  'item-anime-op-log-pose': {
    id: 'item-anime-op-log-pose',
    name: 'Fragmento de Log Pose',
    rarity: 'rare',
    stackMax: 50,
  },

  // —— Hunter × Hunter ——
  'item-anime-hxh-license-scrap': {
    id: 'item-anime-hxh-license-scrap',
    name: 'Lasca de Licença de Caçador',
    rarity: 'common',
    stackMax: 99,
  },
  'item-anime-hxh-card': {
    id: 'item-anime-hxh-card',
    name: 'Carta de Greed Island',
    rarity: 'uncommon',
    stackMax: 99,
  },
  'item-anime-hxh-nen-crystal': {
    id: 'item-anime-hxh-nen-crystal',
    name: 'Cristal de Nen',
    rarity: 'rare',
    stackMax: 50,
  },

  // —— Jujutsu Kaisen ——
  'item-anime-jjk-ofuda': {
    id: 'item-anime-jjk-ofuda',
    name: 'Talismã Amaldiçoado',
    rarity: 'common',
    stackMax: 99,
  },
  'item-anime-jjk-finger-ward': {
    id: 'item-anime-jjk-finger-ward',
    name: 'Vedação Residual',
    rarity: 'uncommon',
    stackMax: 99,
  },
  'item-anime-jjk-cursed-energy': {
    id: 'item-anime-jjk-cursed-energy',
    name: 'Fragmento de Energia Amaldiçoada',
    rarity: 'rare',
    stackMax: 50,
  },

  // —— Dragon Ball ——
  'item-anime-db-capsule': {
    id: 'item-anime-db-capsule',
    name: 'Cápsula da Corporação',
    rarity: 'common',
    stackMax: 99,
  },
  'item-anime-db-sensu-leaf': {
    id: 'item-anime-db-sensu-leaf',
    name: 'Folha de Senzu Seca',
    rarity: 'uncommon',
    stackMax: 99,
  },
  'item-anime-db-ki-spark': {
    id: 'item-anime-db-ki-spark',
    name: 'Faísca de Ki',
    rarity: 'rare',
    stackMax: 50,
  },
};

/** Pools legadas / UI — a caça Naruto rola em `rollNarutoCharacterLoot`. */
export const NARUTO_LOOT_POOLS: Record<ItemRarity, readonly string[]> = {
  common: [
    'item-anime-naruto-essencia-chakra',
    'item-anime-naruto-kunai-gasta',
    'item-anime-naruto-shuriken',
    'item-anime-naruto-papel-bomba',
    'item-anime-naruto-bandagem',
    'item-anime-naruto-pilula-soldado',
    'item-anime-naruto-fio-aco',
    'item-anime-naruto-bandana-riscada',
  ],
  uncommon: [
    'item-anime-naruto-pergaminho-basico',
    'item-anime-naruto-bolsa-shuriken',
    'item-anime-naruto-racao-militar',
    'item-anime-naruto-papel-chakra',
  ],
  rare: [
    'item-anime-naruto-mascara-anbu',
    'item-anime-naruto-tanto',
    'item-anime-naruto-pergaminho-selamento',
    'item-anime-naruto-colete-tatico',
    'item-anime-naruto-livro-bingo',
    'item-anime-naruto-fuma-shuriken',
  ],
  epic: [
    'item-anime-naruto-frasco-veneno',
    'item-anime-naruto-peca-marionete',
    'item-anime-naruto-casulo-insetos',
    'item-anime-naruto-selo-elemental',
    'item-anime-naruto-cabaca-areia',
    'item-anime-naruto-lente-ocular',
  ],
  legendary: [
    'item-anime-naruto-fragmento-bestial',
    'item-anime-naruto-nucleo-chakra',
    'item-anime-naruto-presa-ninken',
    'item-anime-naruto-contrato-invocacao',
  ],
  mythic: [
    'item-anime-naruto-pergaminho-proibido',
    // fragmentos por personagem vivem em ANIME_LOOT_ITEMS; genérico = fallback
    'item-anime-naruto-fragmento-personagem',
  ],
};

/**
 * Trio legado (outros animes): 1 material por raridade comum/incomum/raro.
 * Naruto na caça: `rollNarutoCharacterLoot` (raridade + assinatura).
 */
export const ANIME_MATERIAL_TRIO: Record<
  AnimeId,
  { common: string; uncommon: string; rare: string }
> = {
  naruto: {
    common: 'item-anime-naruto-essencia-chakra',
    uncommon: 'item-anime-naruto-pergaminho-basico',
    rare: 'item-anime-naruto-mascara-anbu',
  },
  bleach: {
    common: 'item-anime-bleach-soul-candy',
    uncommon: 'item-anime-bleach-zanpakuto-flake',
    rare: 'item-anime-bleach-reiatsu',
  },
  'one-piece': {
    common: 'item-anime-op-berry',
    uncommon: 'item-anime-op-map-scrap',
    rare: 'item-anime-op-log-pose',
  },
  hunter: {
    common: 'item-anime-hxh-license-scrap',
    uncommon: 'item-anime-hxh-card',
    rare: 'item-anime-hxh-nen-crystal',
  },
  jujutsu: {
    common: 'item-anime-jjk-ofuda',
    uncommon: 'item-anime-jjk-finger-ward',
    rare: 'item-anime-jjk-cursed-energy',
  },
  'dragon-ball': {
    common: 'item-anime-db-capsule',
    uncommon: 'item-anime-db-sensu-leaf',
    rare: 'item-anime-db-ki-spark',
  },
};
