import { DEFAULT_OBTAIN_QUALITY } from '@/constants/character-progression';
import {
  derivePotentialFields,
  isCharacterPotential,
} from '@/constants/character-quality-stats';
import { backfillPotential, rollPotential } from '@/lib/raridade-potencial.js';
import {
  clampMasteryLevel,
  clampMasteryXp,
} from '@/constants/character-mastery';
import { clampAwakeningLevel, AWAKENING_DEFAULT_LEVEL } from '@/constants/character-awakening';
import { defaultMasteryProgress, isMaxMastery } from '@/lib/character-mastery';
import { getMaxStarsForRarity, getStartingStarsForRarity, MAX_PLAYER_LEVEL } from '@/config/gameConfig';
import { resolveCharacterLineageId } from '@/data/character-lineages';
import { getCharacterLineageId } from '@/lib/lineage-compatibility';
import type {
  CharacterGrade,
  CharacterPotential,
  CharacterQuality,
  CharacterStars,
  LineageId,
} from '@/types/character-meta';
import { LINEAGE_IDS, CHARACTER_QUALITIES } from '@/types/character-meta';
import type { StarterCharacterId } from '@/types/player-creation';
import { parseDecimal, type Decimal } from '@/lib/decimal';
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

export function resolveCharacterDefinitionId(input: {
  characterId?: string | null;
  sourceId?: string | null;
  starterId?: StarterCharacterId | null;
  lookType: number;
}): string {
  if (input.characterId && input.characterId.trim()) return input.characterId.trim();
  if (input.sourceId && input.sourceId.trim()) return input.sourceId.trim();
  if (input.starterId) return input.starterId;
  return characterKeyFromLookType(input.lookType);
}

export function isCharacterQuality(value: unknown): value is CharacterQuality {
  return typeof value === 'string' && QUALITY_SET.has(value);
}

export function isLineageId(value: unknown): value is LineageId {
  return typeof value === 'string' && (LINEAGE_IDS as readonly string[]).includes(value);
}

/** @deprecated use isLineageId */
export const isCharacterClanId = isLineageId;

/** Normaliza estrelas no load/save (não no render). Teto = getMaxStarsForRarity. */
export function clampCharacterStars(value: unknown, quality: CharacterQuality = 'D'): CharacterStars {
  const cap = getMaxStarsForRarity(quality);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return getStartingStarsForRarity(quality) as CharacterStars;
  }
  const n = Math.max(0, Math.min(cap, Math.floor(value)));
  return n as CharacterStars;
}

/** 0 = legado sem nível (migrar da conta). */
export function clampCharacterLevel(value: unknown, fallback = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(MAX_PLAYER_LEVEL, Math.floor(value)));
}

export function clampCharacterXp(value: unknown): Decimal {
  return parseDecimal(value);
}

