import { WONSR_JUTSU_REFERENCE } from '@/data/wonsr-jutsu-reference';
import {
  GENERIC_CHARACTER_SKILL_IDS,
  getCharacterProgressionSkillIds,
} from '@/data/character-skill-progression';
import type { SealedCharacter } from '@/types/team';
import type { StarterCharacterId } from '@/types/player-creation';

/** Slugs WONSR conhecidos (pastas de spells). */
const KNOWN_SLUGS = new Set(
  WONSR_JUTSU_REFERENCE.map((jutsu) => jutsu.character).filter((slug) => slug !== 'all'),
);

/** Aliases nome do personagem → slug WONSR. */
const NAME_ALIASES: Record<string, string> = {
  naruto: 'naruto',
  'uzumaki naruto': 'naruto',
  sasuke: 'sasuke',
  'uchiha sasuke': 'sasuke',
  'rock lee': 'lee',
  lee: 'lee',
  sakura: 'sakura',
  'sakura haruno': 'sakura',
  kakashi: 'kakashi',
  'hatake kakashi': 'kakashi',
  itachi: 'itachi',
  'uchiha itachi': 'itachi',
  shisui: 'shisui',
  'uchiha shisui': 'shisui',
  'naruto shippuden': 'naruto',
  'uzumaki naruto shippuden': 'naruto',
  goku: 'goku',
  'son goku': 'goku',
  freeza: 'freeza',
  frieza: 'freeza',
  gaara: 'gaara',
  hinata: 'hinata',
  'hinata hyuga': 'hinata',
  asta: 'asta',
  mereoleona: 'mereoleona',
  vanica: 'vanica',
  zenon: 'zenon',
  noelle: 'noelle',
  'noelle silva': 'noelle',
  yuno: 'yuno-spirit-dive',
  yami: 'yami',
  luffy: 'luffy',
  'monkey d luffy': 'luffy',
  neji: 'neji',
  'neji hyuga': 'neji',
  shikamaru: 'shikamaru',
  'shikamaru nara': 'shikamaru',
  choji: 'chouji',
  chouji: 'chouji',
  'choji akimichi': 'chouji',
  'chouji akimichi': 'chouji',
  ino: 'ino',
  'ino yamanaka': 'ino',
  tenten: 'tenten',
  'mitsashi tenten': 'tenten',
  minato: 'minato',
  'namikaze minato': 'minato',
  jiraiya: 'jiraya',
  jiraya: 'jiraya',
  tsunade: 'tsunade',
  orochimaru: 'orochimaru',
  madara: 'madara',
  'uchiha madara': 'madara',
  obito: 'obito',
  'uchiha obito': 'obito',
  bee: 'killerbee',
  'killer bee': 'killerbee',
  killerbee: 'killerbee',
  kankuro: 'kankuro',
  temari: 'temari',
  jirobo: 'jirobo',
  jiroubou: 'jirobo',
  'jirou bou': 'jirobo',
  kabuto: 'kabuto',
  'yakushi kabuto': 'kabuto',
  kiba: 'kiba',
  'inuzuka kiba': 'kiba',
  kimimaro: 'kimimaro',
  'sasuke cursed': 'sasuke',
  deidara: 'deidara',
  kisame: 'kisame',
  shino: 'shino',
  'aburame shino': 'shino',
  kenshin: 'kenshin',
  himura: 'kenshin',
  'kenshin himura': 'kenshin',
  'himura kenshin': 'kenshin',
  tayuya: 'tayuya',
  'sakura shippuden': 'sakura',
  momo: 'momo-hinamori',
  'momo hinamori': 'momo-hinamori',
  hinamori: 'momo-hinamori',
  'momo-hinamori': 'momo-hinamori',
  hitsugaya: 'hitsugaya',
  toshiro: 'hitsugaya',
  'toshiro hitsugaya': 'hitsugaya',
  pain: 'pain',
  danzo: 'danzou',
  danzou: 'danzou',
  'danzo shimura': 'danzou',
  konan: 'konan',
  hidan: 'hidan',
  kakuzu: 'kakuzu',
  sasori: 'sasori',
};

const STARTER_SLUG: Record<StarterCharacterId, string> = {
  'naruto-classic': 'naruto',
  'sasuke-classic': 'sasuke',
  'rock-lee': 'lee',
};

/** Quatro habilidades neutras quando não há match confiável de personagem. */
const FALLBACK_SKILLS = GENERIC_CHARACTER_SKILL_IDS;

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolve o slug WONSR a partir do nome / sourceId do personagem selado.
 */
export function resolveWonsrCharacterSlug(member: SealedCharacter): string | null {
  if (member.starterId) return STARTER_SLUG[member.starterId] ?? null;

  const fromName = NAME_ALIASES[normalizeName(member.name)];
  if (fromName && KNOWN_SLUGS.has(fromName)) return fromName;

  // sourceId às vezes carrega o nome (ex.: wonsr-character-uzumaki-naruto).
  if (member.sourceId) {
    const tokens = normalizeName(member.sourceId.replace(/^wonsr-(vocation|character)-/, ''));
    const alias = NAME_ALIASES[tokens];
    if (alias && KNOWN_SLUGS.has(alias)) return alias;

    for (const slug of KNOWN_SLUGS) {
      if (tokens.includes(slug) || tokens.includes(slug.replace(/bee$/, ' bee'))) {
        return slug;
      }
    }
  }

  // Última tentativa: última palavra do nome bate com um slug.
  const parts = normalizeName(member.name).split(' ');
  for (const part of parts) {
    const alias = NAME_ALIASES[part];
    if (alias && KNOWN_SLUGS.has(alias)) return alias;
    if (KNOWN_SLUGS.has(part)) return part;
  }

  return null;
}

/**
 * Quatro habilidades próprias do personagem; sem match confiável → neutras.
 */
export function resolveHotbarSkillIds(member: SealedCharacter): readonly string[] {
  if (member.starterId) {
    // Packs curados — import circular evitado via skills.getHotbarSkillIdsForStarter no caller.
    return [];
  }

  const slug = resolveWonsrCharacterSlug(member);
  if (!slug) return FALLBACK_SKILLS;
  return getCharacterProgressionSkillIds(slug);
}

export { FALLBACK_SKILLS };
