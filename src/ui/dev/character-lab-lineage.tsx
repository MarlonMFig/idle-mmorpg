'use client';

import { useState } from 'react';
import { isDevMode } from '@/config/devConfig';
import { LINEAGE_LABELS, LINEAGE_SPECIALIZATION_SLOT_LABELS } from '@/constants/lineage';
import { LINEAGE_IDS } from '@/types/character-meta';
import { getCharacterDefinition } from '@/data/characters';
import { getLineageDefinition } from '@/data/lineages/registry';
import { useStore } from '@/hooks/use-store';
import { isCharacterCompatibleWithLineage } from '@/lib/lineage-compatibility';
import { getInstanceLineageId } from '@/lib/lineage-compatibility';
import { formatSpecializationModifierLines } from '@/constants/lineage-specialization';
import { getLineageIdProgress, rankNameFor } from '@/lib/lineage-progress';
import { getActiveLineageSpecializationModifiers } from '@/lib/lineage-specialization-modifiers';
import { validateLineageRegistry } from '@/lib/lineage-validation';
import { resolveLineageRuntime } from '@/lib/lineage-runtime';
import { accountStore } from '@/stores/account-store';
import { attributesStore } from '@/stores/attributes-store';
import { characterLabStore } from '@/stores/character-lab-store';
import { teamStore } from '@/stores/team-store';
import type { LineageId } from '@/types/character-meta';
import type { LineageSpecializationSlot } from '@/types/lineage';

const RANKS = [0, 1, 2, 3, 4] as const;
const SPEC_LEVELS = [0, 1, 2, 3, 4] as const;
const SPECS: Array<LineageSpecializationSlot | null> = [
  null,
  'specializationA',
  'specializationB',
  'specializationC',
];

