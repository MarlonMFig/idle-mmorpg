import {
  AWAKENING_ENABLED_WITHOUT_CONFIG,
  AWAKENING_REQUIREMENTS,
  AWAKENING_REWARDS,
  MAX_AWAKENING_LEVEL,
  clampAwakeningLevel,
  formatAwakeningRoman,
  getEffectiveStarRequirement,
  type AwakeningItemCost,
  type AwakeningLevelRequirement,
  type AwakeningReward,
  type AwakeningTargetLevel,
  type CharacterAwakeningConfig,
} from '@/constants/character-awakening';
import { getCharacterDefinition } from '@/data/characters';
import { getItem } from '@/data/items';
import { narutoFragmentItemId } from '@/data/naruto-loot-tiers';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import type { SealedCharacter } from '@/types/team';

export {
  clampAwakeningLevel,
  formatAwakeningRoman,
  getEffectiveStarRequirement,
  MAX_AWAKENING_LEVEL,
};

const GENERIC_CHARACTER_FRAGMENT_ID = 'item-anime-naruto-fragmento-personagem';

export interface AwakeningCheck {
  id: 'level' | 'stars' | 'mastery' | 'copper' | 'item' | 'fragments';
  label: string;
  met: boolean;
  current: number;
  required: number;
  itemId?: string;
}

export interface AwakeningValidation {
  eligible: boolean;
  available: boolean;
  maxed: boolean;
  nextLevel: AwakeningTargetLevel | null;
  requirement: AwakeningLevelRequirement | null;
  missing: string[];
  checks: AwakeningCheck[];
  copperCost: number;
  itemCosts: AwakeningItemCost[];
  fragmentCost: number;
  fragmentItemId: string | null;
}

export interface AwakeningWallet {
  copper: number;
  countItem: (itemId: string) => number;
}

export interface ResolvedAwakeningDefinition {
  enabled: boolean;
  maxLevel: number;
  requirements: Record<AwakeningTargetLevel, AwakeningLevelRequirement>;
  rewards: Record<AwakeningTargetLevel, AwakeningReward>;
}

function mergeRequirement(
  base: AwakeningLevelRequirement,
  overlay?: AwakeningLevelRequirement,
): AwakeningLevelRequirement {
  if (!overlay) return { ...base, items: base.items ? [...base.items] : undefined };
  return {
    level: overlay.level ?? base.level,
    stars: overlay.stars ?? base.stars,
    masteryLevel: overlay.masteryLevel ?? base.masteryLevel,
    copper: overlay.copper ?? base.copper,
    items: overlay.items ? overlay.items.map((row) => ({ ...row })) : base.items ? [...base.items] : undefined,
    fragments: overlay.fragments ?? base.fragments,
  };
}

export function resolveAwakeningDefinition(
  characterId: string | null | undefined,
  configOverride?: CharacterAwakeningConfig | null,
): ResolvedAwakeningDefinition | null {
  const fromCatalog = characterId ? getCharacterDefinition(characterId)?.awakeningConfig : undefined;
  const config = configOverride ?? fromCatalog;
  if (config?.enabled === false) return null;
  if (!config && !AWAKENING_ENABLED_WITHOUT_CONFIG) return null;

  return {
    enabled: true,
    maxLevel: MAX_AWAKENING_LEVEL,
    requirements: {
      1: mergeRequirement(AWAKENING_REQUIREMENTS[1], config?.requirements?.[1]),
      2: mergeRequirement(AWAKENING_REQUIREMENTS[2], config?.requirements?.[2]),
      3: mergeRequirement(AWAKENING_REQUIREMENTS[3], config?.requirements?.[3]),
    },
    rewards: {
      1: { ...AWAKENING_REWARDS[1], ...config?.rewards?.[1] },
      2: { ...AWAKENING_REWARDS[2], ...config?.rewards?.[2] },
      3: { ...AWAKENING_REWARDS[3], ...config?.rewards?.[3] },
    },
  };
}

export function isAwakeningAvailable(characterId: string | null | undefined): boolean {
  return resolveAwakeningDefinition(characterId) != null;
}

export function getAwakeningRequirement(
  nextLevel: number,
  characterId?: string | null,
): AwakeningLevelRequirement | null {
  if (nextLevel !== 1 && nextLevel !== 2 && nextLevel !== 3) return null;
  return resolveAwakeningDefinition(characterId)?.requirements[nextLevel] ?? null;
}

/** Recompensa do nível, se existir. */
export function getAwakeningReward(
  level: number,
  characterId?: string | null,
): AwakeningReward | null {
  if (level !== 1 && level !== 2 && level !== 3) return null;
  return resolveAwakeningDefinition(characterId)?.rewards[level] ?? null;
}

export function resolveFragmentItemId(instance: Pick<SealedCharacter, 'characterId' | 'sourceId'>): string | null {
  const characterId = instance.characterId || instance.sourceId;
  if (characterId) {
    const specific = narutoFragmentItemId(characterId);
    if (getItem(specific)) return specific;
  }
  if (getItem(GENERIC_CHARACTER_FRAGMENT_ID)) return GENERIC_CHARACTER_FRAGMENT_ID;
  return null;
}

