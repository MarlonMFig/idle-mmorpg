import {
  getSealingScrollTiersHighFirst,
  type SealingScrollTier,
} from '@/constants/sealing';
import { DEFAULT_OBTAIN_QUALITY } from '@/constants/character-progression';
import { resolveCharacterClan } from '@/data/character-clans';
import { emitSystemMessage } from '@/lib/system-log';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import type { EnemyDefinition } from '@/types/enemy';
import {
  buildSealedCharacter,
  createCharacterInstanceId,
} from '@/utils/character-identity';

export type SealAttemptResult =
  | { kind: 'skipped'; reason: 'not-sealable' | 'no-scroll' }
  | { kind: 'failed' }
  | { kind: 'success'; characterId: string; name: string; scrollId: string };

export type SealRng = () => number;

/** Escolhe o pergaminho de maior tier disponível (Lendário → Comum). */
export function pickSealingScroll(): SealingScrollTier | null {
  for (const tier of getSealingScrollTiersHighFirst()) {
    if (inventoryStore.countItem(tier.itemId) >= 1) return tier;
  }
  return null;
}

/**
 * Tenta selar o inimigo morto: 1 pergaminho por tentativa.
 * Prioriza pergaminho de maior raridade (melhor chance).
 * Duplicatas do mesmo personagem são permitidas (forja de estrelas).
 */
export function trySealEnemy(
  definition: EnemyDefinition,
  rng: SealRng = Math.random,
): SealAttemptResult {
  const seal = definition.sealable;
  if (!seal) return { kind: 'skipped', reason: 'not-sealable' };

  const scroll = pickSealingScroll();
  if (!scroll) {
    return { kind: 'skipped', reason: 'no-scroll' };
  }

  if (!inventoryStore.removeItem(scroll.itemId, 1)) {
    return { kind: 'skipped', reason: 'no-scroll' };
  }

  if (rng() >= scroll.successChance) {
    emitSystemMessage(`Selamento falhou: ${seal.name} escapou (${scroll.label}).`);
    return { kind: 'failed' };
  }

  const instance = buildSealedCharacter({
    id: createCharacterInstanceId(),
    name: seal.name,
    lookType: seal.lookType,
    sourceId: seal.sourceId,
    starterId: null,
    quality: DEFAULT_OBTAIN_QUALITY,
    stars: 0,
    clanId: resolveCharacterClan({ lookType: seal.lookType }),
  });

  const added = teamStore.addToCollection(instance);

  if (!added) {
    inventoryStore.addItem(scroll.itemId, 1);
    emitSystemMessage('Selamento falhou: não foi possível adicionar à coleção.');
    return { kind: 'failed' };
  }

  emitSystemMessage(
    `Selamento bem-sucedido! ${seal.name} entrou na coleção (${scroll.label}).`,
  );
  return {
    kind: 'success',
    characterId: instance.id,
    name: seal.name,
    scrollId: scroll.itemId,
  };
}
