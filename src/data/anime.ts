import { ANIME_IDS, type AnimeId } from '@/types/anime';

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
    tokens: [
      'jujutsu',
      'jjk',
      'gojo',
      'yuji',
      'itadori',
      'agito',
      'megumi',
      'sukuna',
      'mahito',
      'maki',
      'zenin',
      'toji',
    ],
  },
  {
    anime: 'dragon-ball',
    tokens: [
      'dragon-ball',
      'dragonball',
      'goku',
      'vegeta',
      'gohan',
      'bardock',
      'beerus',
      'broly',
      'piccolo',
      'freeza',
      'frieza',
    ],
  },
  {
    anime: 'naruto',
    tokens: [
      'naruto',
      'sasuke',
      'sakura',
      'kakashi',
      'itachi',
      'shisui',
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
  return 'naruto';
}

export function isAnimeId(value: unknown): value is AnimeId {
  return typeof value === 'string' && (ANIME_IDS as readonly string[]).includes(value);
}
