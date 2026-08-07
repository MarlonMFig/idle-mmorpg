import type { VillageId } from '@/types/village';

export interface SkillUnlockDefinition {
  skillId: string;
  level: number;
  villages: readonly VillageId[] | 'all';
}

/**
 * Progressão inicial de jutsus.
 *
 * Nível 1 permanece sem jutsus. Kunai e shuriken são comuns; as técnicas
 * seguintes refletem a afinidade de cada vila. Novas entradas podem ser
 * adicionadas sem alterar a lógica da store.
 */
export const SKILL_UNLOCKS: readonly SkillUnlockDefinition[] = [
  { skillId: 'skill-kunai', level: 2, villages: 'all' },
  { skillId: 'skill-shuriken', level: 4, villages: 'all' },

  { skillId: 'skill-katon-gokakyu', level: 6, villages: ['konoha'] },
  { skillId: 'skill-juuken', level: 8, villages: ['konoha'] },
  { skillId: 'skill-katon-ryuka', level: 12, villages: ['konoha'] },
  { skillId: 'skill-omote-renge', level: 16, villages: ['konoha'] },
  { skillId: 'skill-chidori', level: 20, villages: ['konoha', 'kumo'] },
  // Rasengan: liberado na criação (hotbar da Folha), sem requisito de nível.

  { skillId: 'skill-sabaku-kyu', level: 6, villages: ['suna', 'iwa'] },
  { skillId: 'skill-fuuton-arizukokku', level: 12, villages: ['suna'] },

  { skillId: 'skill-suiton-suiryudan', level: 6, villages: ['kiri'] },

  { skillId: 'skill-raiton-kudaru', level: 6, villages: ['kumo'] },
] as const;

export function listSkillUnlocksFor(villageId: VillageId, level: number): SkillUnlockDefinition[] {
  return SKILL_UNLOCKS.filter(
    (unlock) =>
      unlock.level <= level &&
      (unlock.villages === 'all' || unlock.villages.includes(villageId)),
  ).sort((a, b) => a.level - b.level);
}
