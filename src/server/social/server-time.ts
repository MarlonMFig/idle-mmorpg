/**
 * Server time / Game Cycle — America/Sao_Paulo (mesmo algoritmo do client Item 33).
 * Guild Boss e Ranking usam Date.now() do servidor, nunca clock do client.
 */

export const SERVER_GAME_TIMEZONE = 'America/Sao_Paulo';

function zonedYmd(ms: number, timeZone = SERVER_GAME_TIMEZONE): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
    day: Number(parts.find((p) => p.type === 'day')?.value),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function serverNow(): number {
  return Date.now();
}

export function getServerDailyCycleId(ms = serverNow()): string {
  const { year, month, day } = zonedYmd(ms);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Semana ISO começando na segunda (America/Sao_Paulo). */
export function getServerWeeklyCycleId(ms = serverNow()): string {
  const { year, month, day } = zonedYmd(ms);
  const utc = Date.UTC(year, month - 1, day);
  const dow = new Date(utc).getUTCDay(); // 0=dom
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(utc + mondayOffset * 86400000);
  const wy = monday.getUTCFullYear();
  const wm = monday.getUTCMonth() + 1;
  const wd = monday.getUTCDate();
  return `${wy}-W${pad2(wm)}${pad2(wd)}`;
}

export function attemptResetCycleIdServer(
  resetType: 'daily' | 'weekly',
  daily = getServerDailyCycleId(),
  weekly = getServerWeeklyCycleId(),
): string {
  return resetType === 'weekly' ? weekly : daily;
}

/** Próximo reset semanal (ms) — segunda 00:00 America/Sao_Paulo. */
export function getServerNextWeeklyResetMs(ms = serverNow()): number {
  const current = getServerWeeklyCycleId(ms);
  let candidate = ms + 3600_000;
  for (let i = 0; i < 24 * 10; i += 1) {
    if (getServerWeeklyCycleId(candidate) !== current) {
      // Alinha para o início do dia no fuso (aproxima à meia-noite local via varredura).
      const dayStart = candidate - (candidate % 3600_000);
      for (let j = 0; j < 48; j += 1) {
        const probe = dayStart - j * 3600_000;
        if (getServerWeeklyCycleId(probe) === current) {
          return dayStart - (j - 1) * 3600_000;
        }
      }
      return candidate;
    }
    candidate += 3600_000;
  }
  return ms + 7 * 86400_000;
}
