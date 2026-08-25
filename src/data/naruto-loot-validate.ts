import { getCharacterPackById } from '@/data/character-packs';
import { getItem } from '@/data/items';
import {
  NARUTO_CHARACTER_LOOT,
  NARUTO_CHARACTER_TIER,
  NARUTO_CORE_THIRTY_IDS,
  type NarutoLootTier,
} from '@/data/naruto-loot-tiers';
import { LOOT_TIER_ROLL_CHANCES } from '@/constants/loot-economy';
import { getItemSellValue } from '@/data/shop';

export interface LootProfileValidation {
  errors: string[];
  warnings: string[];
}

function isTier(value: number): value is NarutoLootTier {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function validateNarutoLootProfiles(): LootProfileValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lootIds = Object.keys(NARUTO_CHARACTER_LOOT);
  const tierIds = Object.keys(NARUTO_CHARACTER_TIER);

  for (const id of lootIds) {
    if (!NARUTO_CHARACTER_TIER[id]) {
      errors.push(`Personagem sem tier: ${id}`);
    }
  }
  for (const id of tierIds) {
    if (!NARUTO_CHARACTER_LOOT[id]) {
      errors.push(`Tier sem perfil de loot: ${id}`);
    }
  }

  const seen = new Set<string>();
  for (const id of lootIds) {
    if (seen.has(id)) errors.push(`Perfil duplicado: ${id}`);
    seen.add(id);

    if (!getCharacterPackById(id)) {
      errors.push(`Character ID inexistente no catálogo de packs: ${id}`);
    }

    const profile = NARUTO_CHARACTER_LOOT[id]!;
    const tier = NARUTO_CHARACTER_TIER[id];
    if (tier != null && !isTier(tier)) {
      errors.push(`Tier inválido para ${id}: ${String(tier)}`);
    }

    if (!profile.signatureItemId) errors.push(`${id}: signatureItemId em falta`);
    if (!profile.secondaryItemId) errors.push(`${id}: secondaryItemId em falta`);

    if (profile.signatureItemId && !getItem(profile.signatureItemId)) {
      errors.push(`${id}: signature item inexistente (${profile.signatureItemId})`);
    }
    if (profile.secondaryItemId && !getItem(profile.secondaryItemId)) {
      errors.push(`${id}: secondary item inexistente (${profile.secondaryItemId})`);
    }

    if (
      profile.signatureItemId &&
      profile.secondaryItemId &&
      profile.signatureItemId === profile.secondaryItemId
    ) {
      warnings.push(
        `${id}: signature e secondary são o mesmo item (${profile.signatureItemId})`,
      );
    }
  }

  for (const id of NARUTO_CORE_THIRTY_IDS) {
    if (!NARUTO_CHARACTER_LOOT[id]) {
      errors.push(`Tabela oficial de 30: perfil em falta (${id})`);
    }
  }

  for (const [tierKey, chances] of Object.entries(LOOT_TIER_ROLL_CHANCES)) {
    const tier = Number(tierKey);
    if (!isTier(tier)) errors.push(`Chave de chance inválida: ${tierKey}`);
    if (!Number.isFinite(chances.secondary) || chances.secondary < 0 || chances.secondary > 1) {
      errors.push(`T${tierKey} secondary chance inválida`);
    }
    if (!Number.isFinite(chances.signature) || chances.signature < 0 || chances.signature > 1) {
      errors.push(`T${tierKey} signature chance inválida`);
    }
  }

  for (const item of Object.values(getAllPricedNarutoItems())) {
    if (item.sell < 0) errors.push(`sellPrice negativo: ${item.id}`);
  }

  return { errors, warnings };
}

function getAllPricedNarutoItems(): { id: string; sell: number }[] {
  const ids = new Set<string>();
  for (const profile of Object.values(NARUTO_CHARACTER_LOOT)) {
    ids.add(profile.signatureItemId);
    ids.add(profile.secondaryItemId);
  }
  return [...ids].map((id) => ({ id, sell: getItemSellValue(id) }));
}