export function buildSealedCharacter(input: {
  id?: string;
  name: string;
  lookType: number;
  sourceId: string | null;
  starterId: StarterCharacterId | null;
  previewUrl?: string;
  quality?: CharacterQuality;
  potential?: CharacterPotential;
  potentialTotal?: number;
  grade?: CharacterGrade;
  qualityStatMultiplier?: number;
  stars?: CharacterStars;
  clanId?: LineageId;
  lineageId?: LineageId;
  level?: number;
  xp?: number | Decimal;
  masteryLevel?: number;
  masteryXp?: number;
  awakeningLevel?: number;
  isFavorite?: boolean;
  isLocked?: boolean;
  characterKey?: string;
  characterId?: string;
  obtainedAt?: number;
}): Omit<SealedCharacter, 'previewUrl'> & { previewUrl?: string } {
  const lookType = input.lookType;
  const quality = input.quality ?? DEFAULT_OBTAIN_QUALITY;
  const potential = isCharacterPotential(input.potential)
    ? input.potential
    : typeof input.qualityStatMultiplier === 'number' && Number.isFinite(input.qualityStatMultiplier)
      ? backfillPotential(quality, input.qualityStatMultiplier)
      : rollPotential();
  const derived = derivePotentialFields(quality, potential);
  const characterId = resolveCharacterDefinitionId({
    characterId: input.characterId,
    sourceId: input.sourceId,
    starterId: input.starterId,
    lookType,
  });
  const resolvedLineage =
    input.lineageId ??
    input.clanId ??
    getCharacterLineageId(characterId) ??
    resolveCharacterLineageId({ lookType, starterId: input.starterId, sourceId: input.sourceId });
  return {
    id: input.id ?? createCharacterInstanceId(),
    characterId,
    characterKey: input.characterKey ?? characterKeyFromLookType(lookType),
    name: input.name,
    lookType,
    sourceId: input.sourceId,
    starterId: input.starterId,
    previewUrl: input.previewUrl,
    quality,
    potential: derived.potential,
    potentialTotal: derived.potentialTotal,
    grade: derived.grade,
    qualityStatMultiplier: derived.qualityStatMultiplier,
    stars: clampCharacterStars(
      input.stars ?? getStartingStarsForRarity(quality),
      quality,
    ),
    lineageId: resolvedLineage,
    clanId: resolvedLineage,
    level: Math.max(1, clampCharacterLevel(input.level, 1)),
    xp: clampCharacterXp(input.xp),
    masteryLevel: clampMasteryLevel(input.masteryLevel ?? defaultMasteryProgress().masteryLevel),
    masteryXp: isMaxMastery(input.masteryLevel ?? 0)
      ? 0
      : clampMasteryXp(input.masteryXp ?? defaultMasteryProgress().masteryXp),
    awakeningLevel: clampAwakeningLevel(input.awakeningLevel ?? AWAKENING_DEFAULT_LEVEL),
    isFavorite: input.isFavorite ?? false,
    isLocked: input.isLocked ?? false,
    obtainedAt: typeof input.obtainedAt === 'number' && Number.isFinite(input.obtainedAt)
      ? input.obtainedAt
      : undefined,
  };
}

/**
 * Normaliza unidade legada (sessão v1) → schema atual.
 * Qualidade natural default D; não inventa ranks.
 * Campos de Potential (poder/sorte/fortuna) são descartados.
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
    characterId: resolveCharacterDefinitionId({
      characterId: typeof entry.characterId === 'string' ? entry.characterId : null,
      sourceId,
      starterId,
      lookType: entry.lookType,
    }),
    quality: isCharacterQuality(entry.quality) ? entry.quality : DEFAULT_OBTAIN_QUALITY,
    potential: isCharacterPotential(entry.potential) ? entry.potential : undefined,
    qualityStatMultiplier:
      typeof entry.qualityStatMultiplier === 'number' && Number.isFinite(entry.qualityStatMultiplier)
        ? entry.qualityStatMultiplier
        : undefined,
    stars: clampCharacterStars(
      entry.stars,
      isCharacterQuality(entry.quality) ? entry.quality : DEFAULT_OBTAIN_QUALITY,
    ),
    lineageId: isLineageId(entry.lineageId)
      ? entry.lineageId
      : isLineageId(entry.clanId)
        ? entry.clanId
        : undefined,
    clanId: isLineageId(entry.clanId) ? entry.clanId : isLineageId(entry.lineageId) ? entry.lineageId : undefined,
    level: hasOwnLevel ? clampCharacterLevel(entry.level) : 1,
    xp: clampCharacterXp(entry.xp),
    masteryLevel: clampMasteryLevel(entry.masteryLevel),
    masteryXp: clampMasteryXp(entry.masteryXp),
    awakeningLevel: clampAwakeningLevel(entry.awakeningLevel),
    isFavorite: entry.isFavorite === true,
    isLocked: entry.isLocked === true,
    obtainedAt: typeof entry.obtainedAt === 'number' && Number.isFinite(entry.obtainedAt)
      ? entry.obtainedAt
      : undefined,
  });

  return {
    ...built,
    // 0 = save legado sem nível por personagem (migrar da conta).
    level: hasOwnLevel ? built.level : 0,
    previewUrl: built.previewUrl ?? '',
  };
}
