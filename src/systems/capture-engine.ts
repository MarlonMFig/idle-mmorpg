/**
 * Capture Engine — selamento de Hunt.
 * Chance = poder do pergaminho (quality do inimigo não entra: ela ainda não existe).
 * Quality RNG só após sucesso.
 */

import { applyHuntCaptureToOfficialFreeze } from '@/lib/official-progress-freeze';
import {
  CAPTURE_INITIAL_LEVEL,
  CAPTURE_INITIAL_STARS,
  CAPTURE_INITIAL_XP,
  clampCaptureChance,
} from '@/constants/capture';
import { rollCaptureQualityBundle } from '@/lib/hunt-spawn';
import type { CharacterQuality } from '@/types/character-meta';
import {
  SEALING_SCROLL_TIERS,
  type SealingScrollTier,
  type SealingScrollTierId,
} from '@/constants/sealing';
import { getItem } from '@/data/items';
import { resolveCharacterLineageId } from '@/data/character-lineages';
import { getCaptureForceMode } from '@/lib/capture-dev';
import { emitCharacterCaptured } from '@/lib/capture-events';
import { emitSystemMessage } from '@/lib/system-log';
import { helperStore } from '@/stores/helper-store';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import { consumeItem } from '@/systems/reward-application';
import type { EnemyDefinition } from '@/types/enemy';
import type { SealedCharacter } from '@/types/team';
import {
  buildSealedCharacter,
  createCharacterInstanceId,
  resolveCharacterDefinitionId,
} from '@/utils/character-identity';

export type CaptureSource = 'manual' | 'auto' | 'dev';

export interface CaptureChanceBreakdown {
  baseChance: number;
  scrollModifier: number;
  rarityModifier: number;
  otherModifiers: number;
  finalChance: number;
  quality: CharacterQuality;
}

export interface CaptureResult {
  success: boolean;
  reason:
    | 'success'
    | 'failed'
    | 'not-sealable'
    | 'no-scroll'
    | 'disabled'
    | 'in-flight'
    | 'already-resolved'
    | 'collection-rejected'
    | 'invalid-scroll';
  scrollConsumed: boolean;
  scrollId: string | null;
  capturedCharacter: SealedCharacter | null;
  chance: CaptureChanceBreakdown;
  name: string;
}

export type SealRng = () => number;

const ZERO_CHANCE: CaptureChanceBreakdown = {
  baseChance: 0,
  scrollModifier: 0,
  rarityModifier: 0,
  otherModifiers: 0,
  finalChance: 0,
  quality: 'D',
};

const resolvedKeys = new Set<string>();
let inFlight = false;

export function isEnemySealable(definition: EnemyDefinition): boolean {
  return definition.sealable != null;
}

export function getSealingScrollConfig(scrollId: string): SealingScrollTier | null {
  return SEALING_SCROLL_TIERS.find((tier) => tier.itemId === scrollId) ?? null;
}

/** Chance oficial do pergaminho (alias de successChance). */
export function getScrollCaptureModifier(scroll: SealingScrollTier): number {
  return clampCaptureChance(scroll.captureModifier ?? scroll.successChance);
}

/**
 * Chance = poder do pergaminho.
 * Quality do inimigo não existe na Hunt; o modificador de raridade não entra na tentativa.
 * (A tabela CAPTURE_QUALITY_MODIFIERS permanece intacta e não é usada aqui.)
 */
export function getCaptureChance(
  target: EnemyDefinition | null,
  scroll: SealingScrollTier | null,
): CaptureChanceBreakdown {
  if (!scroll || !getItem(scroll.itemId)) return { ...ZERO_CHANCE };
  const scrollModifier = getScrollCaptureModifier(scroll);
  const finalChance = clampCaptureChance(scrollModifier);
  void target;
  return {
    baseChance: scrollModifier,
    scrollModifier,
    rarityModifier: 1,
    otherModifiers: 0,
    finalChance,
    quality: 'D',
  };
}

