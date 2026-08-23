'use client';

import { isDevMode } from '@/config/devConfig';
import { DAILY_LOGIN_REWARDS } from '@/data/daily-login/daily-login-rewards';
import { getDailyCycleId } from '@/lib/mission-cycle';
import { validateDailyLoginCatalog } from '@/lib/daily-login-validation';
import { useStore } from '@/hooks/use-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import { gemStore } from '@/stores/gem-store';
import type { DailyLoginDay } from '@/types/daily-login';
import { useMemo, useState } from 'react';

const DAYS: DailyLoginDay[] = [1, 2, 3, 4, 5, 6, 7];

export function CharacterLabDailyLoginDebug() {
  const currentDay = useStore(dailyLoginStore, (s) => s.currentDay);
  const lastClaim = useStore(dailyLoginStore, (s) => s.lastClaimCycleId);
  const totalClaims = useStore(dailyLoginStore, (s) => s.totalClaims);
  const legacyStatus = useStore(dailyLoginStore, (s) => s.legacyMigrationStatus);
  const legacyField = useStore(gemStore, (s) => s.lastLoginDay);
  const [tick, setTick] = useState(0);
  const warnings = useMemo(() => validateDailyLoginCatalog(), []);
  void tick;
  const available = dailyLoginStore.isAvailable();
  const cycleId = dailyLoginStore.getCycleId();

  if (!isDevMode()) return null;

  return (
    <div className="character-lab__subpanel">
      <h3>DAILY LOGIN</h3>
      <p className="character-lab__hint">Provider: official (dailyLoginStore)</p>
      <p className="character-lab__hint">
        Current Day: {currentDay} · Current Cycle: {cycleId} (canon {getDailyCycleId()})
      </p>
      <p className="character-lab__hint">Claimed: {available ? 'NO' : 'YES'}</p>
      <p className="character-lab__hint">Last Claim: {lastClaim ?? '—'}</p>
      <p className="character-lab__hint">totalClaims: {totalClaims}</p>
      <p className="character-lab__hint">
        Legacy State: {legacyStatus}
        {legacyField ? ` · gem.lastLoginDay=${legacyField}` : ' / none'}
      </p>
      {warnings.length > 0 ? (
        <ul className="character-lab__hint">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="character-lab__hint">Catalog validator: OK · {DAILY_LOGIN_REWARDS.length} dias</p>
      )}
      <div className="character-lab__row">
        {DAYS.map((day) => (
          <button key={day} type="button" onClick={() => dailyLoginStore.devSetDay(day)}>
            Set Day {day}
          </button>
        ))}
      </div>
      <div className="character-lab__row">
        <button
          type="button"
          onClick={() => {
            dailyLoginStore.devSimulateNextDay();
            setTick((n) => n + 1);
          }}
        >
          Simulate Next Day (shared clock)
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Reset só do Daily Login?')) dailyLoginStore.devReset();
            setTick((n) => n + 1);
          }}
        >
          Reset Daily Login
        </button>
        <button
          type="button"
          onClick={() => {
            dailyLoginStore.devForceAvailable();
            setTick((n) => n + 1);
          }}
        >
          Force Available
        </button>
        <button
          type="button"
          onClick={() => {
            dailyLoginStore.devClaimTestReward();
            setTick((n) => n + 1);
          }}
        >
          Claim Test Reward
        </button>
        <button
          type="button"
          onClick={() => {
            dailyLoginStore.applyGemLegacyMigration();
            setTick((n) => n + 1);
          }}
        >
          Re-run Legacy Migration
        </button>
      </div>
    </div>
  );
}
