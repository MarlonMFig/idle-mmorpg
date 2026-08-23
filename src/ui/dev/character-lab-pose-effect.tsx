'use client';

import { useMemo, useRef, useState } from 'react';
import type { CharacterPack, SkillVfxTargetMode } from '@/data/character-packs';
import type { SharedVfxDefinition } from '@/data/vfx/types';
import { getVfxDefinition } from '@/data/vfx';
import { TARGET_MODE_LABELS, TRAVEL_SPEED_PRESETS } from '@/lib/dev/lab-save-fields';
import {
  labDraftHasVisual,
  labPoseHasContent,
  listCharacterPoseOptions,
  poseDurationMs,
  poseSheetFromAnim,
  type LabPoseSheet,
} from '@/lib/dev/lab-pose-sheet';
import { CAST_DELAY_PRESETS_MS } from '@/lib/dev/lab-save-fields';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';
import { VfxSheetPreview } from '@/ui/dev/vfx-sheet-preview';
import { ValueRow } from '@/ui/dev/character-lab-value-row';
import { CharacterLabExecutionEditor } from '@/ui/dev/character-lab-execution';
import type { LabSkillSlot } from '@/lib/dev/lab-skill-slots';

const SCALE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const OFFSET_PRESETS = [-50, -25, -10, 0, 10, 25, 50];
const PREVIEW_SPEEDS = [0.25, 0.5, 1, 2];
const TARGET_MODES: { id: SkillVfxTargetMode; label: string }[] = [
  { id: 'caster', label: TARGET_MODE_LABELS.caster },
  { id: 'travel-to-target', label: TARGET_MODE_LABELS['travel-to-target'] },
  { id: 'instant-target', label: TARGET_MODE_LABELS['instant-target'] },
];

