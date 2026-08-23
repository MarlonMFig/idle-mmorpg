'use client';

import { useState } from 'react';
import { isDevMode } from '@/config/devConfig';
import {
  MAX_AWAKENING_LEVEL,
  formatAwakeningRoman,
} from '@/constants/character-awakening';
import { formatCopper } from '@/data/shop';
import { getItem } from '@/data/items';
import { useStore } from '@/hooks/use-store';
import { awakenCharacter, canAwakenCharacter } from '@/lib/awaken-character';
import { nextAwakeningLabel } from '@/lib/character-awakening';
import {
  describeAwakeningReward,
  getActiveAwakeningRewards,
  getAwakeningReward,
  isAwakeningRewardConfigured,
} from '@/lib/awakening-rewards';
import { attributesStore } from '@/stores/attributes-store';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import type { SealedCharacter } from '@/types/team';

export function CharacterAwakeningSection({ selected }: { selected: SealedCharacter }) {
  const slots = useStore(inventoryStore, (s) => s.slots);
  const collection = useStore(teamStore, (s) => s.collection);
  const instance = collection.find((entry) => entry.id === selected.id) ?? selected;
  void slots;

  const validation = canAwakenCharacter(instance.id);
  const current = instance.awakeningLevel ?? 0;
  const activeRewards = getActiveAwakeningRewards(instance.characterId, current);
  const nextReward = validation.nextLevel
    ? getAwakeningReward(validation.nextLevel, instance.characterId)
    : null;
  const nextRewardLines = nextReward ? describeAwakeningReward(nextReward) : [];
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeConfirm = () => {
    setConfirmOpen(false);
    setBusy(false);
    setError(null);
  };

  const onConfirm = () => {
    if (busy) return;
    setBusy(true);
    const result = awakenCharacter(instance.id, current);
    if (!result.ok) {
      setError(result.missing[0] ?? 'Não foi possível despertar.');
      setBusy(false);
      return;
    }
    closeConfirm();
  };

  if (!validation.available) {
    return (
      <div className="team-mgr__awakening">
        <p className="team-mgr__awakening-title">DESPERTAR</p>
        <p>Não disponível</p>
      </div>
    );
  }

  return (
    <div className="team-mgr__awakening">
      <p className="team-mgr__awakening-title">DESPERTAR</p>
      {activeRewards.length > 0 ? (
        <div>
          <p>ATIVOS</p>
          <ul>
            {activeRewards.map((row) => {
              const lines = describeAwakeningReward(row.reward);
              return (
                <li key={row.level}>
                  Despertar {formatAwakeningRoman(row.level)}
                  {lines.length > 0 ? ` · ${lines.join(' · ')}` : ''}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {validation.maxed ? (
        <>
          <p>
            {formatAwakeningRoman(current)} / {formatAwakeningRoman(MAX_AWAKENING_LEVEL)}
          </p>
          <p>MAX</p>
          <button type="button" className="team-mgr__btn" disabled>
            DESPERTAR
          </button>
        </>
      ) : (
        <>
          <p>
            Atual: {current} / {MAX_AWAKENING_LEVEL}
          </p>
          <p>Próximo: {nextAwakeningLabel(current)}</p>
          {nextReward && isAwakeningRewardConfigured(nextReward) ? (
            <div>
              <p>Benefícios:</p>
              <ul>
                {nextRewardLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : isDevMode() ? (
            <p>Recompensa ainda não configurada</p>
          ) : null}
          <ul className="team-mgr__awakening-checks">
            {validation.checks.map((check, index) => (
              <li key={`${check.id}-${check.itemId ?? index}`} className={check.met ? 'is-ok' : 'is-miss'}>
                {check.met ? '✓' : '✗'} {check.label}
              </li>
            ))}
          </ul>
          {!validation.eligible && validation.missing.length > 0 ? (
            <p className="team-mgr__awakening-missing">{validation.missing.join(' · ')}</p>
          ) : null}
          <button
            type="button"
            className="team-mgr__btn"
            disabled={!validation.eligible || busy}
            onClick={() => {
              setError(null);
              setConfirmOpen(true);
            }}
          >
            DESPERTAR
          </button>
        </>
      )}

      {isDevMode() ? (
        <div className="team-mgr__actions">
          {[0, 1, 2, 3].map((level) => (
            <button
              key={level}
              type="button"
              className="team-mgr__btn team-mgr__btn--ghost"
              onClick={() => {
                teamStore.setCharacterAwakening(instance.id, level);
                attributesStore.onActiveCharacterChanged(false);
              }}
            >
              DEV Set {level}
            </button>
          ))}
          <button
            type="button"
            className="team-mgr__btn team-mgr__btn--ghost"
            onClick={() => {
              teamStore.setCharacterAwakening(instance.id, 0);
              attributesStore.onActiveCharacterChanged(false);
            }}
          >
            DEV Reset Despertar
          </button>
        </div>
      ) : null}

      {confirmOpen ? (
        <div className="team-mgr__awaken-preview" role="dialog" aria-label="Confirmar Despertar">
          <p className="team-mgr__awakening-title">DESPERTAR</p>
          <p>{instance.name}</p>
          <p>
            {formatAwakeningRoman(current)} → {formatAwakeningRoman(current + 1)}
          </p>
          {nextRewardLines.length > 0 ? (
            <div>
              <p>Benefícios:</p>
              <ul>
                {nextRewardLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : isDevMode() ? (
            <p>Recompensa ainda não configurada</p>
          ) : null}
          <p>Serão consumidos:</p>
          <ul>
            {validation.copperCost > 0 ? <li>Copper: {formatCopper(validation.copperCost)}</li> : <li>Copper: —</li>}
            {validation.itemCosts.map((row) => (
              <li key={row.itemId}>
                Itens: {getItem(row.itemId)?.name ?? row.itemId} ×{row.quantity}
              </li>
            ))}
            {validation.fragmentCost > 0 ? (
              <li>
                Fragmentos:{' '}
                {validation.fragmentItemId
                  ? (getItem(validation.fragmentItemId)?.name ?? validation.fragmentItemId)
                  : 'Fragmentos'}{' '}
                ×{validation.fragmentCost}
              </li>
            ) : null}
          </ul>
          <p>Requisitos permanentes:</p>
          <ul>
            {validation.checks
              .filter((check) => check.id === 'level' || check.id === 'stars' || check.id === 'mastery')
              .map((check) => (
                <li key={check.id}>
                  {check.id === 'level' ? 'Level' : check.id === 'stars' ? 'Stars' : 'Maestria'} {check.required}
                </li>
              ))}
          </ul>
          {error ? <p className="team-mgr__awakening-missing">{error}</p> : null}
          <div className="team-mgr__actions">
            <button type="button" className="team-mgr__btn" disabled={busy} onClick={onConfirm}>
              CONFIRMAR
            </button>
            <button type="button" className="team-mgr__btn team-mgr__btn--ghost" disabled={busy} onClick={closeConfirm}>
              CANCELAR
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
