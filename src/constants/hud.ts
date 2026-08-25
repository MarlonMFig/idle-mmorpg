import { d } from '@/lib/decimal';
import { getXpRequiredForLevel } from '@/lib/player-progression';
import type { VitalsState } from '@/types/hud';

/** Valores iniciais da HUD / vitalsStore. */
export const DEFAULT_VITALS: VitalsState = {
  hp: d(100),
  hpMax: d(100),
  xp: d(0),
  xpMax: getXpRequiredForLevel(1),
  level: 1,
};
