import { clampAwakeningLevel } from '@/constants/character-awakening';
import { isCharacterLabSession, characterLabStore } from '@/stores/character-lab-store';
import { teamStore } from '@/stores/team-store';

export interface AwakeningRuntimeContext {
  characterId: string | null;
  awakeningLevel: number;
  preview: boolean;
}

/**
 * Lab preview e Hunt usam o mesmo contexto de rewards.
 * Preview não grava awakeningLevel da CharacterInstance.
 */
export function resolveAwakeningRuntime(input?: {
  characterId?: string | null;
  instanceId?: string | null;
}): AwakeningRuntimeContext {
  const fallback: AwakeningRuntimeContext = {
    characterId: input?.characterId ?? null,
    awakeningLevel: 0,
    preview: false,
  };

  try {
    if (isCharacterLabSession()) {
      const lab = characterLabStore.getSnapshot();
      return {
        characterId: lab.playerId,
        awakeningLevel: clampAwakeningLevel(lab.previewAwakening ?? 0),
        preview: true,
      };
    }
  } catch {
    return fallback;
  }

  if (input?.instanceId && typeof teamStore?.getCharacterInstance === 'function') {
    const instance = teamStore.getCharacterInstance(input.instanceId);
    return {
      characterId: instance?.characterId ?? input.characterId ?? null,
      awakeningLevel: clampAwakeningLevel(instance?.awakeningLevel ?? 0),
      preview: false,
    };
  }

  const active = typeof teamStore?.getActive === 'function' ? teamStore.getActive() : null;
  return {
    characterId: active?.characterId ?? input?.characterId ?? null,
    awakeningLevel: clampAwakeningLevel(active?.awakeningLevel ?? 0),
    preview: false,
  };
}