export function pickSelectedSealingScroll(): SealingScrollTier | null {
  const { scrollItemId } = helperStore.getSnapshot();
  const tier = getSealingScrollConfig(scrollItemId);
  if (!tier) return null;
  if (inventoryStore.countItem(tier.itemId) < 1) return null;
  return tier;
}

/** @deprecated prioriza o maior tier — o Engine usa o pergaminho selecionado. */
export function pickSealingScroll(): SealingScrollTier | null {
  const sorted = [...SEALING_SCROLL_TIERS].sort((a, b) => b.rank - a.rank);
  for (const tier of sorted) {
    if (inventoryStore.countItem(tier.itemId) >= 1) return tier;
  }
  return null;
}

export function markCaptureResolved(key: string): void {
  if (key) resolvedKeys.add(key);
}

export function isCaptureResolved(key: string): boolean {
  return Boolean(key) && resolvedKeys.has(key);
}

export function clearCaptureResolved(key?: string): void {
  if (key) resolvedKeys.delete(key);
  else resolvedKeys.clear();
}

function skipped(
  reason: CaptureResult['reason'],
  extra: Partial<CaptureResult> = {},
): CaptureResult {
  return {
    success: false,
    reason,
    scrollConsumed: false,
    scrollId: extra.scrollId ?? null,
    capturedCharacter: null,
    chance: extra.chance ?? { ...ZERO_CHANCE },
    name: extra.name ?? '',
  };
}

function recordAttempt(result: CaptureResult): void {
  if (result.scrollConsumed && result.scrollId) {
    huntAnalyzerStore.recordSealAttempt({
      scrollId: result.scrollId,
      quality: result.chance.quality,
      success: result.success,
    });
  }
  if (result.success && result.name) {
    huntAnalyzerStore.recordSealSuccess(result.name, result.chance.quality);
  }
}

export interface AttemptCaptureInput {
  target: EnemyDefinition;
  scrollId?: SealingScrollTierId | string | null;
  source: CaptureSource;
  attemptKey?: string;
  rng?: SealRng;
  /** true = não consome pergaminho nem grava coleção. */
  simulate?: boolean;
}

