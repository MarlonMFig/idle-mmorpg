/**
 * READ-ONLY copper economy audit. Does not change balance, drops, or saves.
 * npx --yes tsx scripts/audit-copper-economy.ts
 */
import { BASE_ATTRIBUTES, LEVEL_ATTRIBUTE_GROWTH } from '../src/constants/attributes';
import { AWAKENING_REQUIREMENTS } from '../src/constants/character-awakening';
import { MEDIC_CONFIG } from '../src/constants/medic';
import { SEALING_SCROLL_PRICE, SEALING_SCROLL_TIERS } from '../src/constants/sealing';
import { WORLD_BOSS_DEFINITION } from '../src/constants/world-boss';
import { ACHIEVEMENT_DEFINITIONS } from '../src/data/achievements/achievement-registry';
import { copperRewardForKill } from '../src/data/anime-loot';
import { BOSS_DEFINITIONS } from '../src/data/bosses/boss-registry';
import { DAILY_LOGIN_REWARDS } from '../src/data/daily-login/daily-login-rewards';
import { GUILD_SHOP_OFFERS } from '../src/data/guild-shop';
import { HELPER_SHOP_PRICES } from '../src/data/helper-items';
import { getItem, listItemDefinitions } from '../src/data/items';
import { DAILY_MISSION_POOL, WEEKLY_MISSION_POOL } from '../src/data/missions/mission-registry';
import {
  NARUTO_CHARACTER_LOOT,
  NARUTO_CHARACTER_TIER,
  NARUTO_FRAGMENT_EXPECTED_KILLS,
  NARUTO_RARITY_WEIGHTS,
  getNarutoCharacterTier,
  getNarutoFragmentChance,
  listNarutoTierCharacterIds,
  narutoFragmentItemId,
  pickNarutoMaterialItem,
  rollNarutoMaterialRarity,
  type NarutoLootTier,
} from '../src/data/naruto-loot-tiers';
import { NARUTO_NPC_SELL_PRICES, SHOP_OFFERS, getItemSellValue } from '../src/data/shop';
import { estimateHuntKillsPerMinute, huntEnemyHpForLevel } from '../src/lib/hunt-enemy-xp';
import { calculateMedicCost } from '../src/lib/medic-service';

type Drop = { itemId: string; quantity: number };

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function expectedDirectCopper(level: number): number {
  const coinMax = Math.max(2, Math.min(25, Math.ceil(Math.max(1, level) / 3)));
  return 1 + (coinMax - 1) / 2;
}

function itemRarityOf(itemId: string) {
  return getItem(itemId)?.rarity;
}

function rollNarutoKill(characterId: string | null, rng: () => number): Drop[] {
  const drops: Drop[] = [];
  const tier: NarutoLootTier = getNarutoCharacterTier(characterId) ?? 1;
  if (rng() < getNarutoFragmentChance(tier)) {
    drops.push({
      itemId: characterId ? narutoFragmentItemId(characterId) : 'item-anime-naruto-fragmento-personagem',
      quantity: 1,
    });
  }
  const rarity = rollNarutoMaterialRarity(tier, rng);
  if (rarity) {
    const itemId = pickNarutoMaterialItem(characterId, tier, rarity, itemRarityOf, rng);
    if (itemId) drops.push({ itemId, quantity: 1 });
  }
  return drops;
}

function copperFromRewards(rewards: readonly { type: string; amount?: number }[] | undefined): number {
  if (!rewards) return 0;
  return rewards.reduce((sum, row) => sum + (row.type === 'copper' ? row.amount ?? 0 : 0), 0);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
  return sorted[i]!;
}

function hpMaxAtLevel(level: number): number {
  return Math.max(1, Math.floor(BASE_ATTRIBUTES.hp + LEVEL_ATTRIBUTE_GROWTH.hp * Math.max(0, level - 1)));
}

function mcLoot(characterId: string | null, kills: number, seed: number) {
  const rng = mulberry32(seed);
  const counts = new Map<string, number>();
  let empty = 0;
  let multi = 0;
  for (let i = 0; i < kills; i += 1) {
    const drops = rollNarutoKill(characterId, rng);
    if (drops.length === 0) empty += 1;
    if (drops.length > 1) multi += 1;
    for (const drop of drops) counts.set(drop.itemId, (counts.get(drop.itemId) ?? 0) + drop.quantity);
  }
  let sell = 0;
  const rows = [...counts.entries()].map(([itemId, qty]) => {
    const unit = getItemSellValue(itemId);
    sell += qty * unit;
    return { itemId, perKill: qty / kills, sell: unit, ev: (qty / kills) * unit };
  });
  rows.sort((a, b) => b.ev - a.ev);
  return { emptyRate: empty / kills, multiRate: multi / kills, sellEv: sell / kills, rows };
}

