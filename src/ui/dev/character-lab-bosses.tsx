'use client';

import { isDevMode } from '@/config/devConfig';
import { listBossDefinitions } from '@/data/bosses/boss-registry';
import { validateBossCatalog } from '@/lib/boss-validation';
import { useStore } from '@/hooks/use-store';
import { bossStore } from '@/stores/boss-store';
import { useMemo, useState } from 'react';

export function CharacterLabBossDebug() {
  const runtime = useStore(bossStore, (s) => s.runtime);
  const result = useStore(bossStore, (s) => s.result);
  const lastSkill = useStore(bossStore, (s) => s.lastSkillId);
  const warnings = useMemo(() => validateBossCatalog(), []);
  const [hp, setHp] = useState(0);
  const defs = listBossDefinitions();

  if (!isDevMode()) return null;

  const elapsed = runtime ? Math.max(1, Date.now() - runtime.startedAt) / 1000 : 0;
  const dps = runtime && elapsed > 0 ? runtime.damageTaken / elapsed : 0;

  return (
    <div className="character-lab__subpanel">
      <h3>Boss Debug</h3>
      {warnings.length > 0 ? (
        <ul className="character-lab__hint">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="character-lab__hint">Catalog validator: OK · {defs.length} boss</p>
      )}
      <p className="character-lab__hint">Boss: {runtime?.bossId ?? result?.bossId ?? '—'}</p>
      <p className="character-lab__hint">Phase: {runtime?.phaseId ?? '—'}</p>
      <p className="character-lab__hint">
        HP: {runtime ? `${runtime.currentHp} / ${runtime.hpMax}` : '—'}
      </p>
      <p className="character-lab__hint">
        Time: {runtime?.remainingTimeMs != null ? `${Math.ceil(runtime.remainingTimeMs / 1000)}s` : '—'}
        {runtime?.timerFrozen ? ' (frozen)' : ''}
      </p>
      <p className="character-lab__hint">
        Damage: {runtime?.damageTaken ?? result?.damageDealt ?? 0} · DPS DEV: {dps.toFixed(1)}
      </p>
      <p className="character-lab__hint">Current Skill: {lastSkill ?? runtime?.currentSkillId ?? '—'}</p>
      <p className="character-lab__hint">Status: {runtime?.status ?? result?.victory ? 'result' : 'idle'}</p>
      <label>
        HP
        <input type="number" value={hp} onChange={(e) => setHp(Number(e.target.value))} />
      </label>
      <div className="character-lab__row">
        <button type="button" onClick={() => bossStore.devSetHp(hp)}>
          Set Boss HP
        </button>
        <button type="button" onClick={() => bossStore.devSetPhase('phase-1')}>
          Set Phase 1
        </button>
        <button type="button" onClick={() => bossStore.devSetPhase('phase-2')}>
          Set Phase 2
        </button>
        <button type="button" onClick={() => bossStore.devFreezeTimer(true)}>
          Freeze Timer
        </button>
        <button type="button" onClick={() => bossStore.devFreezeTimer(false)}>
          Unfreeze
        </button>
        <button type="button" onClick={() => bossStore.devResetTimer()}>
          Reset Timer
        </button>
        <button type="button" onClick={() => bossStore.devForceVictory(false)}>
          Force Victory (UI)
        </button>
        <button type="button" onClick={() => bossStore.devForceVictory(true)}>
          Apply Reward
        </button>
        <button type="button" onClick={() => bossStore.devForceDefeat()}>
          Force Defeat
        </button>
        <button type="button" onClick={() => bossStore.devResetAttempts()}>
          Reset Attempts
        </button>
      </div>
    </div>
  );
}