export function attemptCapture(input: AttemptCaptureInput): CaptureResult {
  const definition = input.target;
  const seal = definition.sealable;
  const name = seal?.name ?? definition.name;
  const rng = input.rng ?? Math.random;
  const attemptKey = input.attemptKey ?? definition.id;

  if (!seal) return skipped('not-sealable', { name });
  if (input.source === 'auto' && !helperStore.getSnapshot().autoSeal) {
    return skipped('disabled', { name });
  }
  if (!input.simulate && isCaptureResolved(attemptKey)) {
    return skipped('already-resolved', { name });
  }
  if (!input.simulate && inFlight) {
    return skipped('in-flight', { name });
  }

  const scroll = input.scrollId
    ? getSealingScrollConfig(input.scrollId)
    : pickSelectedSealingScroll();
  if (!scroll || !getItem(scroll.itemId)) {
    return skipped('no-scroll', { name });
  }
  if (inventoryStore.countItem(scroll.itemId) < 1 && !input.simulate) {
    return skipped('no-scroll', { name, scrollId: scroll.itemId });
  }

  let chance = getCaptureChance(definition, scroll);

  if (input.simulate) {
    const force = getCaptureForceMode();
    const hit =
      force === 'success' ? true : force === 'failure' ? false : rng() < chance.finalChance;
    return {
      success: hit,
      reason: hit ? 'success' : 'failed',
      scrollConsumed: false,
      scrollId: scroll.itemId,
      capturedCharacter: null,
      chance,
      name,
    };
  }

  inFlight = true;
  try {
    markCaptureResolved(attemptKey);
    if (!consumeItem(scroll.itemId, 1)) {
      resolvedKeys.delete(attemptKey);
      return skipped('no-scroll', { name, scrollId: scroll.itemId, chance });
    }

    const force = getCaptureForceMode();
    const hit =
      force === 'success' ? true : force === 'failure' ? false : rng() < chance.finalChance;

    if (!hit) {
      emitSystemMessage(`Selamento falhou: ${name} escapou (${scroll.label}).`);
      const failed: CaptureResult = {
        success: false,
        reason: 'failed',
        scrollConsumed: true,
        scrollId: scroll.itemId,
        capturedCharacter: null,
        chance,
        name,
      };
      recordAttempt(failed);
      return failed;
    }

    const rolled = rollCaptureQualityBundle(rng);
    const instance = buildSealedCharacter({
      id: createCharacterInstanceId(),
      name: seal.name,
      lookType: seal.lookType,
      sourceId: seal.sourceId,
      starterId: null,
      previewUrl: '',
      characterId: resolveCharacterDefinitionId({
        sourceId: seal.sourceId,
        starterId: null,
        lookType: seal.lookType,
        characterId: seal.characterId,
      }),
      quality: rolled.quality,
      qualityStatMultiplier: rolled.qualityStatMultiplier,
      stars: CAPTURE_INITIAL_STARS,
      lineageId: resolveCharacterLineageId({ lookType: seal.lookType }),
      level: CAPTURE_INITIAL_LEVEL,
      xp: CAPTURE_INITIAL_XP,
      obtainedAt: Date.now(),
    });
    chance = { ...chance, quality: rolled.quality };

    const added = teamStore.addCharacterInstance({ ...instance, previewUrl: instance.previewUrl ?? '' });
    const stored = teamStore.getCharacterInstance(instance.id);
    if (!added || !stored) {
      inventoryStore.addItem(scroll.itemId, 1);
      resolvedKeys.delete(attemptKey);
      emitSystemMessage('Selamento falhou: não foi possível adicionar à coleção.');
      return {
        success: false,
        reason: 'collection-rejected',
        scrollConsumed: false,
        scrollId: scroll.itemId,
        capturedCharacter: null,
        chance,
        name,
      };
    }

    emitSystemMessage(
      `SELAMENTO CONCLUÍDO — ${seal.name} · Raridade: ${stored.quality} · Adicionado à coleção (Nv.${CAPTURE_INITIAL_LEVEL}).`,
    );
    applyHuntCaptureToOfficialFreeze(stored, scroll.itemId);
    emitCharacterCaptured({
      instanceId: stored.id,
      characterId: stored.characterId,
      name: stored.name,
      quality: stored.quality,
      instance: stored,
    });

    const ok: CaptureResult = {
      success: true,
      reason: 'success',
      scrollConsumed: true,
      scrollId: scroll.itemId,
      capturedCharacter: stored,
      chance,
      name,
    };
    recordAttempt(ok);
    return ok;
  } finally {
    inFlight = false;
  }
}

/** Compat: resultado antigo do selamento. */
export type SealAttemptResult =
  | { kind: 'skipped'; reason: 'not-sealable' | 'no-scroll' | 'disabled' }
  | { kind: 'failed'; scrollId: string }
  | { kind: 'success'; characterId: string; name: string; scrollId: string };

export function toSealAttemptResult(result: CaptureResult): SealAttemptResult {
  if (result.reason === 'not-sealable' || result.reason === 'no-scroll' || result.reason === 'disabled') {
    return { kind: 'skipped', reason: result.reason };
  }
  if (result.success) {
    return {
      kind: 'success',
      characterId: result.capturedCharacter?.id ?? result.capturedCharacter?.characterId ?? 'unknown',
      name: result.name,
      scrollId: result.scrollId ?? '',
    };
  }
  return { kind: 'failed', scrollId: result.scrollId ?? '' };
}

export function simulateCaptureBatch(
  target: EnemyDefinition,
  scrollId: string,
  times: number,
  rng: SealRng = Math.random,
): { success: number; failure: number; expectedRate: number; observedRate: number } {
  const scroll = getSealingScrollConfig(scrollId);
  const expectedRate = getCaptureChance(target, scroll).finalChance;
  let success = 0;
  for (let i = 0; i < times; i += 1) {
    const result = attemptCapture({
      target,
      scrollId,
      source: 'dev',
      simulate: true,
      rng,
    });
    if (result.success) success += 1;
  }
  const failure = Math.max(0, times - success);
  return {
    success,
    failure,
    expectedRate,
    observedRate: times > 0 ? success / times : 0,
  };
}
