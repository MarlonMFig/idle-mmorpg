import type { CharacterUniverse } from '@/types/character-definition';

/** Roster atual: somente Naruto. */
export function resolveCharacterUniverse(
  _packId: string,
  _lookTypes: readonly number[] = [],
): CharacterUniverse {
  return 'naruto';
}
