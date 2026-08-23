'use client';

import { isDevMode } from '@/config/devConfig';
import {
  advanceDevToNextDay,
  advanceDevToNextWeek,
  clearDevClockOverride,
  formatResetCountdown,
  gameNow,
  getGameCycleDebugSnapshot,
} from '@/lib/mission-cycle';
import {
  detectGameCycleDivergences,
  listGameCycleConsumers,
} from '@/lib/game-cycle-debug';
import { useEffect, useState } from 'react';

/**
 * GAME CYCLE DEBUG — TimeProvider + consumidores (Item 33).
 */
export function CharacterLabGameCycleDebug() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  if (!isDevMode()) return null;

  void tick;
  const snap = getGameCycleDebugSnapshot();
  const consumers = listGameCycleConsumers();
  const warnings = detectGameCycleDivergences();
  const nowLabel = new Date(snap.nowMs).toISOString();

  return (
    <div className="character-lab__subpanel">
      <h3>GAME CYCLE DEBUG</h3>
      <p className="character-lab__hint">Now: {nowLabel} ({snap.nowMs})</p>
      <p className="character-lab__hint">Timezone: {snap.timezone}</p>
      <p className="character-lab__hint">
        Daily Cycle: {snap.dailyCycleId} · Weekly: {snap.weeklyCycleId} (week starts{' '}
        {snap.weekStartsOn})
      </p>
      <p className="character-lab__hint">
        Next Daily Reset: {new Date(snap.nextDailyResetMs).toISOString()} ·{' '}
        {formatResetCountdown(snap.nextDailyResetMs, gameNow())}
      </p>
      <p className="character-lab__hint">
        Next Weekly Reset: {new Date(snap.nextWeeklyResetMs).toISOString()} ·{' '}
        {formatResetCountdown(snap.nextWeeklyResetMs, gameNow())}
      </p>
      <p className="character-lab__hint">
        Override: {snap.overrideActive ? 'ACTIVE' : 'off'}
      </p>
      <p className="character-lab__hint">Consumers:</p>
      <ul className="character-lab__hint">
        {consumers.map((row) => (
          <li key={row.system}>
            {row.system}
            {row.kind === 'none'
              ? ' — no calendar cycle (duration/expiresAt)'
              : ` — d:${row.observedDaily ?? '—'} w:${row.observedWeekly ?? '—'}`}
          </li>
        ))}
      </ul>
      {warnings.length > 0 ? (
        <ul className="character-lab__hint">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="character-lab__hint">Divergence check: OK</p>
      )}
      <div className="character-lab__row">
        <button
          type="button"
          onClick={() => {
            advanceDevToNextDay();
            setTick((n) => n + 1);
          }}
        >
          Simulate Next Day
        </button>
        <button
          type="button"
          onClick={() => {
            advanceDevToNextWeek();
            setTick((n) => n + 1);
          }}
        >
          Simulate Next Week
        </button>
        <button
          type="button"
          onClick={() => {
            clearDevClockOverride();
            setTick((n) => n + 1);
          }}
        >
          Clear Clock Override
        </button>
        <button type="button" onClick={() => setTick((n) => n + 1)}>
          Refresh
        </button>
      </div>
    </div>
  );
}
