import { CharacterRegistry } from '@/data/characters';
import {
  cloneImmunities,
  cloneResistances,
  emptyCombatAffinity,
  isDamageElement,
  type CombatAffinityFields,
  type DamageElement,
} from '@/data/damage-elements';
import { characterLabStore, isLabDummyId, isCharacterLabSession } from '@/stores/character-lab-store';
import { teamStore } from '@/stores/team-store';
import { PLAYER_STATUS_UNIT_ID } from '@/systems/combat-stats';
import type { EnemyDefinition } from '@/types/enemy';

export function getCombatAffinity(
  targetId: string,
  enemyDef?: EnemyDefinition | null,
): CombatAffinityFields {
  if (targetId === PLAYER_STATUS_UNIT_ID) {
    const activeId = teamStore.getActive()?.id ?? null;
    const pack = activeId ? CharacterRegistry.get(activeId)?.pack : undefined;
    return fromFields(pack);
  }
  if (targetId.startsWith('companion:')) {
    const id = targetId.slice('companion:'.length);
    return fromFields(CharacterRegistry.get(id)?.pack);
  }

  const base = fromFields(enemyDef);
  if (isCharacterLabSession() && isLabDummyId(targetId)) {
    const override = characterLabStore.getSnapshot().enemyAffinityOverride;
    if (override) {
      return {
        resistances: cloneResistances(override.resistances),
        immunities: cloneImmunities(override.immunities),
        statusResistances: base.statusResistances,
        statusImmunities: base.statusImmunities,
      };
    }
  }
  return base;
}

function fromFields(fields: CombatAffinityFields | null | undefined): CombatAffinityFields {
  const empty = emptyCombatAffinity();
  const immunities = (fields?.immunities ?? []).filter(isDamageElement);
  const resistances: Partial<Record<DamageElement, number>> = {};
  for (const [key, value] of Object.entries(fields?.resistances ?? {})) {
    if (isDamageElement(key) && Number.isFinite(value)) resistances[key] = value;
  }
  return {
    resistances,
    immunities,
    statusResistances: { ...(fields?.statusResistances ?? empty.statusResistances) },
    statusImmunities: [...(fields?.statusImmunities ?? empty.statusImmunities ?? [])],
  };
}
