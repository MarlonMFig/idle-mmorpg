'use client';

import { useMemo, useState } from 'react';
import { isDevMode } from '@/config/devConfig';
import { listAchievementDefinitions } from '@/data/achievements/achievement-registry';
import { listTitleDefinitions } from '@/data/achievements/title-registry';
import { validateAchievementCatalog } from '@/lib/achievement-validation';
import { useStore } from '@/hooks/use-store';
import { achievementsStore } from '@/stores/achievements-store';

/**
 * DEV Lab — Achievements Debug.
 * Reset de Achievement NÃO remove Level/Collection/Mastery/etc.
 * Nova evaluate pode desbloquear de novo se a condição continuar verdadeira.
 */
export function CharacterLabAchievementsDebug() {
  const unlocked = useStore(achievementsStore, (s) => s.unlocked);
  const claimed = useStore(achievementsStore, (s) => s.claimed);
  const unlockedTitles = useStore(achievementsStore, (s) => s.unlockedTitles);
  const equippedTitleId = useStore(achievementsStore, (s) => s.equippedTitleId);
  const [selectedId, setSelectedId] = useState(listAchievementDefinitions()[0]?.id ?? '');
  const [titleId, setTitleId] = useState(listTitleDefinitions()[0]?.id ?? '');

  const warnings = useMemo(() => validateAchievementCatalog(), []);
  const defs = useMemo(() => listAchievementDefinitions(), []);
  const titles = useMemo(() => listTitleDefinitions(), []);
  const selected = defs.find((d) => d.id === selectedId) ?? null;
  const progress = selected ? achievementsStore.getProgress(selected.id) : null;

  if (!isDevMode()) return null;

  return (
    <div className="character-lab__subpanel">
      <h3>Achievements Debug</h3>
      <p className="character-lab__hint">
        Reset Achievement só limpa unlocked/claimed. Se a condição ainda for verdadeira, evaluate
        pode desbloquear novamente.
      </p>
      {warnings.length > 0 ? (
        <ul className="character-lab__hint">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="character-lab__hint">Catalog validator: OK</p>
      )}

      <label>
        Achievement
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {defs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id}
            </option>
          ))}
        </select>
      </label>

      {selected && progress ? (
        <div className="character-lab__hint">
          <p>Condition: {selected.condition.type}</p>
          <p>
            Current / Required: {progress.current} / {progress.required}
          </p>
          <p>Unlocked: {unlocked[selected.id] ? 'yes' : 'no'}</p>
          <p>Claimed: {claimed[selected.id] ? 'yes' : 'no'}</p>
        </div>
      ) : null}

      <div className="character-lab__actions">
        <button type="button" onClick={() => achievementsStore.devUnlock(selectedId)}>
          Unlock Achievement
        </button>
        <button type="button" onClick={() => achievementsStore.devResetAchievement(selectedId)}>
          Reset Achievement
        </button>
        <button type="button" onClick={() => achievementsStore.claim(selectedId)}>
          Claim Achievement
        </button>
        <button type="button" onClick={() => achievementsStore.evaluateAllRetroactive()}>
          Evaluate All
        </button>
      </div>

      <label>
        Title
        <select value={titleId} onChange={(e) => setTitleId(e.target.value)}>
          {titles.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id}
            </option>
          ))}
        </select>
      </label>
      <p className="character-lab__hint">
        Equipped: {equippedTitleId ?? 'null'} · Unlocked titles:{' '}
        {Object.keys(unlockedTitles).length}
      </p>
      <div className="character-lab__actions">
        <button type="button" onClick={() => achievementsStore.devUnlockTitle(titleId)}>
          Unlock Title
        </button>
        <button type="button" onClick={() => achievementsStore.equipTitle(titleId)}>
          Equip Title
        </button>
        <button type="button" onClick={() => achievementsStore.unequipTitle()}>
          Unequip Title
        </button>
      </div>
    </div>
  );
}
