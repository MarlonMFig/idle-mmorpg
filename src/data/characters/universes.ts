import { BLACK_CLOVER_BY_SLUG } from '@/data/black-clover-packs';
import { JUJUTSU_KAISEN_BY_SLUG } from '@/data/jujutsu-kaisen-packs';
import { resolveAnimeId } from '@/data/anime';
import type { CharacterUniverse } from '@/types/character-definition';

/**
 * Organização lógica por universo.
 * Os packs continuam em `character-packs.ts` / geradores (migração gradual).
 * Novos personagens: registre o pack e, se o id não for óbvio, adicione aqui.
 */
const UNIVERSE_BY_PACK_ID: Record<string, CharacterUniverse> = {
  kenshin: 'kenshin',
  luffy: 'one-piece',
  'momo-hinamori': 'bleach',
  hitsugaya: 'bleach',
  ichigo: 'bleach',
  asta: 'black-clover',
  goku: 'dragon-ball',
  freeza: 'dragon-ball',
  gotenks: 'dragon-ball',
  'majin-boo': 'dragon-ball',
  piccolo: 'dragon-ball',
  gohan: 'dragon-ball',
  bardock: 'dragon-ball',
  beerus: 'dragon-ball',
  broly: 'dragon-ball',
};

const BLACK_CLOVER_IDS = new Set(Object.values(BLACK_CLOVER_BY_SLUG).map((pack) => pack.id));
const JJK_IDS = new Set(Object.values(JUJUTSU_KAISEN_BY_SLUG).map((pack) => pack.id));

function animeToUniverse(
  anime: ReturnType<typeof resolveAnimeId>,
): CharacterUniverse {
  if (anime === 'dragon-ball') return 'dragon-ball';
  if (anime === 'bleach') return 'bleach';
  if (anime === 'one-piece') return 'one-piece';
  if (anime === 'jujutsu') return 'jujutsu';
  if (anime === 'hunter') return 'hunter';
  return 'naruto';
}

export function resolveCharacterUniverse(
  packId: string,
  lookTypes: readonly number[] = [],
): CharacterUniverse {
  const explicit = UNIVERSE_BY_PACK_ID[packId];
  if (explicit) return explicit;
  if (BLACK_CLOVER_IDS.has(packId)) return 'black-clover';
  if (JJK_IDS.has(packId)) return 'jujutsu';
  return animeToUniverse(
    resolveAnimeId({
      sourceId: packId,
      lookType: lookTypes[0],
    }),
  );
}
