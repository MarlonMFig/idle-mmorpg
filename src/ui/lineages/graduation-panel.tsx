'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { LINEAGE_SYSTEM_UNLOCK_LEVEL, LINEAGE_LABELS } from '@/constants/lineage';
import {
  LINEAGE_RANK_MODIFIERS,
  LINEAGE_RANK_PROMOTION_TITLES,
} from '@/constants/lineage-rank-requirements';
import { formatSpecializationModifierLines } from '@/constants/lineage-specialization';
import { getLineageDefinition } from '@/data/lineages/registry';
import { getLineageCatalogEntry } from '@/data/lineages/catalog';
import { useStore } from '@/hooks/use-store';
import { getActiveLineageProgress, getLineageIdProgress } from '@/lib/lineage-progress';
import { canPromoteLineageRank, promoteLineageRank } from '@/lib/promote-lineage-rank';
import { accountStore } from '@/stores/account-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import { MgrWindow } from '@/ui/mgr';

/**
 * Menu Graduação — apenas ranks/promoções.
 * Escolha de Herança permanece no menu Herança.
 */
export function GraduationPanel() {
  const isOpen = useStore(accountStore, (s) => s.graduationOpen);
  const progress = useStore(accountStore, (s) => s.lineageProgress);
  const collection = useStore(teamStore, (s) => s.collection);
  const level = useStore(vitalsStore, (s) => s.level);
  const unlocked = level >= LINEAGE_SYSTEM_UNLOCK_LEVEL;
  const playerLineageId = progress.lineageId;

  const [confirmPromote, setConfirmPromote] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
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
        accountStore.setGraduationOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, confirmPromote]);

  const idProgress = useMemo(
    () => (playerLineageId ? getLineageIdProgress(progress, playerLineageId) : getActiveLineageProgress(progress)),
    [progress, playerLineageId],
  );

  const evaluation = useMemo(() => {
    if (!playerLineageId) return null;
    return canPromoteLineageRank(playerLineageId);
  }, [playerLineageId, progress, collection, level]);

  if (!isOpen) return null;

  const catalog = playerLineageId ? getLineageCatalogEntry(playerLineageId) : null;
  const definition = playerLineageId ? getLineageDefinition(playerLineageId) : null;
  const currentRankDef =
    definition?.ranks.find((row) => row.rank === idProgress.rank) ?? null;
  const nextRankDef =
    definition && idProgress.rank > 0 && idProgress.rank < 4
      ? definition.ranks.find((row) => row.rank === idProgress.rank + 1) ?? null
      : null;
  const promotionTitle =
    playerLineageId &&
    evaluation?.targetRank &&
    LINEAGE_RANK_PROMOTION_TITLES[playerLineageId]?.[evaluation.targetRank];
  const rankMods =
    idProgress.rank >= 1 && idProgress.rank <= 4
      ? LINEAGE_RANK_MODIFIERS[idProgress.rank as 1 | 2 | 3 | 4]
      : null;
  const accent = catalog?.color ?? definition?.color ?? '#e8b84a';

  const handlePromote = () => {
    if (!playerLineageId) return;
    const result = promoteLineageRank(playerLineageId);
    if (!result.ok) return;
    const def = getLineageDefinition(playerLineageId);
    const fromName = def?.ranks.find((row) => row.rank === result.oldRank)?.name ?? '?';
    const toName = def?.ranks.find((row) => row.rank === result.newRank)?.name ?? '?';
    setPromoteSuccess({ from: fromName, to: toName });
    setConfirmPromote(false);
  };

  return (
    <MgrWindow
      title="Graduação"
      lede="Avance sua graduação"
      pill={playerLineageId ? LINEAGE_LABELS[playerLineageId] : `Nv. ${level}`}
      icon="🎓"
      size="lg"
      ariaLabel="Graduação"
      onClose={() => accountStore.setGraduationOpen(false)}
      bodyClassName="clan-mgr__body clan-mgr__body--single"
    >
      <section className="clan-mgr__detail" aria-label="Graduação da conta">
        {!unlocked ? (
          <p className="clan-mgr__status clan-mgr__status--locked">
            Graduação libera no nível {LINEAGE_SYSTEM_UNLOCK_LEVEL} (atual: {level}).
          </p>
        ) : !playerLineageId ? (
          <p className="clan-mgr__status clan-mgr__status--pick">
            Escolha uma Herança no menu Herança para liberar a Graduação.
          </p>
        ) : definition && catalog ? (
          <>
            <div className="clan-mgr__hero" style={{ ['--clan' as string]: accent }}>
              <span className="clan-mgr__hero-icon" aria-hidden>
                <Image src={catalog.iconSrc} alt="" width={96} height={96} unoptimized priority />
              </span>
              <div className="clan-mgr__hero-text">
                <h3 className="clan-mgr__hero-name" style={{ color: accent }}>
                  {definition.name}
                </h3>
                <p className="clan-mgr__graduation-current">
                  Graduação atual:{' '}
                  <strong>{currentRankDef?.name.toUpperCase() ?? `Rank ${idProgress.rank}`}</strong>
                </p>
              </div>
            </div>

            {rankMods ? (
              <div className="clan-mgr__bonus">
                <p className="clan-mgr__bonus-title">Bônus da graduação</p>
                <p className="clan-mgr__bonus-text">
                  {formatSpecializationModifierLines(rankMods).join(' · ') || '—'}
                </p>
                <p className="clan-mgr__bonus-text">
                  Aplica-se a personagens compatíveis com a sua Herança.
                </p>
              </div>
            ) : null}

            <div className="clan-mgr__bonus clan-mgr__graduation">
              <p className="clan-mgr__bonus-title">Progresso</p>
              {idProgress.rank >= 4 ? (
                <p className="clan-mgr__status clan-mgr__status--ok">GRADUAÇÃO MÁXIMA</p>
              ) : nextRankDef ? (
                <>
                  <p className="clan-mgr__graduation-next">
                    Próxima Graduação: <strong>{nextRankDef.name.toUpperCase()}</strong>
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
                      <p>PROMOVER PARA {nextRankDef.name.toUpperCase()}?</p>
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
                      style={{ ['--clan' as string]: accent }}
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

            <div className="clan-mgr__bonus">
              <p className="clan-mgr__bonus-title">Trilha de graduação</p>
              <ul className="clan-mgr__bonus-text">
                {definition.ranks.map((rank) => (
                  <li key={rank.id}>
                    {rank.name}
                    {idProgress.rank === rank.rank ? ' · atual' : ''}
                    {rank.rank <= 4
                      ? ` — ${formatSpecializationModifierLines(LINEAGE_RANK_MODIFIERS[rank.rank]).join(', ') || '—'}`
                      : ''}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="clan-mgr__status">Herança não encontrada.</p>
        )}
      </section>
    </MgrWindow>
  );
}
