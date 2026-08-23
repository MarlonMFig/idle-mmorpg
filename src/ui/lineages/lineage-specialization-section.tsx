'use client';

import { useMemo, useState } from 'react';
import { LINEAGE_SPECIALIZATION_UNLOCK_RANK } from '@/constants/lineage-rank-requirements';
import {
  addLineageModifiers,
  formatSpecializationModifierLines,
} from '@/constants/lineage-specialization';
import { evaluateLineageSpecializationRequirements } from '@/lib/lineage-specialization-evaluation';
import {
  evolveLineageSpecialization,
  selectLineageSpecialization,
} from '@/lib/lineage-specialization';
import type { LineageDefinition, LineageIdProgress, LineageSpecializationSlot } from '@/types/lineage';
import type { SealedCharacter } from '@/types/team';

const ROMAN = ['I', 'II', 'III', 'IV'] as const;

function romanGlyph(zeroBased: number): (typeof ROMAN)[number] {
  const idx = Math.max(0, Math.min(3, Math.floor(zeroBased))) as 0 | 1 | 2 | 3;
  return ROMAN[idx];
}

const ROLE_LABEL: Record<string, string> = {
  offensive: 'Ofensivo',
  defensive: 'Defensivo',
  utility: 'Utilidade',
  mixed: 'Misto',
};

