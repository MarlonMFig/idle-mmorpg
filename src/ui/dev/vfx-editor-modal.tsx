'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getVfxDefinition,
  isSequenceVfx,
  isVfxId,
  naturalNameSort,
  suggestHorizontalFrameCount,
  VFX_FPS_PRESETS,
  VFX_RENDER_LAYER_LABELS,
  VFX_RENDER_LAYERS,
  VFX_UNIVERSES,
  type SharedVfxDefinition,
  type VfxSourceType,
  type VfxUniverse,
} from '@/data/vfx';
import { upsertDevVfx } from '@/lib/dev/dev-runtime-registry';
import { fetchDevSave, fetchDevSaveJson, DEV_SAVE_TIMEOUT_MESSAGE } from '@/lib/dev/dev-save-fetch';
import { saveLog } from '@/lib/dev/save-log';
import { VfxSheetPreview, type VfxPreviewBg } from '@/ui/dev/vfx-sheet-preview';

export type VfxEditorMode = 'create' | 'edit' | 'duplicate';

export interface VfxEditorModalProps {
  mode: VfxEditorMode;
  sourceId?: string | null;
  canAssociate?: boolean;
  associateLabel?: string;
  pendingLeave?: { nextId: string | null; intent: 'switch' | 'create' | 'close' } | null;
  onDirtyChange?: (dirty: boolean) => void;
  onClose: () => void;
  onSaved: (id: string, options?: { associate?: boolean; keepOpen?: boolean }) => void;
  onLeaveDecision?: (action: 'cancel' | 'discard' | 'saved') => void;
}

const SPEEDS = [0.25, 0.5, 1, 2] as const;

async function fetchVfxApi(input: RequestInfo | URL, init?: RequestInit, timeoutMs?: number): Promise<Response> {
  return fetchDevSave(input, init, timeoutMs);
}

const BACKGROUNDS: { id: VfxPreviewBg; label: string }[] = [
  { id: 'checker', label: 'Quadriculado' },
  { id: 'dark', label: 'Escuro' },
  { id: 'light', label: 'Claro' },
  { id: 'green', label: 'Verde' },
];

interface SequenceItem {
  key: string;
  name: string;
  previewUrl: string;
  revoke: boolean;
  file?: File;
  publicUrl?: string;
  width: number;
  height: number;
}

const emptyForm = (): SharedVfxDefinition => ({
  id: '',
  name: '',
  universe: 'shared',
  url: '',
  sourceType: 'spritesheet',
  frames: undefined,
  frameWidth: 64,
  frameHeight: 64,
  frameCount: 1,
  frameRate: 12,
  loop: false,
  defaultScale: 1,
  defaultOffsetX: 0,
  defaultOffsetY: 0,
  renderLayer: 'front-of-characters',
});

function cloneVfxDef(def: SharedVfxDefinition): SharedVfxDefinition {
  return {
    ...def,
    frames: def.frames ? [...def.frames] : undefined,
  };
}

function vfxEditorSnapshot(form: SharedVfxDefinition, sequence: SequenceItem[]): string {
  return JSON.stringify({
    id: form.id,
    name: form.name,
    universe: form.universe,
    url: form.url,
    sourceType: form.sourceType ?? 'spritesheet',
    frames: form.frames ?? [],
    frameWidth: form.frameWidth,
    frameHeight: form.frameHeight,
    frameCount: form.frameCount,
    frameRate: form.frameRate,
    loop: form.loop,
    defaultScale: form.defaultScale,
    defaultOffsetX: form.defaultOffsetX,
    defaultOffsetY: form.defaultOffsetY,
    renderLayer: form.renderLayer ?? 'front-of-characters',
    sequence: sequence.map((item) => `${item.name}:${item.publicUrl ?? 'pending'}:${item.width}x${item.height}`),
  });
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function readFileImage(file: File): Promise<SequenceItem> {
  return new Promise((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        previewUrl,
        revoke: true,
        file,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      reject(new Error(`Imagem inválida: ${file.name}`));
    };
    img.src = previewUrl;
  });
}

