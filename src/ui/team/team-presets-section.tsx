'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/hooks/use-store';
import {
  activateTeamPreset,
  canChangeTeamPreset,
  clearTeamPreset,
  isActivePresetDirty,
  renameTeamPreset,
  saveCurrentTeamToPreset,
} from '@/lib/team-preset-service';
import { teamPresetStore } from '@/stores/team-preset-store';
import { teamStore } from '@/stores/team-store';
import type { TeamPreset } from '@/types/team-preset';

/**
 * Controles funcionais de presets na tela Equipe (Item 43).
 * Sem redesign visual — bloco simples.
 */
export function TeamPresetsSection() {
  const presets = useStore(teamPresetStore, (s) => s.presets);
  const activePresetId = useStore(teamPresetStore, (s) => s.activePresetId);
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const dirty = useMemo(
    () => isActivePresetDirty(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute on team/preset changes
    [teamIds, presets, activePresetId],
  );

  const inHunt = !canChangeTeamPreset();
  const nameById = useMemo(() => {
    const map = new Map(collection.map((c) => [c.id, c.name]));
    return map;
  }, [collection]);

  function slotLabel(id: string | null): string {
    if (!id) return 'VAZIO';
    return nameById.get(id) ?? 'VAZIO';
  }

  function onActivate(preset: TeamPreset): void {
    setFeedback(null);
    const result = activateTeamPreset(preset.id);
    if (!result.ok) {
      if (result.reason === 'in-hunt') {
        setFeedback('Não é possível trocar equipe durante a Hunt.');
      } else if (result.reason === 'empty') {
        setFeedback('Preset vazio — salve uma equipe antes de ativar.');
      } else {
        setFeedback('Não foi possível ativar o preset.');
      }
    }
  }

  function onSave(preset: TeamPreset): void {
    setFeedback(null);
    const result = saveCurrentTeamToPreset(preset.id);
    if (!result.ok) setFeedback('Falha ao salvar preset.');
  }

  function onClear(preset: TeamPreset): void {
    setFeedback(null);
    clearTeamPreset(preset.id);
  }

  function beginRename(preset: TeamPreset): void {
    setRenamingId(preset.id);
    setRenameDraft(preset.name);
  }

  function commitRename(preset: TeamPreset): void {
    renameTeamPreset(preset.id, renameDraft);
    setRenamingId(null);
  }

  return (
    <section className="team-mgr__presets" aria-label="Presets de equipe">
      <header className="team-mgr__pane-head">
        <h3 className="team-mgr__pane-title">Presets</h3>
        {dirty ? <span className="team-mgr__pill">ALTERADO</span> : null}
      </header>
      {inHunt ? (
        <p className="team-mgr__presets-hint">
          Não é possível trocar equipe durante a Hunt.
        </p>
      ) : (
        <p className="team-mgr__presets-hint">
          Salve formações e alterne no Hub. Não altera HP, Energia nem Skills.
        </p>
      )}
      <ul className="team-mgr__presets-list">
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId;
          const isEmpty = preset.slots.every((s) => !s);
          return (
            <li
              key={preset.id}
              className={`team-mgr__preset${isActive ? ' is-active' : ''}`}
            >
              <div className="team-mgr__preset-head">
                {renamingId === preset.id ? (
                  <input
                    className="team-mgr__preset-rename"
                    value={renameDraft}
                    maxLength={24}
                    aria-label={`Renomear ${preset.name}`}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => commitRename(preset)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(preset);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className="team-mgr__preset-name"
                    onClick={() => beginRename(preset)}
                    title="Clique para renomear"
                  >
                    {preset.name}
                    {isActive ? ' · ATIVO' : ''}
                    {isActive && dirty ? ' · ALTERADO' : ''}
                  </button>
                )}
              </div>
              <p className="team-mgr__preset-slots">
                [{slotLabel(preset.slots[0])}] [{slotLabel(preset.slots[1])}] [
                {slotLabel(preset.slots[2])}]
              </p>
              <div className="team-mgr__preset-actions">
                <button
                  type="button"
                  className="team-mgr__preset-btn"
                  disabled={inHunt || isEmpty}
                  onClick={() => onActivate(preset)}
                >
                  {isActive && !dirty ? 'ATIVO' : 'ATIVAR'}
                </button>
                <button
                  type="button"
                  className="team-mgr__preset-btn"
                  onClick={() => onSave(preset)}
                >
                  {isActive && dirty ? 'SALVAR ALTERAÇÕES' : 'SALVAR EQUIPE ATUAL'}
                </button>
                <button
                  type="button"
                  className="team-mgr__preset-btn team-mgr__preset-btn--muted"
                  onClick={() => onClear(preset)}
                >
                  LIMPAR
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {feedback ? <p className="team-mgr__presets-feedback">{feedback}</p> : null}
    </section>
  );
}
