'use client';

import { isDevMode } from '@/config/devConfig';
import { validateRankingCatalog } from '@/lib/ranking-validation';
import { getRankingProviderId } from '@/lib/ranking-provider';
import { useStore } from '@/hooks/use-store';
import { rankingStore } from '@/stores/ranking-store';
import { useMemo } from 'react';

export function CharacterLabRankingDebug() {
  const board = useStore(rankingStore, (s) => s.board);
  const lastRefreshAt = useStore(rankingStore, (s) => s.lastRefreshAt);
  const queryMs = useStore(rankingStore, (s) => s.queryMs);
  const mockCount = useStore(rankingStore, (s) => s.mockCount);
  const forceFail = useStore(rankingStore, (s) => s.forceFail);
  const categoryId = useStore(rankingStore, (s) => s.categoryId);
  const warnings = useMemo(() => validateRankingCatalog(), []);

  if (!isDevMode()) return null;

  return (
    <div className="character-lab__subpanel">
      <h3>Ranking Debug</h3>
      <p className="character-lab__hint">Provider: {getRankingProviderId()}</p>
      <p className="character-lab__hint">
        Last Refresh: {lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString('pt-BR') : '—'}
      </p>
      <p className="character-lab__hint">Entry Count: {board?.totalEntries ?? 0}</p>
      <p className="character-lab__hint">Player Rank: {board?.myRank ?? '—'}</p>
      <p className="character-lab__hint">Query Time: {queryMs}ms · Tab: {categoryId}</p>
      <p className="character-lab__hint">Mocks: {mockCount} · ForceFail: {forceFail ? 'YES' : 'NO'}</p>
      {warnings.length > 0 ? (
        <ul className="character-lab__hint">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="character-lab__hint">Catalog validator: OK</p>
      )}
      <div className="character-lab__row">
        <button type="button" onClick={() => void rankingStore.devSeedMocks(100)}>
          Seed 100 mocks
        </button>
        <button type="button" onClick={() => void rankingStore.devSeedMocks(500)}>
          Seed 500 mocks
        </button>
        <button type="button" onClick={() => void rankingStore.devClearMocks()}>
          Clear mocks
        </button>
        <button type="button" onClick={() => void rankingStore.devSetMyApproxRank(1)}>
          My rank ~#1
        </button>
        <button type="button" onClick={() => void rankingStore.devSetMyApproxRank(50)}>
          My rank ~#50
        </button>
        <button type="button" onClick={() => void rankingStore.devSetMyApproxRank(347)}>
          My rank ~#347
        </button>
        <button type="button" onClick={() => void rankingStore.devForceFail(!forceFail)}>
          Toggle force fail
        </button>
        <button type="button" onClick={() => void rankingStore.refresh({ force: true })}>
          Refresh
        </button>
      </div>
    </div>
  );
}
