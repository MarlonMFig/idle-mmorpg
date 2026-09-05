import {
  getHeritageOption,
  type HeritageModifiers,
  type HeritageOptionDefinition,
  type HeritageSlotId,
} from '@/constants/heritage-system';
import {
  resolveHeritageModifiers,
  applyHeritageToAttributeValues,
  type HeritageResolvedModifiers,
} from '@/lib/heritage-modifiers';
import { heritageStore } from '@/stores/heritage-store';
import type { HeritageLoadout } from '@/types/heritage';
import type { AttributeValues } from '@/types/attributes';

function leveledOption(slot: HeritageSlotId, id: string | null): HeritageOptionDefinition | null {
  const option = getHeritageOption(slot, id);
  return option && 'levels' in option ? option : null;
}

export function resolveLoadoutHeritageModifiers(
  loadout: HeritageLoadout,
  senninActive = false,
): HeritageResolvedModifiers {
  return resolveHeritageModifiers({
    loadout,
    cla: leveledOption('cla', loadout.claId),
    summon: leveledOption('summon', loadout.summonId),
    cursedSeal: leveledOption('cursedSeal', loadout.cursedSealId),
    sennin: leveledOption('sennin', loadout.senninId),
    senninActive,
  });
}

export function getActiveHeritageResolved(now = Date.now()): HeritageResolvedModifiers {
  const loadout = heritageStore.getLoadout();
  const senninActive = heritageStore.isSenninActive(now);
  return resolveLoadoutHeritageModifiers(loadout, senninActive);
}

export function applyActiveHeritageToTotals(
  baseline: AttributeValues,
  now = Date.now(),
): AttributeValues {
  return applyHeritageToAttributeValues(baseline, getActiveHeritageResolved(now));
}

export function heritageCombatExtras(now = Date.now()) {
  return getActiveHeritageResolved(now).combat;
}

export function mergeHeritageModifierPreview(mods: HeritageModifiers): string {
  const parts: string[] = [];
  if (mods.ataque) parts.push(`Atk ${mods.ataque > 0 ? '+' : ''}${Math.round(mods.ataque * 100)}%`);
  if (mods.defesa) parts.push(`Def ${mods.defesa > 0 ? '+' : ''}${Math.round(mods.defesa * 100)}%`);
  if (mods.hp) parts.push(`HP ${mods.hp > 0 ? '+' : ''}${Math.round(mods.hp * 100)}%`);
  if (mods.velocidadeAtaque) {
    parts.push(`Vel ${mods.velocidadeAtaque > 0 ? '+' : ''}${Math.round(mods.velocidadeAtaque * 100)}%`);
  }
  if (mods.critico) parts.push(`Crít ${mods.critico > 0 ? '+' : ''}${Math.round(mods.critico * 100)}%`);
  return parts.join(' · ');
}
