import { isDevEnvironment, isDevMode } from '@/config/devConfig';
import { ANIME_MATERIAL_TRIO } from '@/data/anime-items';
import { getCuratedPackByLookType } from '@/data/character-packs';
import { getItem } from '@/data/items';
import {
  getNarutoCharacterTier,
  getNarutoFragmentChance,
  hasNarutoLootProfile,
  narutoFragmentItemId,
  rollNarutoIndependentMaterials,
  type NarutoLootTier,
} from '@/data/naruto-loot-tiers';
import { resolveAnimeId, resolveWorldId } from '@/data/anime';
import { vipEmptyLootRerollChance, guildLootBonusMultiplier } from '@/lib/progression-bonuses';
import { rollWorldGeneralLoot } from '@/data/world-general-loot';
import type { AnimeId } from '@/types/anime';
import type { LootDropEntry, RolledLoot } from '@/types/loot';

/**
 * Quantidade de cobre (Ryo 100%) garantida ao matar.
 * 1 + floor(rng * coinMax), coinMax = clamp(2, 25, ceil(level/3)).
 */
export function copperRewardForKill(level: number, rng: () => number = Math.random): number {
  const safeLevel = Math.max(1, Math.floor(level) || 1);
  const coinMax = Math.max(2, Math.min(25, Math.ceil(safeLevel / 3)));
  return 1 + Math.floor(rng() * coinMax);
}

export interface NarutoLootContext {
  lookType?: number | null;
  characterId?: string | null;
  source?: string | null;
}

/**
 * Resolve o id de perfil de loot (pack id em NARUTO_CHARACTER_LOOT).
 * Hunt grava sealable.characterId = target.sourceId (ex.: wonsr-character-uzumaki-naruto),
 * que NÃO é chave de perfil. lookType → pack curado é determinístico; sem fuzzy match.
 */
export function resolveNarutoLootCharacterId(ctx: NarutoLootContext): string | null {
  const rawId = ctx.characterId?.trim() || null;
  if (rawId && hasNarutoLootProfile(rawId)) return rawId;

  const packId =
    ctx.lookType != null ? (getCuratedPackByLookType(ctx.lookType)?.id ?? null) : null;
  if (packId && hasNarutoLootProfile(packId)) return packId;

  const resolved = packId ?? rawId;
  if (isDevEnvironment() && (rawId || ctx.lookType != null) && !hasNarutoLootProfile(resolved)) {
    console.warn('[LOOT] Missing character loot profile', {
      characterId: rawId,
      lookType: ctx.lookType ?? null,
      packId,
    });
  }
  return resolved;
}

function toRolled(
  itemId: string,
  quantity = 1,
  lootSource?: RolledLoot['lootSource'],
): RolledLoot | null {
  const item = getItem(itemId);
  if (!item) {
    if (isDevEnvironment()) {
      console.error('[LOOT] Rolled itemId missing from registry', { itemId });
    }
    return null;
  }
  return {
    itemId,
    name: item.name,
    quantity,
    rarity: item.rarity,
    lootSource,
  };
}

/**
 * 1 kill Naruto (rolls independentes, qty 1):
 * 1) General world loot
 * 2) Fragmento
 * 3) Secondary
 * 4) Signature
 * Quality de captura não entra.
 */
export function rollNarutoCharacterLoot(
  ctx: NarutoLootContext = {},
  rng: () => number = Math.random,
): RolledLoot[] {
  const characterId = resolveNarutoLootCharacterId(ctx);
  const tier: NarutoLootTier = getNarutoCharacterTier(characterId) ?? 1;
  const drops: RolledLoot[] = [];
  const guild = guildLootBonusMultiplier();
  const vip = vipEmptyLootRerollChance();

  const worldId = resolveWorldId({
    lookType: ctx.lookType,
    sourceId: ctx.characterId,
    source: ctx.source,
  });
  if (worldId === 'naruto') {
    const general = rollWorldGeneralLoot(worldId, tier, rng);
    if (general) {
      const rolled = toRolled(general.itemId, 1, 'general');
      if (rolled) drops.push(rolled);
    }
  } else if (worldId == null && typeof window !== 'undefined' && isDevEnvironment()) {
    console.warn('[LOOT] Missing world for Naruto general loot', {
      characterId: ctx.characterId ?? null,
      lookType: ctx.lookType ?? null,
    });
  }

  if (characterId && getNarutoCharacterTier(characterId) != null) {
    const chance = getNarutoFragmentChance(tier) * guild;
    if (rng() < chance || (vip > 0 && rng() < vip && rng() < chance)) {
      const frag = toRolled(narutoFragmentItemId(characterId), 1, 'fragment');
      if (frag) drops.push(frag);
    }
  } else {
    if (typeof window !== 'undefined' && isDevEnvironment()) {
      console.warn('[LOOT] Missing character loot profile', {
        characterId: ctx.characterId ?? null,
        lookType: ctx.lookType ?? null,
      });
    }
    const chance = getNarutoFragmentChance(1) * guild;
    if (rng() < chance || (vip > 0 && rng() < vip && rng() < chance)) {
      const frag = toRolled('item-anime-naruto-fragmento-personagem', 1, 'fragment');
      if (frag) drops.push(frag);
    }
  }

  const materials = rollNarutoIndependentMaterials(characterId, tier, rng, {
    guildLootMult: guild,
    vipEmptyReroll: vip,
  });
  if (materials.secondaryItemId) {
    const secondary = toRolled(materials.secondaryItemId, 1, 'secondary');
    if (secondary) drops.push(secondary);
  }
  if (materials.signatureItemId) {
    const signature = toRolled(materials.signatureItemId, 1, 'signature');
    if (signature) drops.push(signature);
  }

  if (typeof window !== 'undefined' && isDevMode() && drops.length > 0) {
    console.debug(
      '[LOOT]',
      drops.map((drop) => `${(drop.lootSource ?? 'unknown').toUpperCase()} ${drop.itemId}×${drop.quantity}`).join(' | '),
    );
  }

  return drops;
}

export function isNarutoLootTarget(ctx: {
  lookType?: number | null;
  sourceId?: string | null;
  source?: string | null;
}): boolean {
  return (
    resolveAnimeId({
      lookType: ctx.lookType,
      sourceId: ctx.sourceId,
      source: ctx.source,
    }) === 'naruto'
  );
}

export function buildNarutoCharacterLoot(_ctx: NarutoLootContext = {}): LootDropEntry[] {
  return [];
}

/** @deprecated */
export function buildNarutoHuntLoot(_level: number): LootDropEntry[] {
  return [];
}

export function buildAnimeHuntLoot(
  animeId: AnimeId,
  level: number,
  _ctx: NarutoLootContext = {},
): LootDropEntry[] {
  if (animeId === 'naruto') {
    return [];
  }

  const mats = ANIME_MATERIAL_TRIO[animeId];
  const commonMax = Math.max(1, Math.min(4, Math.ceil(level / 20)));
  const uncommonMax = Math.max(1, Math.min(2, Math.ceil(level / 40)));
  const rareChance = Math.min(0.28, 0.05 + level * 0.0018);

  return [
    {
      itemId: mats.common,
      chance: 0.55,
      quantityMin: 1,
      quantityMax: commonMax,
      rarity: 'common',
    },
    {
      itemId: mats.uncommon,
      chance: Math.min(0.38, 0.12 + level * 0.002),
      quantityMin: 1,
      quantityMax: uncommonMax,
      rarity: 'uncommon',
    },
    {
      itemId: mats.rare,
      chance: rareChance,
      quantityMin: 1,
      quantityMax: 1,
      rarity: 'rare',
    },
  ];
}