function readUrlImage(url: string, name: string): Promise<SequenceItem> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        key: url,
        name,
        previewUrl: url,
        revoke: false,
        publicUrl: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error(`Falha ao carregar ${url}`));
    img.src = url;
  });
}

function revokeItems(items: SequenceItem[]): void {
  for (const item of items) {
    if (item.revoke) URL.revokeObjectURL(item.previewUrl);
  }
}

function sequenceMixedSizes(items: SequenceItem[]): boolean {
  if (items.length < 2) return false;
  return items.some(
    (item, index) => index > 0 && (item.width !== items[0].width || item.height !== items[0].height),
  );
}

export function VfxEditorModal({
  mode,
  sourceId,
  canAssociate = false,
  associateLabel = 'Usar nesta Skill',
  pendingLeave = null,
  onDirtyChange,
  onClose,
  onSaved,
  onLeaveDecision,
}: VfxEditorModalProps) {
  const [form, setForm] = useState<SharedVfxDefinition>(() => {
    if (sourceId) {
      const source = getVfxDefinition(sourceId);
      if (source) {
        const cloned = cloneVfxDef(source);
        if (mode === 'duplicate') {
          return { ...cloned, id: `${source.id}-copy`, name: `${source.name} Copy` };
        }
        return { ...cloned, sourceType: cloned.sourceType ?? 'spritesheet' };
      }
    }
    return emptyForm();
  });
  const [sequence, setSequence] = useState<SequenceItem[]>([]);
  const [assets, setAssets] = useState<{ url: string; universe: string; fileName: string }[]>([]);
  const [image, setImage] = useState<{ width: number; height: number; suggestedFrameCount: number | null } | null>(
    null,
  );
  const [isSavingVfx, setIsSavingVfx] = useState(false);
  const [saveProgress, setSaveProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ url: string; fileName: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [background, setBackground] = useState<VfxPreviewBg>('checker');
  const [restartToken, setRestartToken] = useState(0);
  const [idLocked, setIdLocked] = useState(mode !== 'create');
  const [createdPrompt, setCreatedPrompt] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [persisted, setPersisted] = useState(mode === 'edit');
  const sequenceRef = useRef<SequenceItem[]>([]);
  const loadedFramesRef = useRef(false);
  const baselineRef = useRef(vfxEditorSnapshot(form, []));
  const saveAfterLeaveRef = useRef(false);

  const isSequence = isSequenceVfx(form);
  const source = sourceId ? getVfxDefinition(sourceId) : null;
  const previewUrls = useMemo(
    () => (isSequence ? sequence.map((item) => item.previewUrl) : null),
    [isSequence, sequence],
  );

  useEffect(() => {
    sequenceRef.current = sequence;
  }, [sequence]);

  useEffect(() => {
    return () => revokeItems(sequenceRef.current);
  }, []);

  useEffect(() => {
    if (loadedFramesRef.current) return;
    const frames = sourceId ? getVfxDefinition(sourceId)?.frames : undefined;
    if (!frames?.length) return;
    loadedFramesRef.current = true;
    let cancelled = false;
    void Promise.all(frames.map((url) => readUrlImage(url, url.split('/').pop() ?? url)))
      .then((items) => {
        if (!cancelled) {
          setSequence(items);
          baselineRef.current = vfxEditorSnapshot(form, items);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar frames.');
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const suggested = useMemo(() => {
    if (!image || isSequence) return null;
    return suggestHorizontalFrameCount(image.width, image.height, form.frameWidth, form.frameHeight);
  }, [image, form.frameWidth, form.frameHeight, isSequence]);

  const mixedSizes = useMemo(() => sequenceMixedSizes(sequence), [sequence]);

  const duration = form.frameRate > 0 ? form.frameCount / form.frameRate : 0;
  const dirty = vfxEditorSnapshot(form, sequence) !== baselineRef.current;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    void fetch('/api/dev/vfx/assets')
      .then(async (res) => (await res.json()) as { items?: typeof assets })
      .then((json) => setAssets(json.items ?? []))
      .catch(() => setAssets([]));
  }, []);

  useEffect(() => {
    if (isSequence) {
      const first = sequence[0];
      if (first) setImage({ width: first.width, height: first.height, suggestedFrameCount: sequence.length });
      else setImage(null);
      return;
    }
    if (!form.url) {
      setImage(null);
      return;
    }
    void fetch(
      `/api/dev/vfx/assets?url=${encodeURIComponent(form.url)}&frameWidth=${form.frameWidth}&frameHeight=${form.frameHeight}`,
    )
      .then(async (res) => (await res.json()) as { image?: typeof image })
      .then((json) => setImage(json.image ?? null))
      .catch(() => setImage(null));
  }, [form.url, form.frameWidth, form.frameHeight, isSequence, sequence]);

  const patch = (partial: Partial<SharedVfxDefinition>) => setForm((cur) => ({ ...cur, ...partial }));

  const setSourceType = (sourceType: VfxSourceType) => {
    patch({
      sourceType,
      frameCount: sourceType === 'sequence' ? Math.max(1, sequence.length) : form.frameCount,
    });
  };

  const applySequenceItems = (items: SequenceItem[], modeAdd: 'replace' | 'append') => {
    const next = modeAdd === 'replace' ? items : [...sequence, ...items];
    if (modeAdd === 'replace') revokeItems(sequence);
    setSequence(next);
    const first = next[0];
    patch({
      sourceType: 'sequence',
      frameCount: next.length,
      frameWidth: first?.width || form.frameWidth,
      frameHeight: first?.height || form.frameHeight,
    });
    setPlaying(true);
    setRestartToken((n) => n + 1);
  };

  const importFiles = async (files: File[], modeAdd: 'replace' | 'append') => {
    if (files.length < 1) return;
    setIsSavingVfx(true);
    setError(null);
    try {
      const sorted = [...files].sort((a, b) => naturalNameSort(a.name, b.name));
      if (isSequence || sorted.length > 1) {
        const items = await Promise.all(sorted.map((file) => readFileImage(file)));
        applySequenceItems(items, modeAdd);
        return;
      }
      await importSpritesheetFile(sorted[0], 'ask');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao importar.');
    } finally {
      setIsSavingVfx(false);
    }
  };

  const importSpritesheetFile = async (file: File, conflictMode: 'ask' | 'replace' | 'rename') => {
    setIsSavingVfx(true);
    setError(null);
    setPendingFile(file);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('universe', form.universe);
      body.set('conflict', conflictMode);
      body.set('sourceType', 'spritesheet');
      const res = await fetch('/api/dev/vfx/import', { method: 'POST', body });
      const json = (await res.json()) as {
        ok?: boolean;
        exists?: boolean;
        url?: string;
        fileName?: string;
        error?: string;
        image?: { width: number; height: number };
      };
      if (res.status === 409 && json.exists) {
        setConflict({ url: json.url ?? '', fileName: json.fileName ?? file.name });
        return;
      }
      if (!res.ok || !json.ok || !json.url) {
        setError(json.error ?? 'Falha ao importar.');
        return;
      }
      setConflict(null);
      setPendingFile(null);
      patch({ url: json.url, sourceType: 'spritesheet' });
      if (json.image) setImage({ ...json.image, suggestedFrameCount: null });
      void fetch('/api/dev/vfx/assets')
        .then(async (r) => (await r.json()) as { items?: typeof assets })
        .then((data) => setAssets(data.items ?? []));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao importar.');
    } finally {
      setIsSavingVfx(false);
    }
  };

  const moveFrame = (index: number, dir: -1 | 1) => {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= sequence.length) return;
    const next = [...sequence];
    const swap = next[index];
    next[index] = next[nextIndex];
    next[nextIndex] = swap;
    setSequence(next);
  };

  const removeFrame = (index: number) => {
    const removed = sequence[index];
    const next = sequence.filter((_, i) => i !== index);
    if (removed?.revoke) URL.revokeObjectURL(removed.previewUrl);
    setSequence(next);
    const first = next[0];
    patch({
      frameCount: next.length,
      frameWidth: first?.width || form.frameWidth,
      frameHeight: first?.height || form.frameHeight,
    });
  };

  const persistAction = persisted || mode === 'edit' ? 'update' : 'create';

  const finishSave = (id: string, def: SharedVfxDefinition) => {
    upsertDevVfx(def);
    setIdLocked(true);
    setPersisted(true);
    baselineRef.current = vfxEditorSnapshot(form, sequence);
    onDirtyChange?.(false);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
    if (saveAfterLeaveRef.current) {
      saveAfterLeaveRef.current = false;
      onSaved(id, { associate: false, keepOpen: true });
      onLeaveDecision?.('saved');
      return;
    }
    onSaved(id, { associate: false, keepOpen: true });
    if (mode !== 'edit') setCreatedPrompt(id);
  };

  const save = async () => {
    saveLog('started', 'vfx');
    setIsSavingVfx(true);
    setSaveProgress(null);
    setError(null);
    try {
      if (!isVfxId(form.id)) {
        setError('ID inválido (use kebab-case, ex.: dimension-slash)');
        return;
      }
      let payload: SharedVfxDefinition;
      if (isSequence) {
        if (sequence.length < 1) {
          setError('Importe pelo menos um frame da sequência.');
          return;
        }
        const originalFrames = source?.frames ?? [];
        const needsRewrite =
          persistAction !== 'update' ||
          form.universe !== source?.universe ||
          sequence.some((item) => item.file) ||
          sequence.length !== originalFrames.length ||
          sequence.some((item, index) => item.publicUrl !== originalFrames[index]);
        let frames = sequence.map((item) => item.publicUrl).filter((url): url is string => Boolean(url));
        if (needsRewrite) {
          setSaveProgress(`Salvando frames... ${sequence.length} / ${sequence.length}`);
          const body = new FormData();
          body.set('sourceType', 'sequence');
          body.set('universe', form.universe);
          body.set('vfxId', form.id);
          for (let i = 0; i < sequence.length; i += 1) {
            const item = sequence[i];
            setSaveProgress(`Salvando frames... ${i + 1} / ${sequence.length}`);
            try {
              if (item.file) {
                body.append('files', item.file, item.file.name);
              } else {
                const res = await fetch(item.previewUrl);
                const blob = await res.blob();
                body.append('files', new File([blob], item.name, { type: blob.type || 'image/png' }));
              }
            } catch {
              throw new Error(`Falha ao importar frame ${i + 1}.`);
            }
          }
          saveLog('request sent', 'vfx/import');
          const imported = await fetchVfxApi('/api/dev/vfx/import', { method: 'POST', body }, 45_000);
          saveLog('frontend response received', 'vfx/import');
          const json = (await imported.json()) as { ok?: boolean; error?: string; frames?: string[]; url?: string };
          if (!imported.ok || !json.ok || !json.frames?.length) {
            setError(json.error ?? 'Falha ao salvar os frames.');
            return;
          }
          frames = json.frames;
        }
        payload = {
          ...form,
          sourceType: 'sequence',
          frames,
          url: frames[0] ?? form.url,
          frameCount: frames.length,
          frameWidth: sequence[0].width,
          frameHeight: sequence[0].height,
        };
      } else {
        payload = { ...form, sourceType: 'spritesheet' };
      }

      setSaveProgress('Salvando VFX...');
      saveLog('request sent', 'vfx/save');
      const { res, json } = await fetchDevSaveJson<{
        success?: boolean;
        ok?: boolean;
        error?: string;
        id?: string;
        vfx?: SharedVfxDefinition;
      }>('/api/dev/vfx/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: persistAction,
          ...payload,
        }),
      });
      saveLog('frontend response received', 'vfx/save');
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Não foi possível salvar o VFX.');
        return;
      }
      finishSave(json.id ?? form.id, json.vfx ?? payload);
      saveLog('finished', 'vfx');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar o VFX.';
      setError(message === DEV_SAVE_TIMEOUT_MESSAGE ? DEV_SAVE_TIMEOUT_MESSAGE : message);
    } finally {
      setSaveProgress(null);
      setIsSavingVfx(false);
    }
  };

  const title =
    persisted || mode === 'edit' ? 'Editar VFX' : mode === 'duplicate' ? 'Duplicar VFX' : 'Novo VFX';

  return (
    <div
      className="vfx-editor"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="vfx-editor__panel">
        <header className="vfx-editor__head">
          <h3>{title}</h3>
          <button type="button" className="character-lab__icon-btn" aria-label="Fechar" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="vfx-editor__type">
          <span>Tipo de VFX</span>
          <div className="character-lab__chips">
            <button
              type="button"
              className={!isSequence ? 'is-active' : undefined}
              onClick={() => setSourceType('spritesheet')}
            >
              Spritesheet
            </button>
            <button
              type="button"
              className={isSequence ? 'is-active' : undefined}
              onClick={() => setSourceType('sequence')}
            >
              Sequência de Frames
            </button>
          </div>
        </div>

        <div className="vfx-editor__grid">
          <label>
            Nome
            <input
              value={form.name}
              onChange={(event) => {
                const name = event.target.value;
                patch({ name, id: idLocked ? form.id : slugify(name) });
              }}
            />
          </label>
          <label>
            ID
            <input
              value={form.id}
              disabled={mode === 'edit' || idLocked}
              onChange={(event) => {
                setIdLocked(true);
                patch({ id: event.target.value.toLowerCase() });
              }}
            />
          </label>
          <label>
            Universo
            <select
              value={form.universe}
              onChange={(event) => patch({ universe: event.target.value as VfxUniverse })}
            >
              {VFX_UNIVERSES.map((universe) => (
                <option key={universe} value={universe}>
                  {universe}
                </option>
              ))}
            </select>
          </label>
          {!isSequence ? (
            <label>
              Asset
              <select value={form.url} onChange={(event) => patch({ url: event.target.value })}>
                <option value="">Selecionar em /vfx/…</option>
                {assets.map((asset) => (
                  <option key={asset.url} value={asset.url}>
                    {asset.url}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="character-lab__hint">
              Pasta: /vfx/{form.universe || 'universo'}/{form.id || 'id'}/
            </p>
          )}
        </div>

        <div className="vfx-editor__actions">
          <label className="vfx-editor__file">
            Importar VFX
            <input
              type="file"
              multiple
              accept="image/png,image/webp"
              disabled={isSavingVfx}
              onChange={(event) => {
                const files = event.target.files ? Array.from(event.target.files) : [];
                event.target.value = '';
                if (files.length > 0) void importFiles(files, 'replace');
              }}
            />
          </label>
          {isSequence ? (
            <label className="vfx-editor__file">
              + Adicionar Frames
              <input
                type="file"
                multiple
                accept="image/png,image/webp"
                disabled={isSavingVfx}
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  event.target.value = '';
                  if (files.length > 0) void importFiles(files, 'append');
                }}
              />
            </label>
          ) : null}
          {suggested != null && suggested !== form.frameCount ? (
            <button type="button" onClick={() => patch({ frameCount: suggested })}>
              Sugerir {suggested} frames
            </button>
          ) : null}
        </div>

        {isSequence ? (
          <details className="vfx-editor__frames" open>
            <summary>Frames importados: {sequence.length}</summary>
            {sequence.length === 0 ? (
              <p className="character-lab__hint">Selecione vários PNGs de uma vez no explorador do Windows.</p>
            ) : (
              <ol className="vfx-editor__frame-list">
                {sequence.map((item, index) => (
                  <li key={item.key}>
                    <span className="vfx-editor__frame-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="vfx-editor__frame-name" title={item.name}>
                      {item.name}
                    </span>
                    <span className="vfx-editor__frame-size">
                      {item.width}×{item.height}
                    </span>
                    <button type="button" disabled={index === 0} onClick={() => moveFrame(index, -1)}>
                      ↑
                    </button>
                    <button type="button" disabled={index === sequence.length - 1} onClick={() => moveFrame(index, 1)}>
                      ↓
                    </button>
                    <button type="button" onClick={() => removeFrame(index)}>
                      Remover
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </details>
        ) : null}

        {conflict ? (
          <div className="character-lab__confirm">
            <strong>Arquivo já existe.</strong>
            <p className="character-lab__hint">{conflict.url}</p>
            <div className="character-lab__actions">
              <button type="button" onClick={() => setConflict(null)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!pendingFile}
                onClick={() => pendingFile && void importSpritesheetFile(pendingFile, 'replace')}
              >
                Substituir
              </button>
              <button
                type="button"
                disabled={!pendingFile}
                onClick={() => pendingFile && void importSpritesheetFile(pendingFile, 'rename')}
              >
                Criar com outro nome
              </button>
            </div>
          </div>
        ) : null}

        <div className="vfx-editor__grid">
          <NumField
            label="Frame Width"
            value={form.frameWidth}
            onChange={(value) => patch({ frameWidth: value })}
            disabled={isSequence}
          />
          <NumField
            label="Frame Height"
            value={form.frameHeight}
            onChange={(value) => patch({ frameHeight: value })}
            disabled={isSequence}
          />
          <NumField
            label="Frame Count"
            value={isSequence ? sequence.length : form.frameCount}
            onChange={(value) => patch({ frameCount: value })}
            disabled={isSequence}
          />
          <NumField label="FPS / Frame Rate" value={form.frameRate} onChange={(value) => patch({ frameRate: value })} />
          <NumField
            label="Scale inicial"
            value={form.defaultScale}
            step={0.05}
            onChange={(value) => patch({ defaultScale: value })}
          />
          <NumField
            label="Offset X inicial"
            value={form.defaultOffsetX}
            onChange={(value) => patch({ defaultOffsetX: value })}
          />
          <NumField
            label="Offset Y inicial"
            value={form.defaultOffsetY}
            onChange={(value) => patch({ defaultOffsetY: value })}
          />
          <label className="character-lab__toggle">
            <input
              type="checkbox"
              checked={form.loop}
              onChange={(event) => patch({ loop: event.target.checked })}
            />
            Loop
          </label>
        </div>

        <h4>Render Layer</h4>
        <p className="character-lab__hint">Camada no combate. Padrão: frente dos personagens.</p>
        <div className="character-lab__chips">
          {VFX_RENDER_LAYERS.map((layer) => (
            <button
              key={layer}
              type="button"
              className={(form.renderLayer ?? 'front-of-characters') === layer ? 'is-active' : undefined}
              onClick={() => patch({ renderLayer: layer })}
            >
              {VFX_RENDER_LAYER_LABELS[layer]}
            </button>
          ))}
        </div>

        <div className="character-lab__chips">
          {VFX_FPS_PRESETS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={form.frameRate === entry ? 'is-active' : undefined}
              onClick={() => patch({ frameRate: entry })}
            >
              {entry} FPS
            </button>
          ))}
        </div>

        <label className="character-lab__toggle">
          <input type="checkbox" checked={showGrid} onChange={(event) => setShowGrid(event.target.checked)} />
          Show Frame Grid
        </label>

        <div className="vfx-editor__summary">
          <strong>{form.name || 'Sem nome'}</strong>
          <p>
            Frames: {isSequence ? sequence.length : form.frameCount}
            {' · '}
            Resolution: {form.frameWidth}×{form.frameHeight}
            {' · '}
            FPS: {form.frameRate}
            {' · '}
            Duration: {duration.toFixed(2)}s
            {' · '}
            Loop: {form.loop ? 'ON' : 'OFF'}
          </p>
        </div>

        <VfxSheetPreview
          url={isSequence ? null : form.url || null}
          urls={previewUrls}
          frameWidth={form.frameWidth}
          frameHeight={form.frameHeight}
          frameCount={isSequence ? Math.max(1, sequence.length) : form.frameCount}
          frameRate={form.frameRate}
          loop={form.loop}
          showGrid={showGrid}
          speed={speed}
          playing={playing}
          background={background}
          restartToken={restartToken}
          onEnded={() => setPlaying(false)}
          onPauseRequest={() => setPlaying(false)}
        />

        <div className="character-lab__actions">
          <button type="button" onClick={() => setPlaying(true)}>
            Play
          </button>
          <button type="button" onClick={() => setPlaying(false)}>
            Pause
          </button>
          <button
            type="button"
            onClick={() => {
              setRestartToken((n) => n + 1);
              setPlaying(true);
            }}
          >
            Restart
          </button>
          {SPEEDS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={speed === entry ? 'is-active' : undefined}
              onClick={() => setSpeed(entry)}
            >
              {entry}×
            </button>
          ))}
        </div>
        <div className="character-lab__chips">
          {BACKGROUNDS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={background === entry.id ? 'is-active' : undefined}
              onClick={() => setBackground(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <p className="character-lab__hint">
          Preview só para análise. A velocidade {speed}× não grava o FPS.
          {image ? ` Asset: ${image.width} × ${image.height}.` : ''}
          {isSequence
            ? ' Sequência: um VFX, N imagens. Combat recebe a mesma textura.'
            : ' Sheet horizontal (esquerda→direita). Imagem única = Frame Count 1.'}
        </p>

        {mixedSizes ? (
          <p className="character-lab__hint">
            Frames com tamanhos diferentes: no save eles vão para um canvas comum (centro).
          </p>
        ) : null}
        {error ? <p className="character-lab__hint is-error">{error}</p> : null}

        {createdPrompt ? (
          <div className="character-lab__confirm" role="status">
            <strong>VFX salvo ✓</strong>
            <p className="character-lab__hint">O slot selecionado não foi alterado automaticamente.</p>
            <div className="character-lab__actions">
              <button
                type="button"
                onClick={() => setCreatedPrompt(null)}
              >
                Continuar
              </button>
              <button
                type="button"
                className="character-lab__save-btn"
                disabled={!canAssociate}
                onClick={() => {
                  setCreatedPrompt(null);
                  onSaved(createdPrompt, { associate: true, keepOpen: true });
                }}
              >
                Usar nesta Skill
              </button>
            </div>
          </div>
        ) : null}

        {pendingLeave && dirty ? (
          <div className="character-lab__confirm" role="alertdialog" aria-label="Alterações não salvas no VFX">
            <strong>Existem alterações não salvas no VFX {form.name || form.id || 'atual'}.</strong>
            <div className="character-lab__actions">
              <button
                type="button"
                className="character-lab__save-btn"
                disabled={isSavingVfx}
                onClick={() => {
                  saveAfterLeaveRef.current = true;
                  void save();
                }}
              >
                Salvar
              </button>
              <button type="button" disabled={isSavingVfx} onClick={() => onLeaveDecision?.('discard')}>
                Descartar
              </button>
              <button type="button" disabled={isSavingVfx} onClick={() => onLeaveDecision?.('cancel')}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <div className="character-lab__actions">
          <button
            type="button"
            className="character-lab__save-btn"
            disabled={isSavingVfx}
            onClick={() => void save()}
          >
            {isSavingVfx
              ? saveProgress ?? 'Salvando...'
              : savedFlash
                ? 'VFX salvo ✓'
                : 'Salvar VFX'}
          </button>
          <button type="button" disabled={isSavingVfx} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
