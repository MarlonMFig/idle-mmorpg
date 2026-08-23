import { getCharacterDefinition } from '@/data/characters';
import { resolveCharacterLineageId } from '@/data/character-lineages';
import type { LineageId } from '@/types/character-meta';
import type { CharacterDefinition } from '@/types/character-definition';
import type { SealedCharacter } from '@/types/team';

export function resolveDefinitionLineageId(
  definition: Pick<CharacterDefinition, 'lineageId'> | null | undefined,
): LineageId | null {
  return definition?.lineageId ?? null;
}

/** Afinidade do personagem — fonte: CharacterDefinition. */
export function getCharacterLineageId(
  characterId: string | null | undefined,
): LineageId | null {
  if (!characterId) return null;
  const def = getCharacterDefinition(characterId);
  if (def?.lineageId) return def.lineageId;
  return null;
}

/** Instância → definition; fallback legado (save antigo com clanId/lineageId). */
export function getInstanceLineageId(
  instance: Pick<SealedCharacter, 'characterId' | 'lineageId' | 'clanId' | 'lookType' | 'starterId' | 'sourceId'>,
): LineageId {
  const fromDef = getCharacterLineageId(instance.characterId);
  if (fromDef) return fromDef;
  if (instance.lineageId) return instance.lineageId;
  if (instance.clanId) return instance.clanId;
  return resolveCharacterLineageId({
    lookType: instance.lookType,
    starterId: instance.starterId,
    sourceId: instance.sourceId,
  });
}

/**
 * Compatibilidade futura para bônus `appliesTo: compatibleCharacters`.
 * Sem penalidade quando incompatível.
 */
export function isCharacterCompatibleWithLineage(
  character: Pick<CharacterDefinition, 'lineageId'> | Pick<SealedCharacter, 'characterId' | 'lineageId' | 'clanId' | 'lookType' | 'starterId' | 'sourceId'>,
  playerLineageId: LineageId | null | undefined,
): boolean {
  if (!playerLineageId) return false;
  const charLineage =
    'lineageId' in character && character.lineageId && !('characterId' in character)
      ? character.lineageId
      : getInstanceLineageId(character as SealedCharacter);
  return charLineage === playerLineageId;
}