export function CharacterLabPoseEffect({
  playerId,
  pack,
  selectedSlot,
  lastSkillId,
  skillName,
  enemyId,
  catalogVfx,
  vfxQuery,
  vfxSource,
  onVfxQuery,
  onVfxSource,
  saveBusy,
  skillOverrideDirty,
  skillLogicDirty,
  onRequestCreateVfx,
  onSave,
  onEditSprite,
  onError,
}: {
  playerId: string | null;
  pack: CharacterPack | null;
  selectedSlot: LabSkillSlot;
  lastSkillId: string | null;
  skillName: string;
  enemyId: string | null;
  catalogVfx: SharedVfxDefinition[];
  vfxQuery: string;
  vfxSource: 'catalog' | 'wonsr-fx' | 'wonsr-aura';
  onVfxQuery: (value: string) => void;
  onVfxSource: (value: 'catalog' | 'wonsr-fx' | 'wonsr-aura') => void;
  saveBusy: boolean;
  skillOverrideDirty: boolean;
  skillLogicDirty: boolean;
  onRequestCreateVfx: () => void;
  onSave: () => void;
  onEditSprite: () => void;
  onError: (message: string) => void;
}) {
  const poseSheet = useStore(characterLabStore, (s) => s.poseSheet);
  const originals = useStore(characterLabStore, (s) => s.skillOriginals);
  const vfxId = useStore(characterLabStore, (s) => s.vfxId);
  const targetMode = useStore(characterLabStore, (s) => s.targetMode);
  const travelSpeed = useStore(characterLabStore, (s) => s.travelSpeed);
  const vfxScale = useStore(characterLabStore, (s) => s.vfxScale);
  const vfxOffsetX = useStore(characterLabStore, (s) => s.vfxOffsetX);
  const vfxOffsetY = useStore(characterLabStore, (s) => s.vfxOffsetY);
  const spawnOffsetX = useStore(characterLabStore, (s) => s.spawnOffsetX);
  const spawnOffsetY = useStore(characterLabStore, (s) => s.spawnOffsetY);
  const targetOffsetX = useStore(characterLabStore, (s) => s.targetOffsetX);
  const targetOffsetY = useStore(characterLabStore, (s) => s.targetOffsetY);
  const castDelayMs = useStore(characterLabStore, (s) => s.castDelayMs);
  const loopSkill = useStore(characterLabStore, (s) => s.loopSkill);

  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [previewSpeed, setPreviewSpeed] = useState(1);
  const [restartToken, setRestartToken] = useState(0);
  const [importBusy, setImportBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const poseOptions = useMemo(() => (pack ? listCharacterPoseOptions(pack) : []), [pack]);
  const selectedPoseId = poseOptions.find(
    (option) =>
      poseSheet &&
      option.sheet.key === poseSheet.key &&
      (option.sheet.url === poseSheet.url ||
        (option.sheet.frames?.join('|') ?? '') === (poseSheet.frames?.join('|') ?? '')),
  )?.id ?? '';
  const isDraft = !lastSkillId;
  const hasVisual = labDraftHasVisual(poseSheet, vfxId);
  const canSave = Boolean(playerId) && (isDraft ? hasVisual : skillOverrideDirty || skillLogicDirty);
  const poseDuration = poseDurationMs(poseSheet);
  const poseFrames = Math.max(1, poseSheet?.frames?.length || poseSheet?.frameCount || 1);
  const needsEnemy = targetMode === 'travel-to-target' || targetMode === 'instant-target';

  const importPose = async (files: FileList | null) => {
    if (!playerId || !files || files.length < 1) return;
    setImportBusy(true);
    try {
      const form = new FormData();
      form.set('characterId', playerId);
      if (files.length === 1) form.set('file', files[0]);
      else {
        for (const file of Array.from(files)) form.append('files', file);
      }
      const res = await fetch('/api/dev/lab-pose/import', { method: 'POST', body: form });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        url?: string;
        frames?: string[];
        key?: string;
        image?: { width: number; height: number };
        suggestedFrameCount?: number;
        sourceType?: string;
      };
      if (!res.ok || !json.ok || !json.url || !json.key || !json.image) {
        onError(json.error ?? 'Não foi possível importar a pose.');
        return;
      }
      const sequence = json.frames && json.frames.length > 0;
      const frameCount = sequence ? json.frames!.length : Math.max(1, json.suggestedFrameCount ?? 1);
      const next: LabPoseSheet = {
        key: json.key,
        url: json.url,
        frames: sequence ? json.frames : undefined,
        frameWidth: sequence ? json.image.width : Math.round(json.image.width / frameCount) || json.image.width,
        frameHeight: json.image.height,
        frameCount,
        frameRate: 12,
        loop: false,
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
      };
      characterLabStore.setPoseSheet(next);
      setRestartToken((n) => n + 1);
      setPreviewPlaying(true);
    } catch {
      onError('Não foi possível importar a pose.');
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const requestSave = () => {
    if (!canSave || saveBusy) return;
    onSave();
  };

  return (
    <div className="character-lab__subpanel">
      <h3>{isDraft ? `NOVA SKILL — SLOT ${selectedSlot}` : 'POSE / EFEITO'}</h3>
      {isDraft && skillOverrideDirty ? (
        <p className="character-lab__hint is-ok">Draft Skill — não salva</p>
      ) : null}

      <h4>ANIMAÇÃO POSE</h4>
      <p className="character-lab__hint">
        Pose atual: {poseSheet?.key || 'Nenhuma'}. Edição da spritesheet fica na aba SPRITE.
      </p>
      <label>
        Pose atual
        <select
          value={selectedPoseId}
          onChange={(event) => {
            const option = poseOptions.find((entry) => entry.id === event.target.value);
            characterLabStore.setPoseSheet(option ? poseSheetFromAnim(option.sheet) : null);
            setRestartToken((n) => n + 1);
          }}
        >
          <option value="">Nenhuma</option>
          {poseOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="character-lab__actions">
        <button type="button" disabled={!playerId || importBusy} onClick={() => fileRef.current?.click()}>
          {importBusy ? 'Importando...' : '+ Importar Pose'}
        </button>
        <button type="button" onClick={onEditSprite}>
          Editar na aba SPRITE
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/webp"
          multiple
          hidden
          onChange={(event) => void importPose(event.target.files)}
        />
      </div>

      {labPoseHasContent(poseSheet) && poseSheet ? (
        <>
          <VfxSheetPreview
            url={poseSheet.url}
            urls={poseSheet.frames}
            frameWidth={poseSheet.frameWidth}
            frameHeight={poseSheet.frameHeight}
            frameCount={poseSheet.frameCount}
            frameRate={poseSheet.frameRate}
            loop={poseSheet.loop}
            showGrid
            speed={previewSpeed}
            playing={previewPlaying}
            background="checker"
            restartToken={restartToken}
            onEnded={() => {
              if (!poseSheet.loop) setPreviewPlaying(false);
            }}
            onPauseRequest={() => setPreviewPlaying(false)}
          />
          <div className="character-lab__actions">
            <button type="button" onClick={() => setPreviewPlaying(true)}>
              Play
            </button>
            <button type="button" onClick={() => setPreviewPlaying(false)}>
              Pause
            </button>
            <button
              type="button"
              onClick={() => {
                setRestartToken((n) => n + 1);
                setPreviewPlaying(true);
              }}
            >
              Restart
            </button>
          </div>
          <div className="character-lab__chips">
            {PREVIEW_SPEEDS.map((speed) => (
              <button
                key={speed}
                type="button"
                className={previewSpeed === speed ? 'is-active' : undefined}
                onClick={() => setPreviewSpeed(speed)}
              >
                {speed}×
              </button>
            ))}
          </div>
          <p className="character-lab__hint">
            Preview · FPS {poseSheet.frameRate} · {(poseDuration / 1000).toFixed(2)}s · {poseFrames} frames
          </p>
        </>
      ) : null}

      <ValueRow
        label="Pose Scale X"
        original={originals.poseSheet?.scaleX ?? 1}
        value={poseSheet?.scaleX ?? 1}
        presets={SCALE_PRESETS}
        step={0.05}
        disabled={!labPoseHasContent(poseSheet)}
        onChange={(value) => characterLabStore.patchPoseSheet({ scaleX: value })}
      />
      <ValueRow
        label="Pose Scale Y"
        original={originals.poseSheet?.scaleY ?? 1}
        value={poseSheet?.scaleY ?? 1}
        presets={SCALE_PRESETS}
        step={0.05}
        disabled={!labPoseHasContent(poseSheet)}
        onChange={(value) => characterLabStore.patchPoseSheet({ scaleY: value })}
      />
      <ValueRow
        label="Pose Offset X"
        original={originals.poseSheet?.offsetX ?? 0}
        value={poseSheet?.offsetX ?? 0}
        presets={OFFSET_PRESETS}
        step={1}
        disabled={!labPoseHasContent(poseSheet)}
        onChange={(value) => characterLabStore.patchPoseSheet({ offsetX: value })}
      />
      <ValueRow
        label="Pose Offset Y"
        original={originals.poseSheet?.offsetY ?? 0}
        value={poseSheet?.offsetY ?? 0}
        presets={OFFSET_PRESETS}
        step={1}
        disabled={!labPoseHasContent(poseSheet)}
        onChange={(value) => characterLabStore.patchPoseSheet({ offsetY: value })}
      />
      <button type="button" className="character-lab__run-btn" onClick={() => characterLabStore.playPose()}>
        Executar Pose
      </button>

      <h4>CAST DELAY</h4>
      <ValueRow
        label="Cast Delay"
        original={originals.castDelayMs}
        value={castDelayMs}
        presets={[...CAST_DELAY_PRESETS_MS]}
        step={50}
        suffix=" ms"
        onChange={(value) => characterLabStore.setFlag('castDelayMs', Math.max(0, Math.round(value)))}
      />
      <p className="character-lab__hint">Pose → Cast Delay → Effect</p>

      <CharacterLabExecutionEditor />

      <h4>USO NESTA SKILL</h4>
      <p className="character-lab__hint">Overrides visuais desta Skill. Não altera a VfxDefinition global.</p>
      <div className="character-lab__chips">
        <button
          type="button"
          className={vfxSource === 'catalog' ? 'is-active' : undefined}
          onClick={() => onVfxSource('catalog')}
        >
          Catálogo
        </button>
        <button
          type="button"
          className={vfxSource === 'wonsr-fx' ? 'is-active' : undefined}
          onClick={() => onVfxSource('wonsr-fx')}
        >
          WONSR Effect
        </button>
        <button
          type="button"
          className={vfxSource === 'wonsr-aura' ? 'is-active' : undefined}
          onClick={() => onVfxSource('wonsr-aura')}
        >
          WONSR Aura
        </button>
      </div>
      <input
        className="character-lab__search"
        type="search"
        placeholder={
          vfxSource === 'catalog'
            ? 'Buscar VFX Efeito...'
            : 'Buscar pelo número (ex.: 845, 274)…'
        }
        value={vfxQuery}
        onChange={(event) => onVfxQuery(event.target.value)}
      />
      {vfxSource !== 'catalog' ? (
        <p className="character-lab__hint">
          {vfxSource === 'wonsr-fx' ? '1221 effects (impacto, one-shot).' : '1221 auras (loop, atrás do personagem).'}
          {' '}
          Sem busca mostra os primeiros 48. Mísseis WONSR ficam de fora.
        </p>
      ) : null}
      <div className="character-lab__chips">
        <button
          type="button"
          className={!vfxId ? 'is-active' : undefined}
          onClick={() => characterLabStore.useVfxOnSelectedSkill(null)}
        >
          Nenhum
        </button>
        {catalogVfx.map((def) => (
          <button
            key={`effect-${def.id}`}
            type="button"
            className={vfxId === def.id ? 'is-active' : undefined}
            onClick={() => characterLabStore.useVfxOnSelectedSkill(def.id)}
          >
            {def.name}
          </button>
        ))}
      </div>
      <div className="character-lab__actions">
        <button type="button" onClick={onRequestCreateVfx}>
          + Novo VFX
        </button>
      </div>
      <h4>Target Mode</h4>
      <div className="character-lab__chips">
        {TARGET_MODES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={targetMode === entry.id ? 'is-active' : undefined}
            onClick={() => characterLabStore.setFlag('targetMode', entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      {needsEnemy && !enemyId ? (
        <p className="character-lab__hint is-error">Selecione um inimigo para testar este Target Mode.</p>
      ) : null}
      {targetMode === 'travel-to-target' ? (
        <ValueRow
          label="Travel Speed"
          original={originals.travelSpeed}
          value={travelSpeed}
          presets={[...TRAVEL_SPEED_PRESETS]}
          step={50}
          suffix=" px/s"
          onChange={(value) => characterLabStore.setFlag('travelSpeed', Math.max(0, value))}
        />
      ) : null}
      <ValueRow
        label="Effect Scale"
        original={originals.vfxScale}
        value={vfxScale}
        presets={SCALE_PRESETS}
        step={0.05}
        onChange={(value) => characterLabStore.setVisual('vfxScale', value)}
      />
      <ValueRow
        label="Effect Offset X"
        original={originals.vfxOffsetX}
        value={vfxOffsetX}
        presets={OFFSET_PRESETS}
        step={1}
        onChange={(value) => characterLabStore.setVisual('vfxOffsetX', value)}
      />
      <ValueRow
        label="Effect Offset Y"
        original={originals.vfxOffsetY}
        value={vfxOffsetY}
        presets={OFFSET_PRESETS}
        step={1}
        onChange={(value) => characterLabStore.setVisual('vfxOffsetY', value)}
      />
      {targetMode !== 'caster' ? (
        <>
        <ValueRow
          label="Spawn Offset X"
          original={originals.spawnOffsetX}
          value={spawnOffsetX}
          presets={OFFSET_PRESETS}
          step={1}
          onChange={(value) => characterLabStore.setFlag('spawnOffsetX', value)}
        />
        <ValueRow
          label="Spawn Offset Y"
          original={originals.spawnOffsetY}
          value={spawnOffsetY}
          presets={OFFSET_PRESETS}
          step={1}
          onChange={(value) => characterLabStore.setFlag('spawnOffsetY', value)}
        />
        <ValueRow
          label="Target Offset X"
          original={originals.targetOffsetX}
          value={targetOffsetX}
          presets={OFFSET_PRESETS}
          step={1}
          onChange={(value) => characterLabStore.setFlag('targetOffsetX', value)}
        />
        <ValueRow
          label="Target Offset Y"
          original={originals.targetOffsetY}
          value={targetOffsetY}
          presets={OFFSET_PRESETS}
          step={1}
          onChange={(value) => characterLabStore.setFlag('targetOffsetY', value)}
        />
        </>
      ) : null}
      <button type="button" className="character-lab__run-btn" onClick={() => characterLabStore.playEffect()}>
        Executar Efeito
      </button>
      <button type="button" className="character-lab__run-btn" onClick={() => characterLabStore.playCompleteSkill()}>
        Executar Skill Completa
      </button>
      <label className={`character-lab__toggle${loopSkill ? ' is-on' : ''}`}>
        <input
          type="checkbox"
          checked={loopSkill}
          onChange={(event) => characterLabStore.setFlag('loopSkill', event.target.checked)}
        />
        Loop Skill: {loopSkill ? 'ON' : 'OFF'}
      </label>
      <div className="character-lab__actions">
        <button
          type="button"
          className="character-lab__save-btn"
          disabled={!canSave || saveBusy}
          onClick={requestSave}
        >
          Salvar Alterações da Skill
        </button>
        <button type="button" onClick={() => characterLabStore.restoreVfx()}>
          Reset VFX da Skill
        </button>
      </div>
      <p className="character-lab__hint">
        {skillName} · Slot {selectedSlot}
        {vfxId ? ` · ${getVfxDefinition(vfxId)?.name ?? vfxId}` : ''}
      </p>
    </div>
  );
}
