'use client';

import {
  SKILL_EXECUTION_TYPES,
  SKILL_EXECUTION_TYPE_LABELS,
  SKILL_PERSISTENT_ANCHORS,
  SKILL_PERSISTENT_ANCHOR_LABELS,
  defaultHits,
  executionWithTypes,
  formatExecutionTypesLabel,
  hasExecutionType,
  resolveExecutionTypes,
  type SkillExecutionType,
  type SkillMultiHitDef,
} from '@/data/skill-execution-def';
import { getVfxDefinition } from '@/data/vfx/registry';
import { isSequenceVfx, vfxFrameUrls } from '@/data/vfx/types';
import { clampLoopRange } from '@/lib/frame-loop';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';
import { ValueRow } from '@/ui/dev/character-lab-value-row';

const DURATION_PRESETS = [500, 1000, 1500, 2000, 3000, 5000];
const TICK_PRESETS = [50, 100, 250, 500, 1000];
const RADIUS_PRESETS = [40, 80, 120, 150, 200];

export function CharacterLabExecutionEditor() {
  const execution = useStore(characterLabStore, (s) => s.execution);
  const originals = useStore(characterLabStore, (s) => s.skillOriginals);
  const areaImpactFxPerTarget = useStore(characterLabStore, (s) => s.areaImpactFxPerTarget);
  const poseSheet = useStore(characterLabStore, (s) => s.poseSheet);
  const vfxId = useStore(characterLabStore, (s) => s.vfxId);
  const vfxLoopStartFrame = useStore(characterLabStore, (s) => s.vfxLoopStartFrame);
  const vfxLoopEndFrame = useStore(characterLabStore, (s) => s.vfxLoopEndFrame);
  const vfxLoopMode = useStore(characterLabStore, (s) => s.vfxLoopMode);

  const selected = resolveExecutionTypes(execution);
  const hasMulti = hasExecutionType(execution, 'multi-hit');
  const hasBeam = hasExecutionType(execution, 'beam');
  const hasArea = hasExecutionType(execution, 'area');
  const hasPersistent = hasExecutionType(execution, 'persistent');

  const poseFrames = Math.max(1, poseSheet?.frames?.length || poseSheet?.frameCount || 1);
  const poseLoopRange = clampLoopRange(
    poseFrames,
    poseSheet?.loopStartFrame ?? 1,
    poseSheet?.loopEndFrame ?? poseFrames,
  );

  const vfxDef = getVfxDefinition(vfxId);
  const vfxFrames = vfxDef
    ? Math.max(1, isSequenceVfx(vfxDef) ? vfxFrameUrls(vfxDef).length || vfxDef.frameCount : vfxDef.frameCount)
    : 1;
  const vfxLoopRange = clampLoopRange(vfxFrames, vfxLoopStartFrame, vfxLoopEndFrame);

  const toggleType = (id: SkillExecutionType) => {
    let next: SkillExecutionType[];
    if (id === 'single-hit') {
      next = ['single-hit'];
    } else if (selected.includes(id)) {
      next = selected.filter((t) => t !== id);
      if (next.length === 0) next = ['single-hit'];
    } else {
      next = [...selected.filter((t) => t !== 'single-hit'), id];
    }
    const enablingPersistent = id === 'persistent' && !selected.includes('persistent');
    characterLabStore.setFlag('execution', executionWithTypes(execution, next));
    if (enablingPersistent) {
      ensurePersistentFrameLoops(poseFrames, vfxFrames);
    }
  };

  const setHits = (hits: SkillMultiHitDef[]) => {
    characterLabStore.patchExecution({ hits });
  };

  return (
    <section className="character-lab__section">
      <h3>Tipo de execução</h3>
      <p className="character-lab__hint">Selecione um ou mais. Área combina com os demais.</p>
      <div className="character-lab__chips">
        {SKILL_EXECUTION_TYPES.map((id) => (
          <button
            key={id}
            type="button"
            className={selected.includes(id) ? 'is-active' : undefined}
            onClick={() => toggleType(id)}
          >
            {SKILL_EXECUTION_TYPE_LABELS[id]}
          </button>
        ))}
      </div>
      <p className="character-lab__hint">Ativo: {formatExecutionTypesLabel(execution)}</p>
      {formatExecutionTypesLabel(execution) !== formatExecutionTypesLabel(originals.execution) ? (
        <p className="character-lab__hint">Original: {formatExecutionTypesLabel(originals.execution)}</p>
      ) : null}

      {hasMulti ? (
        <MultiHitEditor
          hits={execution.hits?.length ? execution.hits : defaultHits()}
          original={originals.execution.hits ?? []}
          onChange={setHits}
        />
      ) : null}

      {hasBeam ? (
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
          {!hasPersistent ? (
            <ValueRow
              label="Tick Interval"
              original={originals.execution.tickInterval ?? 250}
              value={execution.tickInterval ?? 250}
              presets={TICK_PRESETS}
              step={10}
              suffix=" ms"
              onChange={(value) => characterLabStore.patchExecution({ tickInterval: Math.max(50, Math.round(value)) })}
            />
          ) : null}
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

      {hasArea ? (
        <>
          <ValueRow
            label="Radius"
            original={originals.execution.radius ?? 80}
            value={execution.radius ?? 80}
            presets={RADIUS_PRESETS}
            step={1}
            suffix=" px"
            onChange={(value) => characterLabStore.patchExecution({ radius: Math.max(0, Math.round(value)) })}
          />
          <label className={`character-lab__toggle${areaImpactFxPerTarget ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={areaImpactFxPerTarget}
              onChange={(event) =>
                characterLabStore.setFlag('areaImpactFxPerTarget', event.target.checked)
              }
            />
            Impacto VFX por alvo
          </label>
          <p className="character-lab__hint">
            Duplica o VFX de impacto em cada inimigo atingido no raio (requer spritesheet fx no pack).
          </p>
          {areaImpactFxPerTarget !== originals.areaImpactFxPerTarget ? (
            <p className="character-lab__hint">
              Original: {originals.areaImpactFxPerTarget ? 'ligado' : 'desligado'}
            </p>
          ) : null}
        </>
      ) : null}

      {hasPersistent ? (
        <>
          <ValueRow
            label="Duration"
            original={originals.execution.duration ?? 5000}
            value={execution.duration ?? 5000}
            presets={DURATION_PRESETS}
            step={50}
            suffix=" ms"
            onChange={(value) => {
              const duration = Math.max(1, Math.round(value));
              characterLabStore.patchExecution({ duration });
              characterLabStore.setFlag('vfxLoopDurationMs', duration);
            }}
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

          <h4>Frames do loop (Persistent)</h4>
          <p className="character-lab__hint">
            First pass toca todos os frames; depois repete só o intervalo abaixo até a duração.
          </p>

          <ValueRow
            label="Pose Loop Start"
            original={originals.poseSheet?.loopStartFrame ?? 1}
            value={poseLoopRange.startFrame}
            presets={[1, Math.ceil(poseFrames / 2), poseFrames].filter((v, i, arr) => arr.indexOf(v) === i)}
            step={1}
            suffix={` / ${poseFrames}`}
            disabled={!poseSheet}
            onChange={(value) => {
              const range = clampLoopRange(poseFrames, value, poseLoopRange.endFrame);
              characterLabStore.patchPoseSheet({
                loopMode: 'persistent-range',
                loop: true,
                loopStartFrame: range.startFrame,
                loopEndFrame: range.endFrame,
              });
            }}
          />
          <ValueRow
            label="Pose Loop End"
            original={originals.poseSheet?.loopEndFrame ?? poseFrames}
            value={poseLoopRange.endFrame}
            presets={[1, Math.ceil(poseFrames / 2), poseFrames].filter((v, i, arr) => arr.indexOf(v) === i)}
            step={1}
            suffix={` / ${poseFrames}`}
            disabled={!poseSheet}
            onChange={(value) => {
              const range = clampLoopRange(poseFrames, poseLoopRange.startFrame, value);
              characterLabStore.patchPoseSheet({
                loopMode: 'persistent-range',
                loop: true,
                loopStartFrame: range.startFrame,
                loopEndFrame: range.endFrame,
              });
            }}
          />
          {poseSheet?.loopMode !== 'persistent-range' && poseSheet ? (
            <p className="character-lab__hint">Pose loopMode atual: {poseSheet.loopMode ?? 'none'}</p>
          ) : null}

          <ValueRow
            label="VFX Loop Start"
            original={originals.vfxLoopStartFrame}
            value={vfxLoopRange.startFrame}
            presets={[1, Math.ceil(vfxFrames / 2), vfxFrames].filter((v, i, arr) => arr.indexOf(v) === i)}
            step={1}
            suffix={` / ${vfxFrames}`}
            disabled={!vfxDef}
            onChange={(value) => {
              const range = clampLoopRange(vfxFrames, value, vfxLoopRange.endFrame);
              characterLabStore.setFlag('vfxLoopMode', 'persistent-range');
              characterLabStore.setVisual('vfxLoopStartFrame', range.startFrame);
              characterLabStore.setVisual('vfxLoopEndFrame', range.endFrame);
            }}
          />
          <ValueRow
            label="VFX Loop End"
            original={originals.vfxLoopEndFrame}
            value={vfxLoopRange.endFrame}
            presets={[1, Math.ceil(vfxFrames / 2), vfxFrames].filter((v, i, arr) => arr.indexOf(v) === i)}
            step={1}
            suffix={` / ${vfxFrames}`}
            disabled={!vfxDef}
            onChange={(value) => {
              const range = clampLoopRange(vfxFrames, vfxLoopRange.startFrame, value);
              characterLabStore.setFlag('vfxLoopMode', 'persistent-range');
              characterLabStore.setVisual('vfxLoopStartFrame', range.startFrame);
              characterLabStore.setVisual('vfxLoopEndFrame', range.endFrame);
            }}
          />
          {!vfxDef ? (
            <p className="character-lab__hint">Associe um VFX Efeito para escolher frames do loop.</p>
          ) : vfxLoopMode !== 'persistent-range' ? (
            <p className="character-lab__hint">VFX loopMode atual: {vfxLoopMode}</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function ensurePersistentFrameLoops(poseFrames: number, vfxFrames: number): void {
  const state = characterLabStore.getSnapshot();
  if (state.poseSheet) {
    const range = clampLoopRange(
      poseFrames,
      state.poseSheet.loopStartFrame ?? 1,
      state.poseSheet.loopEndFrame ?? poseFrames,
    );
    characterLabStore.patchPoseSheet({
      loopMode: 'persistent-range',
      loop: true,
      loopStartFrame: range.startFrame,
      loopEndFrame: range.endFrame,
    });
  }
  const vfxRange = clampLoopRange(
    vfxFrames,
    state.vfxLoopStartFrame || 1,
    state.vfxLoopEndFrame || vfxFrames,
  );
  characterLabStore.setFlag('vfxLoopMode', 'persistent-range');
  characterLabStore.setVisual('vfxLoopStartFrame', vfxRange.startFrame);
  characterLabStore.setVisual('vfxLoopEndFrame', vfxRange.endFrame);
  if (state.execution.duration && state.execution.duration > 0) {
    characterLabStore.setFlag('vfxLoopDurationMs', state.execution.duration);
  }
  characterLabStore.setFlag('vfxLoopUntilSkillEnd', true);
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
