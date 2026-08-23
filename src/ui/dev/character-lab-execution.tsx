'use client';

import {
  SKILL_EXECUTION_TYPES,
  SKILL_EXECUTION_TYPE_LABELS,
  SKILL_PERSISTENT_ANCHORS,
  SKILL_PERSISTENT_ANCHOR_LABELS,
  defaultHits,
  parseSkillExecution,
  resolveExecutionType,
  type SkillExecutionType,
  type SkillMultiHitDef,
} from '@/data/skill-execution-def';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';
import { ValueRow } from '@/ui/dev/character-lab-value-row';

const DURATION_PRESETS = [500, 1000, 1500, 2000, 3000, 5000];
const TICK_PRESETS = [50, 100, 250, 500, 1000];
const RADIUS_PRESETS = [40, 80, 120, 150, 200];

export function CharacterLabExecutionEditor() {
  const execution = useStore(characterLabStore, (s) => s.execution);
  const originals = useStore(characterLabStore, (s) => s.skillOriginals);
  const type = resolveExecutionType(execution);
  const origType = resolveExecutionType(originals.execution);

  const setType = (next: SkillExecutionType) => {
    characterLabStore.setFlag(
      'execution',
      parseSkillExecution({
        type: next,
        hits: next === 'multi-hit' ? (execution.hits?.length ? execution.hits : defaultHits()) : undefined,
        beamDuration: execution.beamDuration ?? 2000,
        tickInterval: execution.tickInterval ?? (next === 'persistent' ? 1000 : 250),
        trackTarget: execution.trackTarget === true,
        radius: execution.radius ?? 80,
        duration: execution.duration ?? 5000,
        persistentAnchor: execution.persistentAnchor ?? 'target',
      }),
    );
  };

  const setHits = (hits: SkillMultiHitDef[]) => {
    characterLabStore.patchExecution({ hits });
  };

  return (
    <section className="character-lab__section">
      <h3>Tipo de execução</h3>
      <div className="character-lab__chips">
        {SKILL_EXECUTION_TYPES.map((id) => (
          <button
            key={id}
            type="button"
            className={type === id ? 'is-active' : undefined}
            onClick={() => setType(id)}
          >
            {SKILL_EXECUTION_TYPE_LABELS[id]}
          </button>
        ))}
      </div>
      {type !== origType ? (
        <p className="character-lab__hint">Original: {SKILL_EXECUTION_TYPE_LABELS[origType]}</p>
      ) : null}

      {type === 'multi-hit' ? (
        <MultiHitEditor
          hits={execution.hits?.length ? execution.hits : defaultHits()}
          original={originals.execution.hits ?? []}
          onChange={setHits}
        />
      ) : null}

      {type === 'beam' ? (
        <>
          <ValueRow
            label="Beam Duration"
            original={originals.execution.beamDuration ?? 2000}
            value={execution.beamDuration ?? 2000}
            presets={DURATION_PRESETS}
            step={50}
            suffix=" ms"
            onChange={(value) => characterLabStore.patchExecution({ beamDuration: Math.max(1, Math.round(value)) })}
          />
          <ValueRow
            label="Tick Interval"
            original={originals.execution.tickInterval ?? 250}
            value={execution.tickInterval ?? 250}
            presets={TICK_PRESETS}
            step={10}
            suffix=" ms"
            onChange={(value) => characterLabStore.patchExecution({ tickInterval: Math.max(50, Math.round(value)) })}
          />
          <label className={`character-lab__toggle${execution.trackTarget ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={Boolean(execution.trackTarget)}
              onChange={(event) => characterLabStore.patchExecution({ trackTarget: event.target.checked })}
            />
            Track Target
          </label>
        </>
      ) : null}

      {type === 'area' ? (
        <ValueRow
          label="Radius"
          original={originals.execution.radius ?? 80}
          value={execution.radius ?? 80}
          presets={RADIUS_PRESETS}
          step={1}
          suffix=" px"
          onChange={(value) => characterLabStore.patchExecution({ radius: Math.max(0, Math.round(value)) })}
        />
      ) : null}

      {type === 'persistent' ? (
        <>
          <ValueRow
            label="Duration"
            original={originals.execution.duration ?? 5000}
            value={execution.duration ?? 5000}
            presets={DURATION_PRESETS}
            step={50}
            suffix=" ms"
            onChange={(value) => characterLabStore.patchExecution({ duration: Math.max(1, Math.round(value)) })}
          />
          <ValueRow
            label="Tick Interval"
            original={originals.execution.tickInterval ?? 1000}
            value={execution.tickInterval ?? 1000}
            presets={TICK_PRESETS}
            step={10}
            suffix=" ms"
            onChange={(value) => characterLabStore.patchExecution({ tickInterval: Math.max(50, Math.round(value)) })}
          />
          <p className="character-lab__hint">Anchor</p>
          <div className="character-lab__chips">
            {SKILL_PERSISTENT_ANCHORS.map((id) => (
              <button
                key={id}
                type="button"
                className={(execution.persistentAnchor ?? 'target') === id ? 'is-active' : undefined}
                onClick={() => characterLabStore.patchExecution({ persistentAnchor: id })}
              >
                {SKILL_PERSISTENT_ANCHOR_LABELS[id]}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function MultiHitEditor({
  hits,
  original,
  onChange,
}: {
  hits: SkillMultiHitDef[];
  original: SkillMultiHitDef[];
  onChange: (hits: SkillMultiHitDef[]) => void;
}) {
  const move = (index: number, dir: -1 | 1) => {
    const next = [...hits];
    const other = index + dir;
    if (other < 0 || other >= next.length) return;
    const tmp = next[index];
    next[index] = next[other];
    next[other] = tmp;
    onChange(next);
  };

  return (
    <div className="character-lab__hits">
      {hits.map((hit, index) => (
        <div key={`hit-${index}`} className="character-lab__hit">
          <header>
            <strong>Hit {index + 1}</strong>
            <span>
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button type="button" disabled={index === hits.length - 1} onClick={() => move(index, 1)}>
                ↓
              </button>
              <button
                type="button"
                disabled={hits.length <= 1}
                onClick={() => onChange(hits.filter((_, i) => i !== index))}
              >
                ×
              </button>
            </span>
          </header>
          <ValueRow
            label="Delay"
            original={original[index]?.delay ?? hit.delay}
            value={hit.delay}
            presets={[0, 150, 250, 450, 650, 900]}
            step={10}
            suffix=" ms"
            onChange={(value) => {
              const next = [...hits];
              next[index] = { ...hit, delay: Math.max(0, Math.round(value)) };
              onChange(next);
            }}
          />
          <ValueRow
            label="Damage"
            original={Math.round((original[index]?.damageMultiplier ?? hit.damageMultiplier) * 100)}
            value={Math.round(hit.damageMultiplier * 100)}
            presets={[10, 20, 25, 40, 50, 100]}
            step={1}
            suffix=" %"
            onChange={(value) => {
              const next = [...hits];
              next[index] = { ...hit, damageMultiplier: Math.max(0, value) / 100 };
              onChange(next);
            }}
          />
        </div>
      ))}
      <button
        type="button"
        className="character-lab__run-btn"
        disabled={hits.length >= 24}
        onClick={() =>
          onChange([...hits, { delay: (hits.at(-1)?.delay ?? 0) + 200, damageMultiplier: 0.25 }])
        }
      >
        + Adicionar Hit
      </button>
    </div>
  );
}