function pushCheck(
  checks: AwakeningCheck[],
  missing: string[],
  check: AwakeningCheck,
  missingMessage: string,
): void {
  checks.push(check);
  if (!check.met) missing.push(missingMessage);
}

export function evaluateAwakening(
  instance: SealedCharacter,
  wallet: AwakeningWallet,
  definition = resolveAwakeningDefinition(instance.characterId),
): AwakeningValidation {
  const empty: AwakeningValidation = {
    eligible: false,
    available: false,
    maxed: false,
    nextLevel: null,
    requirement: null,
    missing: ['Awakening not available'],
    checks: [],
    copperCost: 0,
    itemCosts: [],
    fragmentCost: 0,
    fragmentItemId: null,
  };

  if (!definition) return empty;

  const current = clampAwakeningLevel(instance.awakeningLevel);
  if (current >= MAX_AWAKENING_LEVEL) {
    return {
      eligible: false,
      available: true,
      maxed: true,
      nextLevel: null,
      requirement: null,
      missing: ['Already at max awakening'],
      checks: [],
      copperCost: 0,
      itemCosts: [],
      fragmentCost: 0,
      fragmentItemId: null,
    };
  }

  const nextLevel = (current + 1) as AwakeningTargetLevel;
  const requirement = definition.requirements[nextLevel];
  const missing: string[] = [];
  const checks: AwakeningCheck[] = [];

  const requiredLevel = Math.max(0, Math.floor(requirement.level ?? 0));
  if (requiredLevel > 0) {
    const met = instance.level >= requiredLevel;
    pushCheck(
      checks,
      missing,
      {
        id: 'level',
        label: `Level ${requiredLevel}`,
        met,
        current: instance.level,
        required: requiredLevel,
      },
      `Level ${requiredLevel} required`,
    );
  }

  const requiredStars = getEffectiveStarRequirement(requirement.stars, instance.quality);
  if (requiredStars > 0) {
    const met = instance.stars >= requiredStars;
    pushCheck(
      checks,
      missing,
      {
        id: 'stars',
        label: `${requiredStars}★`,
        met,
        current: instance.stars,
        required: requiredStars,
      },
      `${requiredStars}★ required`,
    );
  }

  const requiredMastery = Math.max(0, Math.floor(requirement.masteryLevel ?? 0));
  if (requiredMastery > 0) {
    const met = (instance.masteryLevel ?? 0) >= requiredMastery;
    pushCheck(
      checks,
      missing,
      {
        id: 'mastery',
        label: `Maestria ${requiredMastery}`,
        met,
        current: instance.masteryLevel ?? 0,
        required: requiredMastery,
      },
      `Mastery ${requiredMastery} required`,
    );
  }

  const itemCosts = (requirement.items ?? [])
    .map((row) => ({
      itemId: row.itemId,
      quantity: Math.max(0, Math.floor(row.quantity)),
    }))
    .filter((row) => row.quantity > 0 && Boolean(row.itemId));

  for (const row of itemCosts) {
    const have = wallet.countItem(row.itemId);
    const met = have >= row.quantity;
    const name = getItem(row.itemId)?.name ?? row.itemId;
    pushCheck(
      checks,
      missing,
      {
        id: 'item',
        label: `${name} ×${row.quantity}`,
        met,
        current: have,
        required: row.quantity,
        itemId: row.itemId,
      },
      `Need ${row.quantity} ${name}`,
    );
  }

  const fragmentCost = Math.max(0, Math.floor(requirement.fragments ?? 0));
  const fragmentItemId = fragmentCost > 0 ? resolveFragmentItemId(instance) : null;
  if (fragmentCost > 0) {
    const have = fragmentItemId ? wallet.countItem(fragmentItemId) : 0;
    const met = Boolean(fragmentItemId) && have >= fragmentCost;
    const name = fragmentItemId ? (getItem(fragmentItemId)?.name ?? 'Fragments') : 'Fragments';
    pushCheck(
      checks,
      missing,
      {
        id: 'fragments',
        label: `${name} ×${fragmentCost}`,
        met,
        current: have,
        required: fragmentCost,
        itemId: fragmentItemId ?? undefined,
      },
      fragmentItemId ? `Need ${fragmentCost} ${name}` : 'Fragment item not configured',
    );
  }

  const copperCost = Math.max(0, Math.floor(requirement.copper ?? 0));
  if (copperCost > 0) {
    const have = wallet.copper;
    const met = have >= copperCost;
    pushCheck(
      checks,
      missing,
      {
        id: 'copper',
        label: `${copperCost.toLocaleString('pt-BR')} cobre`,
        met,
        current: have,
        required: copperCost,
        itemId: SHOP_CURRENCY_ITEM_ID,
      },
      `Need ${copperCost} Copper`,
    );
  }

  return {
    eligible: missing.length === 0,
    available: true,
    maxed: false,
    nextLevel,
    requirement,
    missing,
    checks,
    copperCost,
    itemCosts,
    fragmentCost,
    fragmentItemId,
  };
}

export function nextAwakeningLabel(level: number): string {
  const next = clampAwakeningLevel(level) + 1;
  if (next > MAX_AWAKENING_LEVEL) return 'MAX';
  return `Despertar ${formatAwakeningRoman(next)}`;
}
