import {
  HITSUGAYA_CURATED_LOOK_TYPE,
  MOMO_HINAMORI_CURATED_LOOK_TYPE,
} from '@/data/character-packs';
import { ANIME_IDS, type AnimeId } from '@/types/anime';

/**
 * lookTypes Bleach / Shinigami (demais lookTypes curados → Naruto por padrão).
 * Ampliar quando packs de outras franquias entrarem.
 */
const BLEACH_LOOK_TYPES = new Set<number>([
  HITSUGAYA_CURATED_LOOK_TYPE,
  MOMO_HINAMORI_CURATED_LOOK_TYPE,
]);

/** Tokens em source / sourceId → anime. */
const SOURCE_HINTS: Array<{ anime: AnimeId; tokens: readonly string[] }> = [
  {
    anime: 'bleach',
    tokens: ['bleach', 'hitsugaya', 'hinamori', 'shinigami', 'ichigo', 'aizen', 'rukia'],
  },
  {
    anime: 'one-piece',
    tokens: ['one-piece', 'onepiece', 'luffy', 'zoro', 'nami', 'sanji', 'pirate'],
  },
  {
    anime: 'hunter',
    tokens: ['hunter', 'hxh', 'gon', 'killua', 'kurapika', 'hisoka'],
  },
  {
    anime: 'jujutsu',
    tokens: ['jujutsu', 'jjk', 'gojo', 'yuji', 'megumi', 'sukuna'],
  },
  {
    anime: 'dragon-ball',
    tokens: ['dragon-ball', 'dragonball', 'goku', 'vegeta', 'gohan', 'piccolo'],
  },
  {
    anime: 'naruto',
    tokens: [
      'naruto',
      'sasuke',
      'sakura',
      'kakashi',
      'itachi',
      'gaara',
      'hinata',
      'neji',
      'shino',
      'tenten',
      'temari',
      'deidara',
      'kisame',
      'orochimaru',
      'jiraiya',
      'tsunade',
      'kabuto',
      'kiba',
      'chouji',
      'ino',
      'guy',
      'lee',
      'kimimaro',
      'tayuya',
      'jirobo',
    ],
  },
];

function matchSourceHint(text: string): AnimeId | null {
  const lower = text.toLowerCase();
  for (const group of SOURCE_HINTS) {
    for (const token of group.tokens) {
      if (lower.includes(token)) return group.anime;
    }
  }
  return null;
}

/**
 * Resolve a franquia do alvo de caça / monstro.
 * Ordem: source → sourceId → lookType especial → default Naruto.
 */
export function resolveAnimeId(input: {
  lookType?: number | null;
  source?: string | null;
  sourceId?: string | null;
}): AnimeId {
  if (input.source) {
    const fromSource = matchSourceHint(input.source);
    if (fromSource) return fromSource;
  }
  if (input.sourceId) {
    const fromId = matchSourceHint(input.sourceId);
    if (fromId) return fromId;
  }
  if (input.lookType != null && BLEACH_LOOK_TYPES.has(input.lookType)) {
    return 'bleach';
  }
  return 'naruto';
}

export function isAnimeId(value: unknown): value is AnimeId {
  return typeof value === 'string' && (ANIME_IDS as readonly string[]).includes(value);
}
