import {
  getSealingScrollTiersHighFirst,
  SEALING_SCROLL_TIERS,
  type SealingScrollTier,
  type SealingScrollTierId,
} from '@/constants/sealing';
import { DEFAULT_OBTAIN_QUALITY } from '@/constants/character-progression';
import { resolveCharacterClan } from '@/data/character-clans';
import { emitSystemMessage } from '@/lib/system-log';
import { helperStore } from '@/stores/helper-store';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import type { EnemyDefinition } from '@/types/enemy';
import {
  buildSealedCharacter,
  createCharacterInstanceId,
} from '@/utils/character-identity';

export type SealAttemptResult =
  | { kind: 'skipped'; reason: 'not-sealable' | 'no-scroll' | 'disabled' }
  | { kind: 'failed'; scrollId: string }
  | { kind: 'success'; characterId: string; name: string; scrollId: string };

export type SealRng = () => number;

export interface TrySealEnemyOptions {
  /** Ignora Auto Selamento (janela CAPTURA). */
  manual?: boolean;
}

function tierById(itemId: SealingScrollTierId): SealingScrollTier | undefined {
  return SEALING_SCROLL_TIERS.find((t) => t.itemId === itemId);
}

/** Escolhe o pergaminho de maior tier disponível (Lendário → Comum). */
export function pickSealingScroll(): SealingScrollTier | null {
  for (const tier of getSealingScrollTiersHighFirst()) {
    if (inventoryStore.countItem(tier.itemId) >= 1) return tier;
  }
  return null;
}

/** Pergaminho selecionado no Helper (só se houver stock). */
export function pickSelectedSealingScroll(): SealingScrollTier | null {
  const { scrollItemId } = helperStore.getSnapshot();
  const tier = tierById(scrollItemId);
  if (!tier) return null;
  if (inventoryStore.countItem(tier.itemId) < 1) return null;
  return tier;
}

export function recordSealAnalytics(seal: SealAttemptResult): void {
  if (seal.kind === 'failed' || seal.kind === 'success') {
    huntAnalyzerStore.recordSealAttempt({ scrollId: seal.scrollId });
  }
  if (seal.kind === 'success') {
    huntAnalyzerStore.recordSealSuccess(seal.name);
  }
}

/**
 * Tenta selar o inimigo morto: 1 pergaminho por tentativa.
 * Respeita Auto Selamento (salvo `manual`) e o pergaminho escolhido no Helper.
 */
export function trySealEnemy(
  definition: EnemyDefinition,
  rng: SealRng = Math.random,
  options?: TrySealEnemyOptions,
): SealAttemptResult {
  const seal = definition.sealable;
  if (!seal) return { kind: 'skipped', reason: 'not-sealable' };

  if (!options?.manual && !helperStore.getSnapshot().autoSeal) {
    return { kind: 'skipped', reason: 'disabled' };
  }

  const scroll = pickSelectedSealingScroll();
  if (!scroll) {
    return { kind: 'skipped', reason: 'no-scroll' };
  }

  if (!inventoryStore.removeItem(scroll.itemId, 1)) {
    return { kind: 'skipped', reason: 'no-scroll' };
  }

  if (rng() >= scroll.successChance) {
    emitSystemMessage(`Selamento falhou: ${seal.name} escapou (${scroll.label}).`);
    return { kind: 'failed', scrollId: scroll.itemId };
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
    level: 1,
    xp: 0,
  });

  const added = teamStore.addToCollection(instance);

  if (!added) {
    inventoryStore.addItem(scroll.itemId, 1);
    emitSystemMessage('Selamento falhou: não foi possível adicionar à coleção.');
    return { kind: 'failed', scrollId: scroll.itemId };
  }

  emitSystemMessage(
    `Selamento bem-sucedido! ${seal.name} entrou na coleção no Nv.1 (${scroll.label}).`,
  );
  return {
    kind: 'success',
    characterId: instance.id,
    name: seal.name,
    scrollId: scroll.itemId,
  };
}