function hourSamples(characterId: string | null, level: number, hours: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const kph = Math.max(1, Math.round(estimateHuntKillsPerMinute(level, huntEnemyHpForLevel(level)) * 60));
  const values: number[] = [];
  for (let h = 0; h < hours; h += 1) {
    let total = 0;
    for (let k = 0; k < kph; k += 1) {
      total += copperRewardForKill(level, rng);
      for (const drop of rollNarutoKill(characterId, rng)) {
        total += getItemSellValue(drop.itemId) * drop.quantity;
      }
    }
    values.push(total);
  }
  values.sort((a, b) => a - b);
  return values;
}

const WANTED: Array<{ label: string; id: string }> = [
  { label: 'Kunai Gasta', id: 'item-anime-naruto-kunai-gasta' },
  { label: 'Ração Militar', id: 'item-anime-naruto-racao-militar' },
  { label: 'Shuriken Enferrujada', id: 'item-anime-naruto-shuriken' },
  { label: 'Bolsa de Shuriken', id: 'item-anime-naruto-bolsa-shuriken' },
  { label: 'Bandagem Rasgada', id: 'item-anime-naruto-bandagem' },
  { label: 'Pílula de Soldado', id: 'item-anime-naruto-pilula-soldado' },
  { label: 'Papel de Chakra', id: 'item-anime-naruto-papel-chakra' },
  { label: 'Fio de Aço Ninja', id: 'item-anime-naruto-fio-aco' },
  { label: 'Presa de Cão Ninja', id: 'item-anime-naruto-presa-ninken' },
  { label: 'Pergaminho Básico', id: 'item-anime-naruto-pergaminho-basico' },
  { label: 'Lente Ocular', id: 'item-anime-naruto-lente-ocular' },
  { label: 'Casulo de Insetos', id: 'item-anime-naruto-casulo-insetos' },
  { label: 'Fūma Shuriken', id: 'item-anime-naruto-fuma-shuriken' },
  { label: 'Colete Tático', id: 'item-anime-naruto-colete-tatico' },
  { label: 'Selo Elemental', id: 'item-anime-naruto-selo-elemental' },
  { label: 'Cabaça de Areia', id: 'item-anime-naruto-cabaca-areia' },
  { label: 'Bandana Riscada', id: 'item-anime-naruto-bandana-riscada' },
  { label: 'Pergaminho de Selamento', id: 'item-anime-naruto-pergaminho-selamento' },
  { label: 'Papel Bomba', id: 'item-anime-naruto-papel-bomba' },
  { label: 'Contrato de Invocação', id: 'item-anime-naruto-contrato-invocacao' },
  { label: 'Frasco de Veneno', id: 'item-anime-naruto-frasco-veneno' },
  { label: 'Tantō', id: 'item-anime-naruto-tanto' },
  { label: 'Máscara ANBU', id: 'item-anime-naruto-mascara-anbu' },
  { label: 'Livro Bingo', id: 'item-anime-naruto-livro-bingo' },
  { label: 'Pergaminho Proibido', id: 'item-anime-naruto-pergaminho-proibido' },
  { label: 'Núcleo de Chakra Puro', id: 'item-anime-naruto-nucleo-chakra' },
  { label: 'Fragmento de Chakra Bestial', id: 'item-anime-naruto-fragmento-bestial' },
];

const TIER_REP: Record<NarutoLootTier, { id: string | null; level: number }> = {
  1: { id: 'naruto-classic', level: 5 },
  2: { id: 'shikamaru', level: 15 },
  3: { id: 'gaara', level: 25 },
  4: { id: 'kakashi', level: 40 },
  5: { id: 'naruto-kyubi', level: 50 },
};

function summarizeHours(samples: number[], extra: Record<string, number>) {
  return {
    ...extra,
    mean: samples.reduce((a, b) => a + b, 0) / samples.length,
    p10: percentile(samples, 10),
    p25: percentile(samples, 25),
    p50: percentile(samples, 50),
    p75: percentile(samples, 75),
    p90: percentile(samples, 90),
  };
}

