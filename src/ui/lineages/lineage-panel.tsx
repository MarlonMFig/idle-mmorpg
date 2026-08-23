'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { LINEAGE_SYSTEM_UNLOCK_LEVEL, LINEAGE_LABELS } from '@/constants/lineage';
import { LINEAGE_RANK_PROMOTION_TITLES } from '@/constants/lineage-rank-requirements';
import { getLineageDefinition } from '@/data/lineages/registry';
import { LINEAGE_CATALOG, getLineageCatalogEntry } from '@/data/lineages/catalog';
import { useStore } from '@/hooks/use-store';
import { getLineageIdProgress } from '@/lib/lineage-progress';
import { canPromoteLineageRank, promoteLineageRank } from '@/lib/promote-lineage-rank';
import { accountStore } from '@/stores/account-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import { LineageSpecializationSection } from '@/ui/lineages/lineage-specialization-section';
import { MgrWindow } from '@/ui/mgr';
import type { LineageId } from '@/types/character-meta';

/**
 * Menu Linhagem — lista + detalhe (abre pelo ícone Linhagem do hub).
 */
export function LineagePanel() {
  const isOpen = useStore(accountStore, (s) => s.isOpen);
  const progress = useStore(accountStore, (s) => s.lineageProgress);
  const collection = useStore(teamStore, (s) => s.collection);
  const level = useStore(vitalsStore, (s) => s.level);
  const unlocked = level >= LINEAGE_SYSTEM_UNLOCK_LEVEL;
  const playerLineageId = progress.lineageId;

  const [selectedId, setSelectedId] = useState<LineageId>(
    playerLineageId ?? LINEAGE_CATALOG[0].id,
  );
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (playerLineageId) setSelectedId(playerLineageId);
    setConfirmPromote(false);
    setPromoteSuccess(null);
  }, [isOpen, playerLineageId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        if (confirmPromote) {
          setConfirmPromote(false);
          return;
        }
        accountStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, confirmPromote]);

  const selectedProgress = useMemo(
    () => getLineageIdProgress(progress, selectedId),
    [progress, selectedId],
  );

  const evaluation = useMemo(() => {
    if (!playerLineageId || playerLineageId !== selectedId) return null;
    return canPromoteLineageRank(selectedId);
  }, [playerLineageId, selectedId, progress, collection, level]);

  if (!isOpen) return null;

  const selected = getLineageCatalogEntry(selectedId);
  const definition = getLineageDefinition(selectedId);
  const isMember = playerLineageId === selected.id;
  const canChoose = unlocked && playerLineageId == null;
  const currentRankDef =
    definition?.ranks.find((row) => row.rank === selectedProgress.rank) ?? null;
  const nextRankDef =
    definition && selectedProgress.rank < 4
      ? definition.ranks.find((row) => row.rank === selectedProgress.rank + 1) ?? null
      : null;
  const promotionTitle =
    evaluation?.targetRank && LINEAGE_RANK_PROMOTION_TITLES[selectedId]?.[evaluation.targetRank];

  const handlePromote = () => {
    const result = promoteLineageRank(selectedId);
    if (!result.ok) return;
    const def = getLineageDefinition(selectedId);
    const fromName = def?.ranks.find((row) => row.rank === result.oldRank)?.name ?? '?';
    const toName = def?.ranks.find((row) => row.rank === result.newRank)?.name ?? '?';
    setPromoteSuccess({ from: fromName, to: toName });
    setConfirmPromote(false);
  };

  return (
    <MgrWindow
      title="Linhagem"
      lede="Escolha e avance a linhagem da sua conta"
      pill={`Nv. ${level}`}
      icon="🛡"
      size="lg"
      ariaLabel="Linhagem"
      onClose={() => accountStore.setOpen(false)}
      bodyClassName="clan-mgr__body"
    >
          <aside className="clan-mgr__list-pane" aria-label="Lista de Linhagens">
            <ul className="clan-mgr__list">
              {LINEAGE_CATALOG.map((lineage) => {
                const isSel = lineage.id === selectedId;
                const mine = lineage.id === playerLineageId;
                return (
                  <li key={lineage.id}>
                    <button
                      type="button"
                      className={`clan-mgr__list-item${isSel ? ' is-selected' : ''}${mine ? ' is-member' : ''}`}
                      style={{ ['--clan' as string]: lineage.color }}
                      onClick={() => setSelectedId(lineage.id)}
                    >
                      <span className="clan-mgr__list-icon" aria-hidden>
                        <Image
                          src={lineage.iconSrc}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                        />
                      </span>
                      <span className="clan-mgr__list-name">{lineage.name}</span>
                      {mine ? <span className="clan-mgr__member-tag">VOCÊ</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="clan-mgr__detail" aria-label={`Detalhe ${selected.name}`}>
            <div
              className="clan-mgr__hero"
              style={{ ['--clan' as string]: selected.color }}
            >
              <span className="clan-mgr__hero-icon" aria-hidden>
                <Image
                  src={selected.iconSrc}
                  alt=""
                  width={96}
                  height={96}
                  unoptimized
                  priority
                />
              </span>
              <div className="clan-mgr__hero-text">
                <h3 className="clan-mgr__hero-name" style={{ color: selected.color }}>
                  {selected.name}
                </h3>
                <div className="clan-mgr__tags">
                  {selected.tags.map((tag) => (
                    <span
                      key={tag}
                      className="clan-mgr__tag"
                      style={{
                        borderColor: selected.color,
                        color: selected.color,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {playerLineageId ? (
              <p className="clan-mgr__status clan-mgr__status--ok">
                LINHAGEM ATUAL: {LINEAGE_LABELS[playerLineageId]}
              </p>
            ) : null}

            {!unlocked ? (
              <p className="clan-mgr__status clan-mgr__status--locked">
                Linhagem libera no nível {LINEAGE_SYSTEM_UNLOCK_LEVEL} (atual: {level}).
              </p>
            ) : isMember ? (
              <p className="clan-mgr__status clan-mgr__status--ok">
                Você segue a Linhagem {LINEAGE_LABELS[selected.id]}. Troca ainda não disponível.
              </p>
            ) : playerLineageId ? (
              <p className="clan-mgr__status">
                Você já segue a Linhagem {LINEAGE_LABELS[playerLineageId]}.
              </p>
            ) : (
              <p className="clan-mgr__status clan-mgr__status--pick">
                Escolha esta Linhagem. A decisão é única por enquanto.
              </p>
            )}

            {isMember && definition && selectedProgress.rank > 0 ? (
              <div className="clan-mgr__bonus clan-mgr__graduation">
                <p className="clan-mgr__bonus-title">LINHAGEM {definition.name.toUpperCase()}</p>
                <p className="clan-mgr__graduation-current">
                  Graduação Atual:{' '}
                  <strong>{currentRankDef?.name.toUpperCase() ?? selectedProgress.rank}</strong>
                </p>
                {selectedProgress.rank >= 4 ? (
                  <p className="clan-mgr__status clan-mgr__status--ok">GRADUAÇÃO MÁXIMA</p>
                ) : nextRankDef ? (
                  <>
                    <p className="clan-mgr__graduation-next">
                      Próxima Graduação:{' '}
                      <strong>{nextRankDef.name.toUpperCase()}</strong>
                    </p>
                    {promotionTitle ? (
                      <p className="clan-mgr__promotion-title">{promotionTitle}</p>
                    ) : null}
                    {evaluation ? (
                      <ul className="clan-mgr__req-list">
                        {evaluation.requirements.map((req) => (
                          <li
                            key={req.type}
                            className={req.completed ? 'is-done' : 'is-pending'}
                          >
                            <span className="clan-mgr__req-mark">{req.completed ? '✓' : '✗'}</span>
                            <span className="clan-mgr__req-label">{req.label}</span>
                            <span className="clan-mgr__req-value">
                              {req.current} / {req.required}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {evaluation?.eligible ? (
                      <p className="clan-mgr__promotion-ready">PROMOÇÃO DISPONÍVEL</p>
                    ) : null}
                    {promoteSuccess ? (
                      <div className="clan-mgr__promotion-success">
                        <p>PROMOÇÃO CONCLUÍDA</p>
                        <p>
                          {promoteSuccess.from} → {promoteSuccess.to}
                        </p>
                      </div>
                    ) : confirmPromote ? (
                      <div className="clan-mgr__promotion-confirm">
                        <p>
                          PROMOVER PARA {nextRankDef.name.toUpperCase()}?
                        </p>
                        <div className="clan-mgr__promotion-actions">
                          <button type="button" className="clan-mgr__join" onClick={handlePromote}>
                            CONFIRMAR
                          </button>
                          <button
                            type="button"
                            className="clan-mgr__promotion-cancel"
                            onClick={() => setConfirmPromote(false)}
                          >
                            CANCELAR
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="clan-mgr__join"
                        style={{ ['--clan' as string]: selected.color }}
                        disabled={!evaluation?.eligible}
                        onClick={() => {
                          setPromoteSuccess(null);
                          setConfirmPromote(true);
                        }}
                      >
                        PROMOVER
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            ) : null}

            {isMember && definition ? (
              <LineageSpecializationSection
                definition={definition}
                idProgress={selectedProgress}
                collection={collection}
              />
            ) : null}

            <p className="clan-mgr__blurb">{selected.blurb}</p>

            {definition ? (
              <>
                <div className="clan-mgr__bonus">
                  <p className="clan-mgr__bonus-title">Graduação</p>
                  <ul className="clan-mgr__bonus-text">
                    {definition.ranks.map((rank) => (
                      <li key={rank.id}>
                        {rank.name}
                        {progress.lineageId === selected.id &&
                        selectedProgress.rank === rank.rank
                          ? ' · atual'
                          : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="clan-mgr__bonus">
                  <p className="clan-mgr__bonus-title">Especialização</p>
                  <ul className="clan-mgr__bonus-text">
                    {definition.specializations.map((spec) => (
                      <li key={spec.id}>
                        {spec.name}
                        {progress.lineageId === selected.id &&
                        selectedProgress.selectedSpecializationId === spec.id
                          ? ' · ativa'
                          : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : null}

            <div className="clan-mgr__bonus">
              <p className="clan-mgr__bonus-title">Benefícios</p>
              <p className="clan-mgr__bonus-text">
                Em desenvolvimento — a estrutura de Linhagem está pronta; poderes e bônus chegam em
                atualização futura.
              </p>
            </div>

            {canChoose ? (
              <button
                type="button"
                className="clan-mgr__join"
                style={{ ['--clan' as string]: selected.color }}
                onClick={() => accountStore.chooseLineage(selected.id)}
              >
                Escolher Linhagem {selected.name}
              </button>
            ) : null}
          </section>
    </MgrWindow>
  );
}

/** @deprecated use LineagePanel */
export const ClanPanel = LineagePanel;
