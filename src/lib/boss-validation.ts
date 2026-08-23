import { getItem } from '@/data/items';
import { getSkill } from '@/data/skills';
import { listBossDefinitions } from '@/data/bosses/boss-registry';

export function validateBossCatalog(): string[] {
  const warnings: string[] = [];
  const ids = new Set<string>();
  for (const def of listBossDefinitions()) {
    if (ids.has(def.id)) warnings.push(`[BossValidation] id duplicado: ${def.id}`);
    ids.add(def.id);
    if (!(def.hp > 0)) warnings.push(`[BossValidation] ${def.id} HP inválido`);
    if (!(def.level > 0)) warnings.push(`[BossValidation] ${def.id} level inválido`);
    if (def.timeLimit != null && !(def.timeLimit > 0)) {
      warnings.push(`[BossValidation] ${def.id} timeLimit inválido`);
    }
    if (def.attemptRules.maxAttempts != null && def.attemptRules.maxAttempts < 0) {
      warnings.push(`[BossValidation] ${def.id} maxAttempts inválido`);
    }
    if (!def.phases.length) warnings.push(`[BossValidation] ${def.id} sem phases`);
    const phaseIds = new Set<string>();
    for (const phase of def.phases) {
      if (phaseIds.has(phase.id)) warnings.push(`[BossValidation] ${def.id} phase duplicada: ${phase.id}`);
      phaseIds.add(phase.id);
      if (phase.hpThreshold < 0 || phase.hpThreshold > 1) {
        warnings.push(`[BossValidation] ${def.id} hpThreshold inválido (${phase.id})`);
      }
      for (const skillId of phase.skillOverrides ?? []) {
        if (!getSkill(skillId)) warnings.push(`[BossValidation] ${def.id} skill inexistente: ${skillId}`);
      }
    }
    for (const skillId of def.skills) {
      if (!getSkill(skillId)) warnings.push(`[BossValidation] ${def.id} skill inexistente: ${skillId}`);
    }
    for (const reward of [...def.rewards, ...(def.firstClearReward ?? [])]) {
      if (reward.type === 'item' && !getItem(reward.id)) {
        warnings.push(`[BossValidation] ${def.id} item inexistente: ${reward.id}`);
      }
      if ((reward.type === 'copper' || reward.type === 'animeCoins' || reward.type === 'item') && !(reward.amount > 0)) {
        warnings.push(`[BossValidation] ${def.id} reward quantidade inválida`);
      }
    }
  }
  return warnings;
}