export function CharacterLabLineageDebug() {
  const playerId = useStore(characterLabStore, (s) => s.playerId);
  const previewLineageId = useStore(characterLabStore, (s) => s.previewLineageId);
  const previewRank = useStore(characterLabStore, (s) => s.previewLineageRank);
  const previewSpec = useStore(characterLabStore, (s) => s.previewSpecializationId);
  const previewSpecLevel = useStore(characterLabStore, (s) => s.previewSpecializationLevel);
  const savedProgress = useStore(accountStore, (s) => s.lineageProgress);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const collection = useStore(teamStore, (s) => s.collection);
  const instance = collection.find((entry) => entry.id === activeId) ?? null;
  const attrs = useStore(attributesStore, (s) => s);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [specResetConfirm, setSpecResetConfirm] = useState(false);

  if (!isDevMode()) return null;

  const runtime = resolveLineageRuntime();
  const charDef = playerId ? getCharacterDefinition(playerId) : null;
  const charLineage = charDef?.lineageId ?? (playerId ? null : null);
  const playerLineage = runtime.active.lineageId;
  const compatible =
    charDef && playerLineage
      ? isCharacterCompatibleWithLineage(charDef, playerLineage)
      : instance && playerLineage
        ? isCharacterCompatibleWithLineage(instance, playerLineage)
        : false;
  const validation = validateLineageRegistry();
  const activeIdProgress = playerLineage
    ? getLineageIdProgress(savedProgress, playerLineage)
    : null;
  const rankDef = playerLineage ? getLineageDefinition(playerLineage) : null;
  const rankName =
    rankDef && activeIdProgress
      ? rankNameFor(rankDef.ranks, activeIdProgress.rank)
      : String(activeIdProgress?.rank ?? 0);
  const refreshStats = () => {
    attributesStore.recalculate(false);
  };

  return (
    <section className="character-lab__section">
      <h4>LINEAGE</h4>
      <p>
        <strong>PLAYER LINEAGE</strong>{' '}
        {playerLineage ? LINEAGE_LABELS[playerLineage] : 'None'}
        {runtime.preview ? ' · PREVIEW' : ' · SAVE'}
      </p>
      <p>
        <strong>RANK</strong> {runtime.active.rank} / 4
      </p>
      <p>
        <strong>SPECIALIZATION</strong>{' '}
        {runtime.active.selectedSpecializationId && rankDef
          ? rankDef.specializations.find(
              (row) => row.id === runtime.active.selectedSpecializationId,
            )?.name ?? LINEAGE_SPECIALIZATION_SLOT_LABELS[runtime.active.selectedSpecializationId]
          : 'None'}{' '}
        · Lv {runtime.active.specializationLevel}
      </p>
      <p>
        <strong>CHARACTER LINEAGE</strong>{' '}
        {charLineage
          ? LINEAGE_LABELS[charLineage]
          : instance
            ? LINEAGE_LABELS[getInstanceLineageId(instance)]
            : '—'}
      </p>
      <p>
        <strong>COMPATIBLE</strong> {compatible ? 'YES' : playerLineage ? 'NO' : '—'}
      </p>
      <p className="character-lab__hint">
        Save: {savedProgress.lineageId ? LINEAGE_LABELS[savedProgress.lineageId] : 'none'} · rank{' '}
        {activeIdProgress?.rank ?? 0}
      </p>
      {validation.length > 0 ? (
        <p className="character-lab__hint">Validação: {validation.join(' · ')}</p>
      ) : (
        <p className="character-lab__hint">Validação: ok</p>
      )}

      <h4>LINEAGE RANK DEBUG</h4>
      <p>
        <strong>Lineage:</strong>{' '}
        {playerLineage ? LINEAGE_LABELS[playerLineage] : 'None'}
      </p>
      <p>
        <strong>Current Rank:</strong> {rankName}
      </p>
      <p>
        <strong>Online Kills:</strong> {activeIdProgress?.onlineKills ?? 0}
      </p>
      <div className="character-lab__chips">
        <button type="button" onClick={() => accountStore.devAddOnlineKills(100)}>
          +100 Online Kills
        </button>
        <button type="button" onClick={() => accountStore.devAddOnlineKills(1000)}>
          +1000 Online Kills
        </button>
      </div>
      <h4>Set Rank</h4>
      <div className="character-lab__chips">
        {RANKS.map((rank) => (
          <button
            key={rank}
            type="button"
            className={activeIdProgress?.rank === rank ? 'is-active' : undefined}
            onClick={() => accountStore.devSetRank(rank)}
          >
            {rank === 0 ? '0' : rank}
          </button>
        ))}
      </div>
      <h4>DEV Lineage Switch</h4>
      <div className="character-lab__chips">
        {LINEAGE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={savedProgress.lineageId === id ? 'is-active' : undefined}
            onClick={() => accountStore.devSetActiveLineage(id)}
          >
            {LINEAGE_LABELS[id]}
          </button>
        ))}
      </div>
      {!resetConfirm ? (
        <button type="button" onClick={() => setResetConfirm(true)}>
          Reset Rank Progress
        </button>
      ) : (
        <div className="character-lab__chips">
          <button
            type="button"
            onClick={() => {
              accountStore.devResetLineageRankProgress();
              setResetConfirm(false);
            }}
          >
            Confirm Reset
          </button>
          <button type="button" onClick={() => setResetConfirm(false)}>
            Cancel
          </button>
        </div>
      )}

      <h4>LINEAGE SPECIALIZATION DEBUG</h4>
      <p>
        <strong>Lineage:</strong>{' '}
        {playerLineage ? LINEAGE_LABELS[playerLineage] : 'None'}
      </p>
      <p>
        <strong>Rank:</strong> {rankName}
      </p>
      <p>
        <strong>Selected:</strong>{' '}
        {runtime.active.selectedSpecializationId && rankDef
          ? rankDef.specializations.find((row) => row.id === runtime.active.selectedSpecializationId)
              ?.name ?? runtime.active.selectedSpecializationId
          : 'None'}
      </p>
      <p>
        <strong>Level:</strong> {runtime.active.specializationLevel} / 4
      </p>
      <p>
        <strong>Online Kills:</strong> {runtime.active.specializationOnlineKills}
      </p>
      <div className="character-lab__chips">
        {(['specializationA', 'specializationB', 'specializationC'] as const).map((slot) => {
          const label =
            rankDef?.specializations.find((row) => row.id === slot)?.name ??
            LINEAGE_SPECIALIZATION_SLOT_LABELS[slot];
          return (
          <button
            key={slot}
            type="button"
            className={runtime.active.selectedSpecializationId === slot ? 'is-active' : undefined}
            onClick={() => {
              accountStore.devSetSpecialization(
                slot,
                Math.max(1, runtime.active.specializationLevel || 1) as 1 | 2 | 3 | 4,
              );
              refreshStats();
            }}
          >
            {label}
          </button>
          );
        })}
      </div>
      <div className="character-lab__chips">
        <button
          type="button"
          onClick={() => {
            accountStore.devAddSpecializationKills(100);
            refreshStats();
          }}
        >
          +100 Kills
        </button>
        <button
          type="button"
          onClick={() => {
            accountStore.devAddSpecializationKills(1000);
            refreshStats();
          }}
        >
          +1000 Kills
        </button>
      </div>
      <div className="character-lab__chips">
        {([1, 2, 3, 4] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={runtime.active.specializationLevel === level ? 'is-active' : undefined}
            onClick={() => {
              accountStore.devSetSpecialization(
                runtime.active.selectedSpecializationId ?? 'specializationA',
                level,
              );
              refreshStats();
            }}
          >
            Set Level {['I', 'II', 'III', 'IV'][level - 1]}
          </button>
        ))}
      </div>
      {!specResetConfirm ? (
        <button type="button" onClick={() => setSpecResetConfirm(true)}>
          Reset
        </button>
      ) : (
        <div className="character-lab__chips">
          <button
            type="button"
            onClick={() => {
              accountStore.devResetSpecializationProgress();
              setSpecResetConfirm(false);
              refreshStats();
            }}
          >
            Confirm Reset
          </button>
          <button type="button" onClick={() => setSpecResetConfirm(false)}>
            Cancel
          </button>
        </div>
      )}

      <h4>STATS COMPARATOR</h4>
      <p className="character-lab__hint">BASE</p>
      <p>
        Attack: {attrs.base.strength} · HP: {attrs.base.hp} · Def: {attrs.base.defense} · Crit:{' '}
        {attrs.base.critical}
      </p>
      <p className="character-lab__hint">SPECIALIZATION MODIFIERS</p>
      <p>
        {formatSpecializationModifierLines(
          getActiveLineageSpecializationModifiers(playerId ?? instance?.characterId ?? null),
        ).join(' · ') || 'none'}
      </p>
      <p>
        Attr layer — Attack: {attrs.lineage.strength ?? 0} · HP: {attrs.lineage.hp ?? 0} · Def:{' '}
        {attrs.lineage.defense ?? 0}
      </p>
      <p className="character-lab__hint">EFFECTIVE</p>
      <p>
        Attack: {attrs.totals.strength} · HP: {attrs.totals.hp} · Def: {attrs.totals.defense} · Crit:{' '}
        {attrs.totals.critical}
      </p>

      <h4>PREVIEW LINEAGE</h4>
      <p className="character-lab__hint">Não salva. Só preview DEV.</p>
      <div className="character-lab__chips">
        <button
          type="button"
          className={previewLineageId == null ? 'is-active' : undefined}
          onClick={() => {
            characterLabStore.setPreviewLineage(null);
            refreshStats();
          }}
        >
          Conta
        </button>
        {LINEAGE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={previewLineageId === id ? 'is-active' : undefined}
            onClick={() => {
              characterLabStore.setPreviewLineage(id);
              refreshStats();
            }}
          >
            {LINEAGE_LABELS[id]}
          </button>
        ))}
      </div>

      <h4>PREVIEW RANK</h4>
      <div className="character-lab__chips">
        {RANKS.map((rank) => (
          <button
            key={rank}
            type="button"
            className={previewRank === rank ? 'is-active' : undefined}
            onClick={() => {
              characterLabStore.setPreviewLineageRank(rank);
              refreshStats();
            }}
          >
            {rank === 0 ? '0' : rank}
          </button>
        ))}
      </div>

      <h4>PREVIEW SPECIALIZATION</h4>
      <div className="character-lab__chips">
        {SPECS.map((spec) => {
          const previewDef = previewLineageId ? getLineageDefinition(previewLineageId) : rankDef;
          const label = spec
            ? previewDef?.specializations.find((row) => row.id === spec)?.name ??
              LINEAGE_SPECIALIZATION_SLOT_LABELS[spec]
            : 'None';
          return (
          <button
            key={spec ?? 'none'}
            type="button"
            className={previewSpec === spec ? 'is-active' : undefined}
            onClick={() => {
              characterLabStore.setPreviewSpecialization(spec, previewSpecLevel);
              refreshStats();
            }}
          >
            {label}
          </button>
          );
        })}
      </div>
      <div className="character-lab__chips">
        {SPEC_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={previewSpecLevel === level ? 'is-active' : undefined}
            onClick={() => {
              characterLabStore.setPreviewSpecialization(previewSpec, level);
              refreshStats();
            }}
          >
            Lv {level}
          </button>
        ))}
      </div>
    </section>
  );
}
