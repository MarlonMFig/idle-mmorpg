import {
  isCaptureEnemyTier,
  type CaptureEnemyTier,
} from '@/constants/capture-system';
import { getCuratedPackByLookType } from '@/data/character-packs';
import { getNarutoCharacterTier, type NarutoLootTier } from '@/data/naruto-loot-tiers';
import type { HuntSelectorTab } from '@/types/hunt';
import type { EnemyDefinition } from '@/types/enemy';

function lootTierToCapture(lootTier: NarutoLootTier): CaptureEnemyTier {
  if (lootTier <= 1) return 'comum';
  if (lootTier === 2) return 'elite';
  if (lootTier === 3) return 'raro';
  return 'chefe';
}

/** Spec: se não houver tier de personagem, usar faixas de nível. */
function captureTierFromLevel(level: number): CaptureEnemyTier {
  const n = Math.max(1, Math.floor(level) || 1);
  if (n >= 70) return 'chefe';
  if (n >= 40) return 'raro';
  if (n >= 20) return 'elite';
  return 'comum';
}

export function resolveCaptureEnemyTier(input: {
  captureTier?: CaptureEnemyTier | null;
  huntTab?: HuntSelectorTab | string | null;
  lookType?: number | null;
  characterId?: string | null;
  sourceId?: string | null;
  level?: number | null;
}): CaptureEnemyTier {
  if (isCaptureEnemyTier(input.captureTier)) return input.captureTier;
  if (input.huntTab === 'bosses') return 'chefe';

  const fromId = input.characterId ?? input.sourceId ?? null;
  const lootFromId = fromId ? getNarutoCharacterTier(fromId) : null;
  if (lootFromId) return lootTierToCapture(lootFromId);

  const packId =
    input.lookType != null ? (getCuratedPackByLookType(input.lookType)?.id ?? null) : null;
  const lootFromPack = packId ? getNarutoCharacterTier(packId) : null;
  if (lootFromPack) return lootTierToCapture(lootFromPack);

  return captureTierFromLevel(input.level ?? 1);
}

export function resolveCaptureEnemyTierFromDefinition(
  definition?: EnemyDefinition | null,
): CaptureEnemyTier {
  if (!definition) return 'comum';
  const seal = definition.sealable;
  return resolveCaptureEnemyTier({
    captureTier: seal?.captureTier,
    lookType: seal?.lookType ?? null,
    characterId: seal?.characterId ?? null,
    sourceId: seal?.sourceId ?? null,
    level: seal?.level ?? definition.level,
  });
}
