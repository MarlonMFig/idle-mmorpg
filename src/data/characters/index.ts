/**
 * Cadastro padronizado de personagens.
 *
 * Fonte de dados atual (não movida): `src/data/character-packs.ts` + geradores.
 * API estável: `getCharacterDefinition(id)` / `CharacterRegistry`.
 *
 * Adicionar personagem novo:
 * 1. Character pack (id permanente + sprites por animação)
 * 2. Skills no catálogo (`src/data/skills.ts` ou gerador)
 * 3. skillAnims + VFX no pack (hitDelay / fxScale / offsetX / offsetY)
 * 4. lookType no mapa CURATED + preview
 * 5. Hunt/catálogo quando quiser dropar
 */

export { CharacterRegistry, getCharacterDefinition, getCharacterDefinitionByLookType } from '@/data/characters/registry';
export { getPackAnimation, listAvailableAnimSlots } from '@/data/characters/animation-slots';
export { resolveCharacterUniverse } from '@/data/characters/universes';
export {
  getCharacterNature,
  getCharacterNatureLabel,
  CHARACTER_NATURE_BY_ID,
} from '@/data/character-natures';
export type { CharacterNatureId } from '@/data/character-natures';
export {
  runDevCharacterValidation,
  validateAllCharacterDefinitions,
  validateCharacterDefinition,
  validateLoadedCharacterAssets,
} from '@/data/characters/validation';
export type {
  CharacterAnimSlot,
  CharacterDefinition,
  CharacterSkillBinding,
  CharacterUniverse,
  VfxDefinition,
} from '@/types/character-definition';
