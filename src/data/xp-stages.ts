/**
 * Compat: estágios WONSR e helpers de XP.
 * Fonte oficial: `LEVEL_RULES` / `LEVEL_XP_RANGES` em `@/config/gameConfig`
 * e funções em `@/lib/player-progression`.
 */
export { LEVEL_XP_RANGES as WONSR_XP_STAGES, type XpStageBand } from '@/config/gameConfig';

export {
  applyStageXpGain,
  getXpRequiredForLevel as xpRequiredForLevel,
  normalizedStageRate,
  stageBandForLevel,
  stageMultiplierForLevel,
} from '@/lib/player-progression';
