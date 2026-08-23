import { getXpRequiredForLevel } from '@/lib/player-progression';
import type { VitalsState } from '@/types/hud';

/** Valores iniciais da HUD / vitalsStore. */
export const DEFAULT_VITALS: VitalsState = {
  hp: 100,
  hpMax: 100,
  xp: 0,
  xpMax: getXpRequiredForLevel(1),
  level: 1,
};
