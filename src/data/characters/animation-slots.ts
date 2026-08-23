import type { CharacterPack, SpriteSheetDef } from '@/data/character-packs';
import type { CharacterAnimSlot } from '@/types/character-definition';

/**
 * Resolve um slot de animação com fallback seguro.
 * Nunca lança: slots ausentes devolvem `null` (hurt/death) ou a folha anterior.
 */
export function getPackAnimation(
  pack: CharacterPack,
  slot: CharacterAnimSlot,
): SpriteSheetDef | null {
  const chain = pack.attackChain ?? [];
  const combo1 = chain[0] ?? pack.attack;
  const combo2 = chain[1] ?? combo1;
  const combo3 = chain[2] ?? combo2;
  const specialId = (index: number) => pack.hotbarSkillIds[index];

  switch (slot) {
    case 'walk':
      return pack.walk;
    case 'idle':
      return pack.idle ?? pack.walk;
    case 'attack':
      return pack.attack;
    case 'combo1':
      return combo1;
    case 'combo2':
      return combo2;
    case 'combo3':
      return combo3;
    case 'hurt':
      return pack.hurt ?? null;
    case 'death':
      return pack.death ?? null;
    case 'special1': {
      const id = specialId(0);
      return id ? (pack.skillAnims[id] ?? null) : null;
    }
    case 'special2': {
      const id = specialId(1);
      return id ? (pack.skillAnims[id] ?? null) : null;
    }
    case 'special3': {
      const id = specialId(2);
      return id ? (pack.skillAnims[id] ?? null) : null;
    }
    default:
      return null;
  }
}

/** Slots que o personagem realmente possui (sem fallback silencioso). */
export function listAvailableAnimSlots(pack: CharacterPack): CharacterAnimSlot[] {
  const slots: CharacterAnimSlot[] = ['idle', 'walk', 'attack'];
  if (pack.attackChain && pack.attackChain.length >= 1) slots.push('combo1');
  if (pack.attackChain && pack.attackChain.length >= 2) slots.push('combo2');
  if (pack.attackChain && pack.attackChain.length >= 3) slots.push('combo3');
  if (pack.hurt) slots.push('hurt');
  if (pack.death) slots.push('death');
  pack.hotbarSkillIds.forEach((skillId, index) => {
    if (!skillId || !pack.skillAnims[skillId]) return;
    if (index === 0) slots.push('special1');
    if (index === 1) slots.push('special2');
    if (index === 2) slots.push('special3');
  });
  return slots;
}
