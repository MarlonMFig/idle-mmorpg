import { ANIME_MATERIAL_TRIO } from '@/data/anime-items';
import { getCuratedPackByLookType } from '@/data/character-packs';
import { getItem } from '@/data/items';
import {
  getNarutoCharacterTier,
  getNarutoFragmentChance,
  narutoFragmentItemId,
  pickNarutoMaterialItem,
  rollNarutoMaterialRarity,
  type NarutoLootTier,
} from '@/data/naruto-loot-tiers';
import { resolveAnimeId } from '@/data/anime';
import { vipEmptyLootRerollChance, guildLootBonusMultiplier } from '@/lib/progression-bonuses';
import type { AnimeId } from '@/types/anime';
import type { ItemRarity, LootDropEntry, RolledLoot } from '@/types/loot';

/**
 * Quantidade de cobre (Ryo 100%) garantida ao matar.
 */
export function copperRewardForKill(level: number, rng: () => number = Math.random): number {
  const safeLevel = Math.max(1, Math.floor(level) || 1);
  const coinMax = Math.max(2, Math.min(25, Math.ceil(safeLevel / 3)));
  return 1 + Math.floor(rng() * coinMax);
}

export interface NarutoLootContext {
  lookType?: number | null;
  characterId?: string | null;
}

function resolveCharacterId(ctx: NarutoLootContext): string | null {
  if (ctx.characterId) return ctx.characterId;
  if (ctx.lookType != null) {
    return getCuratedPackByLookType(ctx.lookType)?.id ?? null;
  }
  return null;
}

function itemRarityOf(itemId: string): ItemRarity | undefined {
  return getItem(itemId)?.rarity;
}

function toRolled(itemId: string, quantity = 1): RolledLoot | null {
  const item = getItem(itemId);
  if (!item) return null;
  return {
    itemId,
    name: item.name,
    quantity,
    rarity: item.rarity,
  };
}

/**
 * 1 kill Naruto:
 * - fragmento (chance por tier; T1≈1/625, T5≈1/5000)
 * - exatamente 0|1 material via raridade → assinatura/tier
 */
export function rollNarutoCharacterLoot(
  ctx: NarutoLootContext = {},
  rng: () => number = Math.random,
): RolledLoot[] {
  const characterId = resolveCharacterId(ctx);
  const tier: NarutoLootTier = getNarutoCharacterTier(characterId) ?? 1;
  const drops: RolledLoot[] = [];

  // Fragmento — chance base sem inflar raridade (VIP só reroll de kill vazio).
  if (characterId && getNarutoCharacterTier(characterId) != null) {
    const chance = getNarutoFragmentChance(tier) * guildLootBonusMultiplier();
    if (rng() < chance || (rng() < vipEmptyLootRerollChance() && rng() < chance)) {
      const frag = toRolled(narutoFragmentItemId(characterId));
      if (frag) drops.push(frag);
    }
  } else {
    const chance = getNarutoFragmentChance(1) * guildLootBonusMultiplier();
    if (rng() < chance || (rng() < vipEmptyLootRerollChance() && rng() < chance)) {
      const frag = toRolled('item-anime-naruto-fragmento-personagem');
      if (frag) drops.push(frag);
    }
  }

  // Uma rolagem de raridade → um item. VIP: reroll se vazio (não escala Lendário/Mítico).
  let rarity = rollNarutoMaterialRarity(tier, rng);
  if (!rarity && vipEmptyLootRerollChance() > 0 && rng() < vipEmptyLootRerollChance()) {
    rarity = rollNarutoMaterialRarity(tier, rng);
  }
  if (rarity) {
    const itemId = pickNarutoMaterialItem(characterId, tier, rarity, itemRarityOf, rng);
    if (itemId) {
      const material = toRolled(itemId);
      if (material) drops.push(material);
    }
  }

  return drops;
}

/**
 * true se este monstro usa o pipeline Naruto (raridade + assinatura).
 * Caças de outros animes caem na tabela genérica.
 */
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

/**
 * Tabela estática só para previews/legacy — o kill real usa `rollNarutoCharacterLoot`.
 * Mantém chance aproximada de “algum material” para ferramentas de debug.
 */
export function buildNarutoCharacterLoot(_ctx: NarutoLootContext = {}): LootDropEntry[] {
  return [];
}

/** @deprecated */
export function buildNarutoHuntLoot(_level: number): LootDropEntry[] {
  return [];
}

/**
 * Outros animes: tabela clássica independente.
 * Naruto: lista vazia — rolagem em `rollNarutoCharacterLoot` na hora do kill.
 */
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