function main(): void {
  const items = listItemDefinitions();
  const catalog = items
    .map((item) => ({
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      sellable: item.sellable !== false && getItemSellValue(item.id) > 0,
      sell: getItemSellValue(item.id),
      npcTable: NARUTO_NPC_SELL_PRICES[item.id] ?? null,
    }))
    .sort((a, b) => b.sell - a.sell);

  const lootKeyMismatch = listNarutoTierCharacterIds().filter((id) => !NARUTO_CHARACTER_LOOT[id]);
  const orphanLootKeys = Object.keys(NARUTO_CHARACTER_LOOT).filter((id) => NARUTO_CHARACTER_TIER[id] == null);

  const wanted = WANTED.map((row) => {
    const hit = getItem(row.id);
    return {
      label: row.label,
      id: row.id,
      inRegistry: Boolean(hit),
      name: hit?.name ?? null,
      rarity: hit?.rarity ?? null,
      sell: hit ? getItemSellValue(hit.id) : 0,
    };
  });

  const genericEv = mcLoot(null, 50_000, 1);
  const characters = Object.entries(NARUTO_CHARACTER_LOOT).map(([id, profile]) => {
    const tier = (NARUTO_CHARACTER_TIER[id] ?? 1) as NarutoLootTier;
    const ev = mcLoot(id, 25_000, 200 + id.length * 13);
    const level = TIER_REP[tier].level;
    const kph = estimateHuntKillsPerMinute(level, huntEnemyHpForLevel(level)) * 60;
    const directEv = expectedDirectCopper(level);
    return {
      id,
      tier,
      signature: profile.signature,
      secondary: profile.secondary,
      lootKeyOk: NARUTO_CHARACTER_TIER[id] != null,
      emptyRate: ev.emptyRate,
      multiRate: ev.multiRate,
      sellEv: ev.sellEv,
      directEv,
      totalEv: directEv + ev.sellEv,
      kph,
      copperPerHour: (directEv + ev.sellEv) * kph,
      top: ev.rows.slice(0, 5),
    };
  });
  characters.sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id));

  const huntHours: Record<string, ReturnType<typeof summarizeHours>> = {};
  ([1, 2, 3, 4, 5] as NarutoLootTier[]).forEach((tier) => {
    const rep = TIER_REP[tier];
    const kph = estimateHuntKillsPerMinute(rep.level, huntEnemyHpForLevel(rep.level)) * 60;
    const extra = { level: rep.level, kph, expectedDirectPerHour: expectedDirectCopper(rep.level) * kph };
    huntHours[`T${tier}-character`] = summarizeHours(hourSamples(rep.id, rep.level, 10_000, 9000 + tier), extra);
    huntHours[`T${tier}-generic`] = summarizeHours(hourSamples(null, rep.level, 10_000, 8000 + tier), extra);
  });

  let firstDirect = 0;
  let firstSell = 0;
  let firstKills = 0;
  const hourRng = mulberry32(4242);
  for (let lv = 1; lv < 50; lv += 1) {
    const kills = Math.max(
      1,
      Math.round(estimateHuntKillsPerMinute(lv, huntEnemyHpForLevel(lv)) * (60 / 49)),
    );
    firstKills += kills;
    for (let i = 0; i < kills; i += 1) {
      firstDirect += copperRewardForKill(lv, hourRng);
      for (const drop of rollNarutoKill('naruto-classic', hourRng)) {
        firstSell += getItemSellValue(drop.itemId) * drop.quantity;
      }
    }
  }

  const medic = [1, 10, 25, 50].map((level) => {
    const max = hpMaxAtLevel(level);
    return {
      level,
      hpMax: max,
      bands: [0.25, 0.5, 0.75, 1].map((pct) => {
        const missing = Math.round(max * pct);
        return { pct, missing, cost: calculateMedicCost(missing, max) };
      }),
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    architecture: {
      huntDirectCopper: true,
      copperFormula: '1 + floor(rng * max(2,min(25,ceil(level/3)))) guaranteed per kill',
      lootModel: 'independent fragment roll + one material rarity roll (0 or 1 material). qty=1',
      qualityAffectsLoot: false,
      guildCopperBonusLive: false,
      vipAffectsCopper: false,
      vipEmptyReroll: 'VIP_LOOT_MULT 1.15 empty-kill reroll only; excluded from baseline',
      helperAutoSell: false,
      autoPickup: true,
      forgeCopper: false,
    },
    catalog: {
      itemCount: items.length,
      sellableCount: catalog.filter((row) => row.sellable).length,
      sellZero: catalog.filter((row) => row.sell === 0).map((row) => row.id),
      sellTop: catalog.slice(0, 15),
      wanted,
      lootKeyMismatch,
      orphanLootKeys,
      rarityWeights: NARUTO_RARITY_WEIGHTS,
      fragmentExpectedKills: NARUTO_FRAGMENT_EXPECTED_KILLS,
    },
    sources: {
      genericHunt: genericEv,
      characters,
      dailyMissions: DAILY_MISSION_POOL.map((m) => ({ id: m.id, copper: copperFromRewards(m.rewards) })),
      weeklyMissions: WEEKLY_MISSION_POOL.map((m) => ({ id: m.id, copper: copperFromRewards(m.rewards) })),
      achievements: ACHIEVEMENT_DEFINITIONS.map((a) => ({
        id: a.id,
        copper: copperFromRewards(a.rewards),
      })).filter((a) => a.copper > 0),
      dailyLogin: DAILY_LOGIN_REWARDS.map((d) => ({ day: d.day, copper: copperFromRewards(d.rewards) })),
      bosses: BOSS_DEFINITIONS.map((b) => ({
        id: b.id,
        name: b.name,
        copper: copperFromRewards(b.rewards),
        first: copperFromRewards(b.firstClearReward),
      })),
      worldBoss: {
        participation: copperFromRewards(WORLD_BOSS_DEFINITION.participationRewards),
        defeat: copperFromRewards(WORLD_BOSS_DEFINITION.defeatRewards),
        milestones: WORLD_BOSS_DEFINITION.milestones.map((m) => ({
          id: m.id,
          copper: copperFromRewards(m.rewards),
        })),
      },
    },
    sinks: {
      medicConfig: MEDIC_CONFIG,
      medic,
      awakening: Object.entries(AWAKENING_REQUIREMENTS).map(([level, req]) => ({
        level: Number(level),
        copper: req.copper,
      })),
      awakeningTotal: Object.values(AWAKENING_REQUIREMENTS).reduce((sum, req) => sum + req.copper, 0),
      shop: SHOP_OFFERS.filter((o) => o.currency === 'copper').map((o) => ({
        id: o.id,
        itemId: o.itemId,
        name: getItem(o.itemId)?.name ?? o.itemId,
        price: o.price,
        limit: o.purchaseLimit,
        reset: o.resetType,
      })),
      guildShop: GUILD_SHOP_OFFERS.map((o) => ({
        id: o.id,
        itemId: o.itemId,
        price: o.price,
        limit: o.purchaseLimit,
        reset: o.resetType,
        guildLevel: o.guildLevelRequirement,
      })),
      helper: HELPER_SHOP_PRICES,
      sealingBase: SEALING_SCROLL_PRICE,
      sealingTiers: SEALING_SCROLL_TIERS.map((t) => ({ itemId: t.itemId, rank: t.rank })),
    },
    huntHours,
    firstHourApprox: {
      note: 'Even split of 60 min across lv 1-49 on same-level hunt; Naruto Classic loot. Not XP-clock exact.',
      kills: firstKills,
      walletCopper: firstDirect,
      inventorySellValue: firstSell,
      combined: firstDirect + firstSell,
    },
  };

  console.log(JSON.stringify(report));
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  console.error('generic empty', genericEv.emptyRate.toFixed(3), 'sellEv', genericEv.sellEv.toFixed(2));
  for (const tier of [1, 2, 3, 4, 5] as NarutoLootTier[]) {
    const rows = characters.filter((c) => c.tier === tier);
    const hour = huntHours[`T${tier}-character`];
    console.error(
      `T${tier} n=${rows.length} avgSellEv=${avg(rows.map((r) => r.sellEv)).toFixed(1)} avgCu/h=${avg(rows.map((r) => r.copperPerHour)).toFixed(0)} kph=${hour.kph.toFixed(0)} p10=${hour.p10.toFixed(0)} p50=${hour.p50.toFixed(0)} p90=${hour.p90.toFixed(0)}`,
    );
  }
  console.error('mismatch', lootKeyMismatch.join(',') || 'none');
  console.error('orphan', orphanLootKeys.join(',') || 'none');
  console.error('wantedMissing', wanted.filter((w) => !w.inRegistry).map((w) => w.label).join(',') || 'none');
  console.error('firstHour', report.firstHourApprox);
}

main();