export function LineageSpecializationSection({
  definition,
  idProgress,
  collection,
}: {
  definition: LineageDefinition;
  idProgress: LineageIdProgress;
  collection: readonly SealedCharacter[];
}) {
  const [pendingSlot, setPendingSlot] = useState<LineageSpecializationSlot | null>(null);
  const [confirmEvolve, setConfirmEvolve] = useState(false);

  const rank = idProgress.rank;
  const unlocked = rank >= LINEAGE_SPECIALIZATION_UNLOCK_RANK;
  const selectedId = idProgress.selectedSpecializationId;
  const selected = selectedId
    ? definition.specializations.find((row) => row.id === selectedId) ?? null
    : null;
  const selectedLevel = selectedId
    ? idProgress.specializationProgress[selectedId].level
    : 0;

  const evaluation = useMemo(() => {
    if (!selectedId) return null;
    return evaluateLineageSpecializationRequirements({
      lineageId: definition.id,
      progress: { lineageId: definition.id, byLineage: { [definition.id]: idProgress } },
      collection,
    });
  }, [selectedId, definition.id, idProgress, collection]);

  const pendingSpec = pendingSlot
    ? definition.specializations.find((row) => row.id === pendingSlot)
    : null;

  return (
    <div className="clan-mgr__bonus clan-mgr__spec">
      <p className="clan-mgr__bonus-title">ESPECIALIZAÇÃO</p>

      {!unlocked ? (
        <>
          <p className="clan-mgr__status clan-mgr__status--locked">Bloqueada</p>
          <p className="clan-mgr__bonus-text">
            Alcance a segunda Graduação para desbloquear.
          </p>
        </>
      ) : !selected ? (
        <>
          <p className="clan-mgr__promotion-ready">ESPECIALIZAÇÃO DISPONÍVEL</p>
          <p className="clan-mgr__graduation-current">ESCOLHA SUA ESPECIALIZAÇÃO</p>
          <div className="clan-mgr__spec-cards">
            {definition.specializations.map((spec) => (
              <article key={spec.id} className="clan-mgr__spec-card">
                <h4>{spec.name.toUpperCase()}</h4>
                <p className="clan-mgr__spec-focus">Foco: {spec.focus ?? spec.description}</p>
                <p className="clan-mgr__bonus-text">
                  Estilo: {ROLE_LABEL[spec.role ?? ''] ?? spec.role ?? '—'}
                </p>
                <ul className="clan-mgr__spec-levels">
                  {spec.levels.map((level) => (
                    <li key={level.level}>
                      <strong>Nível {ROMAN[level.level - 1]}:</strong>{' '}
                      {formatSpecializationModifierLines(level.modifiers ?? {}).join(' · ') || '—'}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="clan-mgr__join"
                  style={{ ['--clan' as string]: definition.color }}
                  onClick={() => setPendingSlot(spec.id)}
                >
                  SELECIONAR
                </button>
              </article>
            ))}
          </div>
          {pendingSpec ? (
            <div className="clan-mgr__promotion-confirm">
              <p>CONFIRMAR ESPECIALIZAÇÃO?</p>
              <p className="clan-mgr__bonus-text">
                Você poderá desenvolver apenas este caminho enquanto ele estiver ativo.
              </p>
              <div className="clan-mgr__promotion-actions">
                <button
                  type="button"
                  className="clan-mgr__join"
                  onClick={() => {
                    selectLineageSpecialization(pendingSpec.id, definition.id);
                    setPendingSlot(null);
                  }}
                >
                  CONFIRMAR
                </button>
                <button
                  type="button"
                  className="clan-mgr__promotion-cancel"
                  onClick={() => setPendingSlot(null)}
                >
                  CANCELAR
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="clan-mgr__graduation-current">
            <strong>{selected.name.toUpperCase()}</strong>
          </p>
          {selectedLevel >= 4 ? (
            <p className="clan-mgr__status clan-mgr__status--ok">
              NÍVEL IV · MAX
            </p>
          ) : (
            <>
              <p className="clan-mgr__graduation-next">
                Nível: {romanGlyph(Math.max(0, selectedLevel - 1))} / IV
              </p>
              <p className="clan-mgr__graduation-next">
                Próximo nível: {romanGlyph(selectedLevel)}
              </p>
            </>
          )}
          <ul className="clan-mgr__spec-levels">
            {selected.levels.map((level) => {
              const unlockedLevel = level.level <= selectedLevel;
              return (
                <li key={level.level} className={unlockedLevel ? 'is-done' : undefined}>
                  <strong>Nível {romanGlyph(level.level - 1)}</strong>
                  {unlockedLevel ? ' · ativo' : ''}
                  : {formatSpecializationModifierLines(level.modifiers ?? {}).join(' · ') || '—'}
                </li>
              );
            })}
          </ul>
          {selectedLevel < 4 && evaluation ? (
            <>
              <ul className="clan-mgr__req-list">
                {evaluation.requirements.map((req) => (
                  <li key={req.type} className={req.completed ? 'is-done' : 'is-pending'}>
                    <span className="clan-mgr__req-mark">{req.completed ? '✓' : '✗'}</span>
                    <span className="clan-mgr__req-label">{req.label}</span>
                    <span className="clan-mgr__req-value">
                      {req.current} / {req.required}
                    </span>
                  </li>
                ))}
              </ul>
              {confirmEvolve ? (
                <div className="clan-mgr__promotion-confirm">
                  <p>
                    EVOLUIR {selected.name.toUpperCase()}
                    <br />
                    {romanGlyph(selectedLevel - 1)} → {romanGlyph(selectedLevel)}
                  </p>
                  <div className="clan-mgr__promotion-actions">
                    <button
                      type="button"
                      className="clan-mgr__join"
                      onClick={() => {
                        evolveLineageSpecialization(definition.id);
                        setConfirmEvolve(false);
                      }}
                    >
                      CONFIRMAR
                    </button>
                    <button
                      type="button"
                      className="clan-mgr__promotion-cancel"
                      onClick={() => setConfirmEvolve(false)}
                    >
                      CANCELAR
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="clan-mgr__join"
                  style={{ ['--clan' as string]: definition.color }}
                  disabled={!evaluation.eligible}
                  onClick={() => setConfirmEvolve(true)}
                >
                  EVOLUIR ESPECIALIZAÇÃO
                </button>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

export function previewCumulativeModifierLines(
  spec: LineageDefinition['specializations'][number],
  upTo: number,
): string[] {
  let acc = {};
  for (const level of spec.levels) {
    if (level.level > upTo) continue;
    acc = addLineageModifiers(acc, level.modifiers);
  }
  return formatSpecializationModifierLines(acc);
}
