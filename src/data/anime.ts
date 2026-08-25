import { getCuratedPackByLookType } from '@/data/character-packs';
import { hasNarutoLootProfile } from '@/data/naruto-loot-tiers';
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
      'choji',
      'haku',
      'pain',
      'danzo',
      'danzou',
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
  const parts = new Set(lower.split(/[^a-z0-9]+/g).filter(Boolean));
  for (const group of SOURCE_HINTS) {
    for (const token of group.tokens) {
      if (token.includes('-')) {
        if (lower.includes(token)) return group.anime;
      } else if (parts.has(token)) {
        return group.anime;
      }
    }
  }
  return null;
}

/**
 * Mundo/anime sem fallback silencioso para Naruto.
 * Tokens delimitados + lookType→pack. Não usa includes fuzzy.
 */
export function resolveWorldId(input: {
  lookType?: number | null;
  source?: string | null;
  sourceId?: string | null;
}): AnimeId | null {
  if (input.source) {
    const fromSource = matchSourceHint(input.source);
    if (fromSource) return fromSource;
  }
  if (input.sourceId) {
    const fromId = matchSourceHint(input.sourceId);
    if (fromId) return fromId;
    const packId = input.sourceId.trim();
    if (hasNarutoLootProfile(packId)) return 'naruto';
  }
  if (input.lookType != null) {
    const packId = getCuratedPackByLookType(input.lookType)?.id ?? null;
    if (packId && hasNarutoLootProfile(packId)) return 'naruto';
  }
  return null;
}

export function resolveAnimeId(input: {
  lookType?: number | null;
  source?: string | null;
  sourceId?: string | null;
}): AnimeId {
  return resolveWorldId(input) ?? 'naruto';
}

export function isAnimeId(value: unknown): value is AnimeId {
  return typeof value === 'string' && (ANIME_IDS as readonly string[]).includes(value);
}
