'use client';

import { isDevMode } from '@/config/devConfig';
import {
  getMissionDefinition,
  listDailyMissionPool,
  listMissionDefinitions,
} from '@/data/missions/mission-registry';
import { getDailyCycleId, getWeeklyCycleId } from '@/lib/mission-cycle';
import { validateMissionCatalog } from '@/lib/mission-validation';
import { useStore } from '@/hooks/use-store';
import { missionsStore } from '@/stores/missions-store';
import { useMemo, useState } from 'react';

export function CharacterLabMissionsDebug() {
  const daily = useStore(missionsStore, (s) => s.daily);
  const weekly = useStore(missionsStore, (s) => s.weekly);
  const journey = useStore(missionsStore, (s) => s.journey);
  const [selectedId, setSelectedId] = useState(listMissionDefinitions()[0]?.id ?? '');
  const [progress, setProgress] = useState(0);
  const warnings = useMemo(() => validateMissionCatalog(), []);
  const defs = useMemo(() => listMissionDefinitions(), []);
  const selected = getMissionDefinition(selectedId);

  if (!isDevMode()) return null;

  return (
    <div className="character-lab__subpanel">
      <h3>Missions Debug</h3>
      <p className="character-lab__hint">
        Daily cycle: {daily.cycleId || getDailyCycleId()} · Weekly: {weekly.cycleId || getWeeklyCycleId()}
      </p>
      <p className="character-lab__hint">Daily IDs: {daily.selectedIds.join(', ') || '—'}</p>
      <p className="character-lab__hint">Weekly IDs: {weekly.selectedIds.join(', ') || '—'}</p>
      <p className="character-lab__hint">Journey: {journey.currentId ?? '—'}</p>
      {warnings.length > 0 ? (
        <ul className="character-lab__hint">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="character-lab__hint">Catalog validator: OK · pool diário {listDailyMissionPool().length}</p>
      )}
      <label>
        Mission
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {defs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <p className="character-lab__hint">
          {selected.condition.type} · status {missionsStore.getStatus(selected.id)}
        </p>
      ) : null}
      <div className="character-lab__actions">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Regenerar Daily deste ciclo? (DEV)')) missionsStore.devRegenerateDaily();
          }}
        >
          Regenerate Daily
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Regenerar Weekly deste ciclo? (DEV)')) missionsStore.devRegenerateWeekly();
          }}
        >
          Regenerate Weekly
        </button>
        <button type="button" onClick={() => missionsStore.devComplete(selectedId)}>
          Complete Mission
        </button>
        <button type="button" onClick={() => missionsStore.devResetMission(selectedId)}>
          Reset Mission
        </button>
        <button type="button" onClick={() => missionsStore.devSetProgress(selectedId, progress)}>
          Set Progress
        </button>
        <input
          type="number"
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
        />
        <button type="button" onClick={() => missionsStore.claim(selectedId)}>
          Claim Reward
        </button>
        <button type="button" onClick={() => missionsStore.devAdvanceJourney()}>
          Advance Journey
        </button>
        <button type="button" onClick={() => missionsStore.devResetJourney()}>
          Reset Journey
        </button>
      </div>
    </div>
  );
}
