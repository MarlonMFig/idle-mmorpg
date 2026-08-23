import type { LineageId } from '@/types/character-meta';
import type { LineageSpecializationSlot } from '@/types/lineage';
import { getLineageDefinition } from '@/data/lineages/registry';

/**
 * Correção Item 22 — Especializações definitivas.
 *
 * Persistência usa slots estáveis (`specializationA|B|C`).
 * Os nomes/keys temáticos mudaram; o progresso por slot é preservado.
 *
 * Mapa conceitual (legado → definitivo), por lineageId + slot:
 *
 * Ninja A: Ninjutsu → Sharingan (sharingan)
 * Ninja B: Taijutsu → Byakugan (byakugan)
 * Ninja C: Controle de Chakra → Rinnegan (rinnegan)
 *
 * Pirata A: Combatente → Haki do Armamento (armament-haki)
 * Pirata B: Estrategista → Haki da Observação (observation-haki)
 * Pirata C: Resistente → Haki do Conquistador (conqueror-haki)
 *
 * Caçador A: Combatente → Reforço (enhancement)
 * Caçador B: Técnico → Emissão (emission)
 * Caçador C: Especialista → Especialização (specialization)
 *
 * Feiticeiro A: Ofensivo → Técnica Amaldiçoada (cursed-technique)
 * Feiticeiro B: Controle → Energia Reversa (reverse-energy)
 * Feiticeiro C: Sustentação → Expansão de Domínio (domain-expansion)
 *
 * Shinigami / Guerreiro: nomes já alinhados (keys temáticos adicionados).
 */

export const LINEAGE_SPECIALIZATION_KEYS: Record<
  LineageId,
  Record<LineageSpecializationSlot, string>
> = {
  ninja: {
    specializationA: 'sharingan',
    specializationB: 'byakugan',
    specializationC: 'rinnegan',
  },
  shinigami: {
    specializationA: 'zanjutsu',
    specializationB: 'kido',
    specializationC: 'hakuda',
  },
  pirata: {
    specializationA: 'armament-haki',
    specializationB: 'observation-haki',
    specializationC: 'conqueror-haki',
  },
  cacador: {
    specializationA: 'enhancement',
    specializationB: 'emission',
    specializationC: 'specialization',
  },
  feiticeiro: {
    specializationA: 'cursed-technique',
    specializationB: 'reverse-energy',
    specializationC: 'domain-expansion',
  },
  guerreiro: {
    specializationA: 'power',
    specializationB: 'ki-control',
    specializationC: 'combat-instinct',
  },
};

/** Nomes legados do Item 22 inicial (somente documentação / auditoria). */
export const LEGACY_SPECIALIZATION_NAMES: Record<
  LineageId,
  Record<LineageSpecializationSlot, string>
> = {
  ninja: {
    specializationA: 'Ninjutsu',
    specializationB: 'Taijutsu',
    specializationC: 'Controle de Chakra',
  },
  shinigami: {
    specializationA: 'Zanjutsu',
    specializationB: 'Kidō',
    specializationC: 'Hakuda',
  },
  pirata: {
    specializationA: 'Combatente',
    specializationB: 'Estrategista',
    specializationC: 'Resistente',
  },
  cacador: {
    specializationA: 'Combatente',
    specializationB: 'Técnico',
    specializationC: 'Especialista',
  },
  feiticeiro: {
    specializationA: 'Ofensivo',
    specializationB: 'Controle',
    specializationC: 'Sustentação',
  },
  guerreiro: {
    specializationA: 'Poder',
    specializationB: 'Controle de Ki',
    specializationC: 'Instinto de Combate',
  },
};

/**
 * Resolve o key temático atual a partir do slot persistido.
 * Saves antigos com specializationA + Ninjutsu III continuam specializationA → Sharingan III.
 */
export function resolveSpecializationKey(
  lineageId: LineageId,
  slot: LineageSpecializationSlot | null | undefined,
): string | null {
  if (!slot) return null;
  return LINEAGE_SPECIALIZATION_KEYS[lineageId]?.[slot] ?? null;
}

export function resolveSpecializationDisplayName(
  lineageId: LineageId,
  slot: LineageSpecializationSlot | null | undefined,
): string | null {
  if (!slot) return null;
  const def = getLineageDefinition(lineageId);
  return def?.specializations.find((row) => row.id === slot)?.name ?? null;
}

/**
 * Migration explícita: slots já são canônicos.
 * Garante selectedSpecializationId ∈ {A,B,C} e sincroniza level espelho.
 * Não reseta level/onlineKills.
 */
export function migrateSpecializationSlotIds(
  selectedSpecializationId: unknown,
): LineageSpecializationSlot | null {
  if (
    selectedSpecializationId === 'specializationA' ||
    selectedSpecializationId === 'specializationB' ||
    selectedSpecializationId === 'specializationC'
  ) {
    return selectedSpecializationId;
  }
  return null;
}
