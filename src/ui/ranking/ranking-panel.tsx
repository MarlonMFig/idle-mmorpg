'use client';

import { useEffect } from 'react';
import { LINEAGE_LABELS } from '@/constants/lineage';
import { LINEAGE_IDS, type LineageId } from '@/types/character-meta';
import { listBossDefinitions } from '@/data/bosses/boss-registry';
import { listRankingCategories } from '@/data/ranking/ranking-categories';
import { getTitleDefinition } from '@/data/achievements/title-registry';
import { getRankingCategory } from '@/data/ranking/ranking-categories';
import { useStore } from '@/hooks/use-store';
import { rankingStore } from '@/stores/ranking-store';
import type { RankingCategoryId, RankingEntry } from '@/types/ranking';
import { MgrWindow } from '@/ui/mgr';

function formatValue(entry: RankingEntry, categoryId: RankingCategoryId): string {
  const cat = getRankingCategory(categoryId);
  const formatter = cat?.formatter ?? 'number';
  if (formatter === 'level') return `Lv${entry.value}`;
  if (formatter === 'bossTime') {
    const ms = entry.metadata.bossTimeMs ?? entry.value;
    const s = Math.max(0, Math.floor(Number(ms) / 1000));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
  if (formatter === 'bossDamage') {
    return `${(entry.metadata.bossDamage ?? entry.value).toLocaleString('pt-BR')} dmg`;
  }
  if (formatter === 'lineage') {
    return `Grad. ${entry.metadata.lineageRank ?? '—'} · Spec ${entry.metadata.specializationLevel ?? 0}`;
  }
  if (formatter === 'power') return `${entry.value.toLocaleString('pt-BR')} PWR`;
  if (formatter === 'mastery') return `${entry.value.toLocaleString('pt-BR')} MST`;
  if (formatter === 'collection') return `${entry.value} únicos`;
  if (formatter === 'kills') return `${entry.value.toLocaleString('pt-BR')} kills`;
  return entry.value.toLocaleString('pt-BR');
}

function EntryRow({ entry, categoryId, highlight }: { entry: RankingEntry; categoryId: RankingCategoryId; highlight?: boolean }) {
  const title = entry.titleId ? getTitleDefinition(entry.titleId) : null;
  const lineage = entry.lineageId ? LINEAGE_LABELS[entry.lineageId] : null;
  const top = entry.rank <= 3;
  return (
    <article
      className={`ranking-row${top ? ` ranking-row--top${entry.rank}` : ''}${highlight ? ' ranking-row--me' : ''}`}
    >
      <span className="ranking-row__rank">#{entry.rank}</span>
      <div className="ranking-row__identity">
        <strong>{entry.nickname}</strong>
        {title ? <span className="ranking-row__title">[{title.name}]</span> : null}
        {lineage && categoryId !== 'lineage' ? (
          <span className="ranking-row__lineage">{lineage}</span>
        ) : null}
        {categoryId === 'lineage' && lineage ? (
          <span className="ranking-row__lineage">{lineage}</span>
        ) : null}
      </div>
      <span className="ranking-row__value">{formatValue(entry, categoryId)}</span>
    </article>
  );
}

export function RankingPanel() {
  const isOpen = useStore(rankingStore, (s) => s.isOpen);
  const categoryId = useStore(rankingStore, (s) => s.categoryId);
  const lineageFilter = useStore(rankingStore, (s) => s.lineageFilter);
  const bossId = useStore(rankingStore, (s) => s.bossId);
  const loading = useStore(rankingStore, (s) => s.loading);
  const error = useStore(rankingStore, (s) => s.error);
  const board = useStore(rankingStore, (s) => s.board);
  const lastRefreshAt = useStore(rankingStore, (s) => s.lastRefreshAt);
  const cooldown = useStore(rankingStore, (s) => s.refreshCooldownUntil);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        rankingStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = listRankingCategories();
  const bosses = listBossDefinitions();
  const refreshDisabled = Date.now() < cooldown;

  return (
    <MgrWindow
      title="Ranking"
      size="lg"
      ariaLabel="Ranking"
      tabs={categories.map((cat) => ({ id: cat.id, label: cat.name }))}
      activeTab={categoryId}
      onTabChange={(id) => rankingStore.setCategory(id as RankingCategoryId)}
      onClose={() => rankingStore.setOpen(false)}
    >
      {categoryId === 'lineage' ? (
          <div className="ranking-panel__filters">
            <button
              type="button"
              className={lineageFilter === 'all' ? 'is-active' : undefined}
              onClick={() => rankingStore.setLineageFilter('all')}
            >
              Todas
            </button>
            {LINEAGE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={lineageFilter === id ? 'is-active' : undefined}
                onClick={() => rankingStore.setLineageFilter(id as LineageId)}
              >
                {LINEAGE_LABELS[id]}
              </button>
            ))}
          </div>
        ) : null}

        {categoryId === 'boss' ? (
          <div className="ranking-panel__filters">
            {bosses.map((boss) => (
              <button
                key={boss.id}
                type="button"
                className={bossId === boss.id ? 'is-active' : undefined}
                onClick={() => rankingStore.setBossId(boss.id)}
              >
                {boss.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="ranking-panel__toolbar">
          <button
            type="button"
            disabled={refreshDisabled || loading}
            onClick={() => void rankingStore.refresh({ force: true })}
          >
            Atualizar
          </button>
          {lastRefreshAt ? (
            <span className="ranking-panel__meta">
              Atualizado {new Date(lastRefreshAt).toLocaleTimeString('pt-BR')}
            </span>
          ) : null}
        </div>

        {categoryId === 'general' || categoryId === 'power' ? (
          <p className="ranking-panel__hint">
            Power = cálculo provisório (DEV). Não existe fórmula oficial de Account Power.
          </p>
        ) : null}

        {loading ? <p className="ranking-panel__hint">Carregando Ranking…</p> : null}

        {error ? (
          <div className="ranking-panel__error">
            <p>Não foi possível carregar o Ranking.</p>
            <button type="button" onClick={() => void rankingStore.refresh({ force: true })}>
              Tentar novamente
            </button>
          </div>
        ) : null}

        {!loading && !error && board?.empty ? (
          <p className="ranking-panel__hint">Nenhum jogador classificado.</p>
        ) : null}

        {!loading && !error && board && !board.empty ? (
          <div className="ranking-panel__list">
            {board.entries.map((entry) => (
              <EntryRow key={`${entry.playerId}-${entry.rank}`} entry={entry} categoryId={categoryId} />
            ))}
          </div>
        ) : null}

      {board?.myEntry ? (
        <section className="ranking-panel__mine">
          <h3>Sua posição</h3>
          <EntryRow entry={board.myEntry} categoryId={categoryId} highlight />
        </section>
      ) : null}
    </MgrWindow>
  );
}
