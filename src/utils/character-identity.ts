import { DEFAULT_OBTAIN_QUALITY } from '@/constants/character-progression';
import { startingStarsForQuality } from '@/constants/aiw-quality';
import { resolveCharacterClan } from '@/data/character-clans';
import { rollCharacterPotential, normalizePotential } from '@/lib/potential';
import type { CharacterClanId, CharacterQuality, CharacterStars } from '@/types/character-meta';
import { CHARACTER_CLAN_IDS, CHARACTER_QUALITIES } from '@/types/character-meta';
import type { StarterCharacterId } from '@/types/player-creation';
import type { SealedCharacter } from '@/types/team';

const QUALITY_SET = new Set<string>(CHARACTER_QUALITIES);

export function createCharacterInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Chave de identidade para forja (mesmo personagem = mesmo key). */
export function characterKeyFromLookType(lookType: number): string {
  return `look:${lookType}`;
}

export function isCharacterQuality(value: unknown): value is CharacterQuality {
  return typeof value === 'string' && QUALITY_SET.has(value);
}

export function isCharacterClanId(value: unknown): value is CharacterClanId {
  return typeof value === 'string' && (CHARACTER_CLAN_IDS as readonly string[]).includes(value);
}

export function clampCharacterStars(value: unknown, quality: CharacterQuality = 'D'): CharacterStars {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return startingStarsForQuality(quality) as CharacterStars;
  }
  const n = Math.max(0, Math.min(8, Math.floor(value)));
  return n as CharacterStars;
}

/** 0 = legado sem nível (migrar da conta). */
export function clampCharacterLevel(value: unknown, fallback = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(9999, Math.floor(value)));
}

export function clampCharacterXp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function buildSealedCharacter(input: {
  id?: string;
  name: string;
  lookType: number;
  sourceId: string | null;
  starterId: StarterCharacterId | null;
  previewUrl?: string;
  quality?: CharacterQuality;
  stars?: CharacterStars;
  clanId?: CharacterClanId;
  level?: number;
  xp?: number;
  isFavorite?: boolean;
  isLocked?: boolean;
  characterKey?: string;
  potential?: import('@/types/potential').CharacterPotential;
}): Omit<SealedCharacter, 'previewUrl'> & { previewUrl?: string } {
  const lookType = input.lookType;
  const quality = input.quality ?? DEFAULT_OBTAIN_QUALITY;
  return {
    id: input.id ?? createCharacterInstanceId(),
    characterKey: input.characterKey ?? characterKeyFromLookType(lookType),
    name: input.name,
    lookType,
    sourceId: input.sourceId,
    starterId: input.starterId,
    previewUrl: input.previewUrl,
    quality,
    stars: input.stars ?? (startingStarsForQuality(quality) as CharacterStars),
    potential: input.potential ?? rollCharacterPotential(),
    clanId: input.clanId ?? resolveCharacterClan({ lookType, starterId: input.starterId }),
    level: Math.max(1, clampCharacterLevel(input.level, 1)),
    xp: clampCharacterXp(input.xp),
    isFavorite: input.isFavorite ?? false,
    isLocked: input.isLocked ?? false,
  };
}

/**
 * Normaliza unidade legada (sessão v1) → schema atual.
 * Qualidade natural default D; não inventa ranks.
 */
export function normalizeSealedCharacter(raw: unknown): SealedCharacter | null {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as Record<string, unknown>;
  if (typeof entry.id !== 'string' || !entry.id) return null;
  if (typeof entry.name !== 'string' || !entry.name) return null;
  if (typeof entry.lookType !== 'number' || !Number.isFinite(entry.lookType)) return null;

  const starterId =
    entry.starterId === null || entry.starterId === undefined
      ? null
      : typeof entry.starterId === 'string'
        ? (entry.starterId as StarterCharacterId)
        : null;
  const sourceId =
    entry.sourceId === null || entry.sourceId === undefined
      ? null
      : typeof entry.sourceId === 'string'
        ? entry.sourceId
        : null;

  const hasOwnLevel =
    typeof entry.level === 'number' && Number.isFinite(entry.level) && entry.level >= 1;

  const built = buildSealedCharacter({
    id: entry.id,
    name: entry.name,
    lookType: entry.lookType,
    sourceId,
    starterId,
    previewUrl: typeof entry.previewUrl === 'string' ? entry.previewUrl : undefined,
    characterKey:
      typeof entry.characterKey === 'string' && entry.characterKey
        ? entry.characterKey
        : undefined,
    quality: isCharacterQuality(entry.quality) ? entry.quality : DEFAULT_OBTAIN_QUALITY,
    stars: clampCharacterStars(
      entry.stars,
      isCharacterQuality(entry.quality) ? entry.quality : DEFAULT_OBTAIN_QUALITY,
    ),
    potential: normalizePotential(entry.potential) ?? rollCharacterPotential(),
    clanId: isCharacterClanId(entry.clanId)
      ? entry.clanId
      : resolveCharacterClan({ lookType: entry.lookType, starterId }),
    level: hasOwnLevel ? clampCharacterLevel(entry.level) : 1,
    xp: clampCharacterXp(entry.xp),
    isFavorite: entry.isFavorite === true,
    isLocked: entry.isLocked === true,
  });

  return {
    ...built,
    // 0 = save legado sem nível por personagem (migrar da conta).
    level: hasOwnLevel ? built.level : 0,
    previewUrl: built.previewUrl ?? '',
  };
}
