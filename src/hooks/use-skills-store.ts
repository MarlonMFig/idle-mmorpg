'use client';

import { useStore } from '@/hooks/use-store';
import { skillsStore } from '@/stores/skills-store';
import type { SkillsState } from '@/types/skill';

export function useSkillsStore(): SkillsState {
  return useStore(skillsStore);
}
