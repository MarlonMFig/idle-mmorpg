import { Decimal, d } from './decimal';

export function resolveKills(
  dtSeconds: number,
  timeToKill: Decimal,
  combatProgress: number,
): { kills: number; leftoverProgress: number } {
  const ttk = timeToKill.toNumber();
  if (!Number.isFinite(ttk) || ttk <= 0) {
    return { kills: 0, leftoverProgress: combatProgress };
  }
  const available = Math.max(0, combatProgress) + Math.max(0, dtSeconds);
  const kills = Math.floor(available / ttk);
  const leftoverProgress = available - kills * ttk;
  return { kills, leftoverProgress };
}

export function timeToKill(enemyHp: Decimal, partyDps: Decimal): Decimal {
  if (partyDps.lte(0)) return d(Number.POSITIVE_INFINITY);
  return enemyHp.div(partyDps);
}
