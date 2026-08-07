import { SEAL_SUCCESS_CHANCE, SEALING_SCROLL_ITEM_ID } from '@/constants/sealing';
import { emitSystemMessage } from '@/lib/system-log';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import type { EnemyDefinition } from '@/types/enemy';

export type SealAttemptResult =
  | { kind: 'skipped'; reason: 'not-sealable' | 'already-owned' | 'no-scroll' }
  | { kind: 'failed' }
  | { kind: 'success'; characterId: string; name: string };

export type SealRng = () => number;

/**
 * Tenta selar o inimigo morto: 1 pergaminho por tentativa elegível, 10% de chance.
 * Sem pergaminho ou personagem já obtido → sem tentativa nem consumo.
 */
export function trySealEnemy(
  definition: EnemyDefinition,
  rng: SealRng = Math.random,
): SealAttemptResult {
  const seal = definition.sealable;
  if (!seal) return { kind: 'skipped', reason: 'not-sealable' };

  if (teamStore.hasCharacter(seal.characterId) || teamStore.hasLookType(seal.lookType)) {
    return { kind: 'skipped', reason: 'already-owned' };
  }

  if (inventoryStore.countItem(SEALING_SCROLL_ITEM_ID) < 1) {
    return { kind: 'skipped', reason: 'no-scroll' };
  }

  if (!inventoryStore.removeItem(SEALING_SCROLL_ITEM_ID, 1)) {
    return { kind: 'skipped', reason: 'no-scroll' };
  }

  if (rng() >= SEAL_SUCCESS_CHANCE) {
    emitSystemMessage(`Selamento falhou: ${seal.name} escapou.`);
    return { kind: 'failed' };
  }

  const added = teamStore.addToCollection({
    id: seal.characterId,
    name: seal.name,
    lookType: seal.lookType,
    sourceId: seal.sourceId,
    starterId: null,
  });

  if (!added) {
    // Race defensiva: devolve o pergaminho se a coleção já tinha o personagem.
    inventoryStore.addItem(SEALING_SCROLL_ITEM_ID, 1);
    return { kind: 'skipped', reason: 'already-owned' };
  }

  emitSystemMessage(`Selamento bem-sucedido! ${seal.name} entrou na coleção.`);
  return { kind: 'success', characterId: seal.characterId, name: seal.name };
}
