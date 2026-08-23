'use client';

import {
  STATUS_APPLICATION_LABELS,
  STATUS_APPLICATION_MOMENTS,
  STATUS_APPLY_MODE_LABELS,
  STATUS_APPLY_MODES,
  STATUS_TARGET_LABELS,
  STATUS_TARGETS,
  type SkillStatusApplication,
  type StatusApplicationMoment,
  type StatusApplyMode,
  type StatusTarget,
} from '@/data/status-effect-def';
import { listStatusDefinitions } from '@/data/status';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';

function emptyEntry(statusId: string): SkillStatusApplication {
  return {
    statusId,
    chance: 1,
    target: 'target',
    application: 'on-hit',
    applyMode: 'once-per-skill',
  };
}

export function CharacterLabStatusEditor({ onManageLibrary }: { onManageLibrary?: () => void }) {
  const statusEffects = useStore(characterLabStore, (s) => s.statusEffects);
  const catalog = listStatusDefinitions();

  const update = (index: number, patch: Partial<SkillStatusApplication>) => {
    const next = statusEffects.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
    characterLabStore.setStatusEffects(next);
  };

  return (
    <section className="character-lab__section">
      <h3>STATUS EFFECTS</h3>
      <p className="character-lab__hint">
        Persistent VFX da Skill é execução. Status é efeito no alvo. Skills sem Status continuam iguais.
      </p>
      <div className="character-lab__actions">
        <button
          type="button"
          onClick={() => {
            const first = catalog[0];
            if (!first) return;
            characterLabStore.setStatusEffects([...statusEffects, emptyEntry(first.id)]);
          }}
        >
          + Adicionar Status
        </button>
        {onManageLibrary ? (
          <button type="button" onClick={onManageLibrary}>
            Gerenciar Status
          </button>
        ) : null}
      </div>
      {statusEffects.map((entry, index) => {
        const def = catalog.find((item) => item.id === entry.statusId);
        return (
          <div key={`${entry.statusId}-${index}`} className="character-lab__status-card">
            <label>
              Status
              <select
                value={entry.statusId}
                onChange={(event) => update(index, { statusId: event.target.value })}
              >
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chance
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(entry.chance * 100)}
                onChange={(event) =>
                  update(index, { chance: Math.max(0, Math.min(1, Number(event.target.value) / 100)) })
                }
              />
              %
            </label>
            <label>
              Target
              <select
                value={entry.target}
                onChange={(event) => update(index, { target: event.target.value as StatusTarget })}
              >
                {STATUS_TARGETS.map((id) => (
                  <option key={id} value={id}>
                    {STATUS_TARGET_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Application
              <select
                value={entry.application}
                onChange={(event) =>
                  update(index, { application: event.target.value as StatusApplicationMoment })
                }
              >
                {STATUS_APPLICATION_MOMENTS.map((id) => (
                  <option key={id} value={id}>
                    {STATUS_APPLICATION_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Multi-hit / Beam
              <select
                value={entry.applyMode ?? 'once-per-skill'}
                onChange={(event) => update(index, { applyMode: event.target.value as StatusApplyMode })}
              >
                {STATUS_APPLY_MODES.map((id) => (
                  <option key={id} value={id}>
                    {STATUS_APPLY_MODE_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duração override (ms)
              <input
                type="number"
                min={1}
                placeholder={def ? String(def.duration) : ''}
                value={entry.duration ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  update(index, { duration: value === '' ? undefined : Math.max(1, Number(value)) });
                }}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                characterLabStore.setStatusEffects(statusEffects.filter((_, i) => i !== index))
              }
            >
              Remover
            </button>
          </div>
        );
      })}
    </section>
  );
}
