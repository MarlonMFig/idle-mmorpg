import { isMissionEligible } from '@/lib/mission-eligibility';
import { buildMissionWorldSnapshot } from '@/lib/mission-snapshot';
import type { MissionDefinition, MissionWorldSnapshot } from '@/types/missions';

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const MAX_KILL_FAMILY = 2;
const MAX_PER_TAG = 2;
const KILL_GROUPS = new Set(['online-kills', 'hunt-kills', 'lineage-kills']);

/**
 * Seleção determinística: mesmo cycleId → mesmos IDs.
 * Evita 5 missões da mesma família (ex.: só kills).
 */
export function selectCycleMissions(
  pool: readonly MissionDefinition[],
  cycleKey: string,
  count = 5,
  world: MissionWorldSnapshot = buildMissionWorldSnapshot(),
): string[] {
  const eligible = pool.filter((def) => isMissionEligible(def, world));
  const rng = mulberry32(hashSeed(cycleKey));
  const ordered = shuffled(eligible, rng);
  const picked: MissionDefinition[] = [];
  const groups = new Set<string>();
  const tagCount: Record<string, number> = {};

  const canTake = (def: MissionDefinition, strict: boolean): boolean => {
    if (picked.some((row) => row.id === def.id)) return false;
    if (groups.has(def.variantGroup)) return false;
    if (strict && (tagCount[def.tag] ?? 0) >= MAX_PER_TAG) return false;
    const killCount = picked.filter((row) => KILL_GROUPS.has(row.variantGroup)).length;
    if (strict && KILL_GROUPS.has(def.variantGroup) && killCount >= MAX_KILL_FAMILY) return false;
    return true;
  };

  for (const def of ordered) {
    if (picked.length >= count) break;
    if (!canTake(def, true)) continue;
    picked.push(def);
    groups.add(def.variantGroup);
    tagCount[def.tag] = (tagCount[def.tag] ?? 0) + 1;
  }

  if (picked.length < count) {
    for (const def of ordered) {
      if (picked.length >= count) break;
      if (!canTake(def, false)) continue;
      picked.push(def);
      groups.add(def.variantGroup);
      tagCount[def.tag] = (tagCount[def.tag] ?? 0) + 1;
    }
  }

  return picked.slice(0, count).map((def) => def.id);
}
