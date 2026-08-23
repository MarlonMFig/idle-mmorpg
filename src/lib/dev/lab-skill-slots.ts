import type { CharacterPack } from '@/data/character-packs';

/** Slots oficiais de Skill no Test Lab e no hotbar. Sempre 4. */
export const LAB_SKILL_SLOTS = [1, 2, 3, 4] as const;
export type LabSkillSlot = (typeof LAB_SKILL_SLOTS)[number];

export type OfficialHotbar = [string | null, string | null, string | null, string | null];

export function padOfficialHotbar(ids: readonly (string | null | undefined)[] | null | undefined): OfficialHotbar {
  return [ids?.[0] ?? null, ids?.[1] ?? null, ids?.[2] ?? null, ids?.[3] ?? null];
}

/**
 * Slot N → skillId.
 * Fonte: `pack.hotbarSkillIds[N-1]`, não a união visual de `skillAnims`.
 * Índices 0–3 do hotbar são os 4 slots oficiais. Entradas extras não viram Slot 5.
 */
export function officialSkillSlots(
  pack: Pick<CharacterPack, 'hotbarSkillIds'>,
): Record<LabSkillSlot, string | null> {
  const padded = padOfficialHotbar(pack.hotbarSkillIds);
  return { 1: padded[0], 2: padded[1], 3: padded[2], 4: padded[3] };
}

export function swapOfficialSlots(slots: OfficialHotbar, from: LabSkillSlot, to: LabSkillSlot): OfficialHotbar {
  const next: OfficialHotbar = [slots[0], slots[1], slots[2], slots[3]];
  const a = from - 1;
  const b = to - 1;
  const tmp = next[a];
  next[a] = next[b];
  next[b] = tmp;
  return next;
}

export function moveOfficialSlot(slots: OfficialHotbar, slot: LabSkillSlot, dir: -1 | 1): OfficialHotbar {
  const other = (slot + dir) as LabSkillSlot;
  if (other < 1 || other > 4) return slots;
  return swapOfficialSlots(slots, slot, other);
}

export function hotbarsEqual(a: OfficialHotbar, b: OfficialHotbar): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

export function skillIdForSlot(
  pack: Pick<CharacterPack, 'hotbarSkillIds'> | null | undefined,
  slot: LabSkillSlot,
): string | null {
  if (!pack) return null;
  return officialSkillSlots(pack)[slot];
}

export function slotForSkillId(
  pack: Pick<CharacterPack, 'hotbarSkillIds'> | null | undefined,
  skillId: string | null | undefined,
): LabSkillSlot | null {
  if (!pack || !skillId) return null;
  const slots = officialSkillSlots(pack);
  for (const slot of LAB_SKILL_SLOTS) {
    if (slots[slot] === skillId) return slot;
  }
  return null;
}

/**
 * Skills fora dos 4 slots oficiais (hotbar[4+] ou `skillAnims` sem slot).
 * Não apagar — só não aparecem como Slot 5.
 */
export function extraLegacySkillIds(pack: Pick<CharacterPack, 'hotbarSkillIds' | 'skillAnims'>): string[] {
  const official = new Set(
    LAB_SKILL_SLOTS.map((slot) => officialSkillSlots(pack)[slot]).filter((id): id is string => Boolean(id)),
  );
  const extra: string[] = [];
  for (let i = 4; i < pack.hotbarSkillIds.length; i += 1) {
    const id = pack.hotbarSkillIds[i];
    if (id && !extra.includes(id)) extra.push(id);
  }
  for (const id of Object.keys(pack.skillAnims)) {
    if (!official.has(id) && !extra.includes(id)) extra.push(id);
  }
  return extra;
}
