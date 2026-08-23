import { resolveCharacterPack } from '@/data/resolve-character-pack';
import { CharacterRegistry, getCharacterDefinitionByLookType } from '@/data/characters';
import { getDevTestCatalogLookType, isDevMode } from '@/config/devConfig';
import type { WonsrSpriteIndex } from '@/data/wonsr-sprites';
import { characterLabStore } from '@/stores/character-lab-store';
import { attributesStore } from '@/stores/attributes-store';
import { locationStore } from '@/stores/location-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import type { StarterCharacterId } from '@/types/player-creation';

/**
 * Troca o personagem ativo: hotbar, atributos (nível/estrelas do personagem)
 * e reload da cena. Nível da conta (vitals) não muda.
 */
export function switchActiveCharacter(
  instanceId: string,
  spriteIndex?: WonsrSpriteIndex | null,
): boolean {
  if (!teamStore.setActive(instanceId)) return false;

  const member = teamStore.getActive();
  const pack = resolveCharacterPack(member, member?.starterId ?? 'naruto-classic', spriteIndex);
  skillsStore.applyCharacterHotbar(pack.hotbarSkillIds);
  attributesStore.onActiveCharacterChanged(true);
  locationStore.reloadScene();
  return true;
}

/** Pack do membro ativo (para GameScene / Preload). */
export function getActiveCharacterPack(
  fallbackStarterId: StarterCharacterId,
  spriteIndex?: WonsrSpriteIndex | null,
) {
  return resolveCharacterPack(teamStore.getActive(), fallbackStarterId, spriteIndex);
}

/**
 * Pack usado no spawn. Se o Test Mode tiver `testCatalogLookType`, usa o catálogo
 * sem tocar na coleção oficial.
 */
export function getSpawnCharacterPack(
  fallbackStarterId: StarterCharacterId,
  spriteIndex?: WonsrSpriteIndex | null,
) {
  if (isDevMode()) {
    const lab = characterLabStore.getSnapshot();
    if (lab.isOpen && lab.playerId) {
      const def = CharacterRegistry.get(lab.playerId);
      if (def) return def.pack;
    }
  }
  const testLook = getDevTestCatalogLookType();
  if (testLook != null) {
    const curated = getCharacterDefinitionByLookType(testLook, { includeInactive: true });
    if (curated) return curated.pack;
  }
  return getActiveCharacterPack(fallbackStarterId, spriteIndex);
}
