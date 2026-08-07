import { resolveCharacterPack } from '@/data/resolve-character-pack';
import type { WonsrSpriteIndex } from '@/data/wonsr-sprites';
import { locationStore } from '@/stores/location-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import type { StarterCharacterId } from '@/types/player-creation';

/**
 * Troca o personagem ativo: atualiza hotbar e reinicia a cena
 * sem limpar XP / inventário / progresso (`sessionStarted` permanece).
 */
export function switchActiveCharacter(
  characterId: string,
  spriteIndex?: WonsrSpriteIndex | null,
): boolean {
  if (!teamStore.setActive(characterId)) return false;

  const member = teamStore.getActive();
  const pack = resolveCharacterPack(member, member?.starterId ?? 'naruto-classic', spriteIndex);
  skillsStore.applyCharacterHotbar(pack.hotbarSkillIds);
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
