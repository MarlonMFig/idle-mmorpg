'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/hooks/use-store';
import { fetchDevSaveJson as fetchLabApi } from '@/lib/dev/dev-save-fetch';
import { upsertDevMapConfig } from '@/lib/dev/dev-runtime-registry';
import {
  formatAspectRatio,
  getMapViewportCatalogEntry,
  listMapViewportCatalog,
} from '@/lib/dev/map-viewport-catalog';
import { locationStore } from '@/stores/location-store';
import {
  MAP_VIEWPORT_SCALE_PRESETS,
  MAP_VIEWPORT_ZOOM_PRESETS,
  mapViewportLabStore,
} from '@/stores/map-viewport-lab-store';
import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

const RES_PRESETS = [
  { label: '1366×768', w: 1366, h: 768 },
  { label: '1080p', w: 1920, h: 1080 },
  { label: '1440p', w: 2560, h: 1440 },
  { label: '4K', w: 3840, h: 2160 },
  { label: 'UW', w: 3440, h: 1440 },
] as const;

function NumberRow({
  label,
  value,
  saved,
  unit,
  dirty,
  onNudge,
  onSet,
  fineSteps = [-0.1, -0.05, -0.01, 0.01, 0.05, 0.1],
  nudgeStep = 0.05,
}: {
  label: string;
  value: number;
  saved: number | null;
  unit?: string;
  dirty: boolean;
  onNudge: (d: number) => void;
  onSet: (v: number) => void;
  fineSteps?: number[];
  nudgeStep?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    onSet(parsed);
  };

  return (
    <div className={`character-lab__value${dirty ? ' is-dirty' : ''}`}>
      <div className="character-lab__value-head">
        <span>{label}</span>
        <span>
          {saved != null ? `Salvo ${saved}${unit ?? ''} · ` : ''}
          Test {value}
          {unit ?? ''}
        </span>
      </div>
      <div className="character-lab__chips">
        {fineSteps.map((delta) => (
          <button key={delta} type="button" onClick={() => onNudge(delta)}>
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>
      <div className="character-lab__stepper">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => onNudge(-nudgeStep)}>
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onNudge(nudgeStep)}>
          +
        </button>
      </div>
    </div>
  );
}

function qualityTitle(band: string): string {
  switch (band) {
    case 'EXCELENTE':
      return 'Asset possui resolução sobrando para o enquadramento atual.';
    case 'BOA':
      return 'Resolução adequada.';
    case 'LIMITE':
      return 'Próximo de 1:1.';
    case 'AMPLIADO':
      return 'Camera/render exige ampliação do asset (possível blur/pixelização).';
    default:
      return '';
  }
}

export function CharacterLabMapViewport() {
  const catalogId = useStore(mapViewportLabStore, (s) => s.catalogId);
  const cameraZoom = useStore(mapViewportLabStore, (s) => s.cameraZoom);
  const layoutScale = useStore(mapViewportLabStore, (s) => s.layoutScale);
  const lateralFloorY = useStore(mapViewportLabStore, (s) => s.lateralFloorY);
  const officialCameraZoom = useStore(mapViewportLabStore, (s) => s.officialCameraZoom);
  const officialLayoutScale = useStore(mapViewportLabStore, (s) => s.officialLayoutScale);
  const officialLateralFloorY = useStore(mapViewportLabStore, (s) => s.officialLateralFloorY);
  const camX = useStore(mapViewportLabStore, (s) => s.camX);
  const camY = useStore(mapViewportLabStore, (s) => s.camY);
  const panMode = useStore(mapViewportLabStore, (s) => s.panMode);
  const showGrid = useStore(mapViewportLabStore, (s) => s.showGrid);
  const showCharacter = useStore(mapViewportLabStore, (s) => s.showCharacter);
  const showGroundGuide = useStore(mapViewportLabStore, (s) => s.showGroundGuide);
  const showWorldBounds = useStore(mapViewportLabStore, (s) => s.showWorldBounds);
  const showCameraBounds = useStore(mapViewportLabStore, (s) => s.showCameraBounds);
  const showViewportBounds = useStore(mapViewportLabStore, (s) => s.showViewportBounds);
  const filterMode = useStore(mapViewportLabStore, (s) => s.filterMode);
  const roundPixelsOverride = useStore(mapViewportLabStore, (s) => s.roundPixelsOverride);
  const simWidth = useStore(mapViewportLabStore, (s) => s.simWidth);
  const simHeight = useStore(mapViewportLabStore, (s) => s.simHeight);
  const diagnostics = useStore(mapViewportLabStore, (s) => s.diagnostics);
  const slotA = useStore(mapViewportLabStore, (s) => s.slotA);
  const slotB = useStore(mapViewportLabStore, (s) => s.slotB);
  const dirty = useStore(mapViewportLabStore, () => mapViewportLabStore.isDirty());

  const catalog = useMemo(() => listMapViewportCatalog(), []);
  const entry = getMapViewportCatalogEntry(catalogId);

  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [customW, setCustomW] = useState('1920');
  const [customH, setCustomH] = useState('1080');
  const [copyTarget, setCopyTarget] = useState('');

  useEffect(() => {
    mapViewportLabStore.setActive(true);
    mapViewportLabStore.setFlag('showGroundGuide', true);
    if (locationStore.getSnapshot().mode === 'hub') {
      const current = mapViewportLabStore.getSnapshot().catalogId;
      if (current !== 'hub') mapViewportLabStore.selectCatalog('hub');
    }
    return () => mapViewportLabStore.setActive(false);
  }, []);

  const travelToSelected = (id: string) => {
    const next = getMapViewportCatalogEntry(id);
    if (!next) return;
    mapViewportLabStore.selectCatalog(id);
    if (next.travelMode === 'hub') {
      locationStore.enterHub();
    } else {
      locationStore.enterCombat(next.mapKey as MapKey, null);
    }
  };

  const save = async () => {
    if (!entry) return;
    setSaving(true);
    setSaveOk(null);
    setSaveError(null);
    try {
      const target = entry.kind === 'HUB' ? 'hub' : 'wonsr';
      const { res, json } = await fetchLabApi<{
        success?: boolean;
        error?: string;
        detail?: string;
        layoutScale?: number | null;
        cameraZoom?: number | null;
        lateralFloorY?: number | null;
        file?: string;
      }>('/api/dev/map-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapKey: entry.mapKey,
          target,
          layoutScale,
          cameraZoom,
          ...(entry.lateralFloorY != null ? { lateralFloorY } : {}),
        }),
      });
      if (!res.ok || !json.success) {
        throw new Error(json.detail || json.error || 'Falha ao salvar');
      }
      upsertDevMapConfig(entry.mapKey, {
        layoutScale: json.layoutScale ?? layoutScale,
        cameraZoom: json.cameraZoom ?? cameraZoom,
        ...(json.lateralFloorY != null ? { lateralFloorY: json.lateralFloorY } : {}),
      });
      mapViewportLabStore.markOfficialSaved(
        json.layoutScale ?? layoutScale,
        json.cameraZoom ?? cameraZoom,
        json.lateralFloorY ?? (entry.lateralFloorY != null ? lateralFloorY : null),
      );
      setSaveOk(`Salvo em ${json.file ?? 'fonte'}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const copyConfig = async () => {
    if (!copyTarget || !entry) return;
    const targetEntry = getMapViewportCatalogEntry(copyTarget);
    if (!targetEntry || targetEntry.kind === 'HUB') {
      setSaveError('Copiar: escolha um mapa WONSR de destino.');
      return;
    }
    if (
      !window.confirm(
        `Copiar cameraZoom=${cameraZoom} e layoutScale=${layoutScale} para ${targetEntry.label}?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const { res, json } = await fetchLabApi<{
        success?: boolean;
        detail?: string;
        error?: string;
      }>('/api/dev/map-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapKey: targetEntry.mapKey,
          target: 'wonsr',
          layoutScale,
          cameraZoom,
        }),
      });
      if (!res.ok || !json.success) throw new Error(json.detail || json.error || 'Falha');
      upsertDevMapConfig(targetEntry.mapKey, { layoutScale, cameraZoom });
      setSaveOk(`Copiado para ${targetEntry.label}`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const aspect =
    simWidth && simHeight
      ? formatAspectRatio(simWidth, simHeight)
      : diagnostics
        ? formatAspectRatio(diagnostics.viewportW, diagnostics.viewportH)
        : entry
          ? formatAspectRatio(entry.assetWidth, entry.assetHeight)
          : '—';

  return (
    <div className="character-lab__section">
      <h3>Map Viewport Lab</h3>
      <p className="character-lab__hint">
        Preview = Phaser real (GameScene). Ao abrir a aba, a câmera encaixa o mapa inteiro (contain).
        Alterações são teste até SALVAR. Colisão/TMX não mudam com Camera Zoom.
      </p>

      {dirty ? (
        <p className="character-lab__hint" style={{ color: '#f0c060' }}>
          TESTE TEMPORÁRIO — valores diferem do committed/oficial.
        </p>
      ) : null}

      <label className="character-lab__value">
        <div className="character-lab__value-head">
          <span>Mapa</span>
        </div>
        <select
          value={catalogId}
          onChange={(e) => travelToSelected(e.target.value)}
          style={{ width: '100%' }}
        >
          {catalog.map((m) => (
            <option key={m.id} value={m.id}>
              [{m.kind}] {m.label}
            </option>
          ))}
        </select>
      </label>

      {entry ? (
        <div className="character-lab__hint">
          <div>
            ID: {entry.mapKey} · Tipo: {entry.kind}
          </div>
          <div>
            Asset: {entry.assetKey} · {entry.assetWidth}×{entry.assetHeight}
          </div>
          <div>
            World: {entry.worldWidth}×{entry.worldHeight} · Fit: {entry.cameraMode}
          </div>
        </div>
      ) : null}

      <NumberRow
        label="CAMERA ZOOM (enquadramento — não é Map Scale)"
        value={cameraZoom}
        saved={officialCameraZoom}
        unit="x"
        dirty={Math.abs(cameraZoom - (officialCameraZoom ?? cameraZoom)) > 0.001}
        onNudge={(d) => mapViewportLabStore.nudgeCameraZoom(d)}
        onSet={(v) => mapViewportLabStore.setCameraZoom(v)}
        fineSteps={[-0.1, -0.05, -0.01, 0.01, 0.05, 0.1]}
        nudgeStep={0.05}
      />
      <div className="character-lab__chips">
        <button
          type="button"
          onClick={() => {
            const d = mapViewportLabStore.getSnapshot().diagnostics;
            const entry = getMapViewportCatalogEntry(catalogId);
            if (d && d.viewportW > 0 && entry) {
              mapViewportLabStore.fitEntireMap(
                d.viewportW,
                d.viewportH,
                entry.worldWidth,
                entry.worldHeight,
              );
            } else {
              mapViewportLabStore.setFlag('pendingFit', true);
            }
          }}
        >
          VER MAPA INTEIRO
        </button>
        {MAP_VIEWPORT_ZOOM_PRESETS.map((z) => (
          <button key={z} type="button" onClick={() => mapViewportLabStore.setCameraZoom(z)}>
            {z < 1 ? z.toFixed(2) : z.toFixed(2)}x
          </button>
        ))}
      </div>

      <NumberRow
        label="MAP SCALE / layoutScale (personagens — diagnóstico + salvável)"
        value={layoutScale}
        saved={officialLayoutScale}
        dirty={Math.abs(layoutScale - officialLayoutScale) > 0.001}
        onNudge={(d) => mapViewportLabStore.nudgeLayoutScale(d)}
        onSet={(v) => mapViewportLabStore.setLayoutScale(v)}
        fineSteps={[-0.25, -0.1, -0.05, 0.05, 0.1, 0.25]}
      />
      <div className="character-lab__chips">
        {MAP_VIEWPORT_SCALE_PRESETS.map((z) => (
          <button key={z} type="button" onClick={() => mapViewportLabStore.setLayoutScale(z)}>
            {z}
          </button>
        ))}
      </div>

      {entry?.lateralFloorY != null ? (
        <>
          <NumberRow
            label="FLOOR Y / lateralFloorY (pés no chão — ↓ sobe o personagem)"
            value={lateralFloorY}
            saved={officialLateralFloorY}
            dirty={Math.abs(lateralFloorY - (officialLateralFloorY ?? lateralFloorY)) > 0.5}
            onNudge={(d) => mapViewportLabStore.nudgeLateralFloorY(d)}
            onSet={(v) => mapViewportLabStore.setLateralFloorY(v)}
            fineSteps={[-20, -5, -1, 1, 5, 20]}
            nudgeStep={1}
          />
          <p className="character-lab__hint">
            Ground Guide: liga o overlay para ver a linha dos pés vs o passeio. Zoom/Scale não
            movem o chão.
          </p>
        </>
      ) : null}

      <div className="character-lab__value">
        <div className="character-lab__value-head">
          <span>Camera X / Y</span>
          <span>
            {Math.round(camX)} / {Math.round(camY)}
          </span>
        </div>
        <div className="character-lab__chips">
          <button type="button" onClick={() => mapViewportLabStore.centerCamera()}>
            CENTRALIZAR CÂMERA
          </button>
          <button
            type="button"
            className={panMode ? 'is-active' : undefined}
            onClick={() => mapViewportLabStore.setPanMode(!panMode)}
          >
            Pan {panMode ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="character-lab__hint">
          Pan: Shift+arrastar ou botão do meio · Wheel = zoom (mín. 0.05× para ver o mapa todo)
        </p>
      </div>

      <div className="character-lab__chips">
        <button type="button" onClick={() => mapViewportLabStore.resetTest()}>
          RESETAR TESTE
        </button>
        <button type="button" onClick={() => mapViewportLabStore.saveSlot('A')}>
          Guardar A
        </button>
        <button type="button" disabled={!slotA} onClick={() => mapViewportLabStore.loadSlot('A')}>
          [A]
        </button>
        <button type="button" onClick={() => mapViewportLabStore.saveSlot('B')}>
          Guardar B
        </button>
        <button type="button" disabled={!slotB} onClick={() => mapViewportLabStore.loadSlot('B')}>
          [B]
        </button>
      </div>

      <div className="character-lab__value">
        <div className="character-lab__value-head">
          <span>Simulação de resolução</span>
          <span>{aspect}</span>
        </div>
        <div className="character-lab__chips">
          <button type="button" onClick={() => mapViewportLabStore.setSimResolution(null, null)}>
            Nativa
          </button>
          {RES_PRESETS.map((r) => (
            <button
              key={r.label}
              type="button"
              className={simWidth === r.w && simHeight === r.h ? 'is-active' : undefined}
              onClick={() => mapViewportLabStore.setSimResolution(r.w, r.h)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="character-lab__stepper">
          <input value={customW} onChange={(e) => setCustomW(e.target.value)} aria-label="Width" />
          <span>×</span>
          <input value={customH} onChange={(e) => setCustomH(e.target.value)} aria-label="Height" />
          <button
            type="button"
            onClick={() => {
              const w = Number(customW);
              const h = Number(customH);
              if (w > 0 && h > 0) mapViewportLabStore.setSimResolution(w, h);
            }}
          >
            Custom
          </button>
        </div>
      </div>

      <div className="character-lab__chips">
        {(
          [
            ['showGrid', showGrid, 'Grid'],
            ['showCharacter', showCharacter, 'Personagem'],
            ['showGroundGuide', showGroundGuide, 'Ground Guide'],
            ['showWorldBounds', showWorldBounds, 'World Bounds'],
            ['showCameraBounds', showCameraBounds, 'Camera Bounds'],
            ['showViewportBounds', showViewportBounds, 'Viewport Bounds'],
          ] as const
        ).map(([key, on, label]) => (
          <button
            key={key}
            type="button"
            className={on ? 'is-active' : undefined}
            onClick={() => mapViewportLabStore.setFlag(key, !on)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="character-lab__chips">
        <span className="character-lab__hint">Filtro mapa:</span>
        {(['official', 'nearest', 'linear'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={filterMode === mode ? 'is-active' : undefined}
            onClick={() => mapViewportLabStore.setFlag('filterMode', mode)}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="character-lab__chips">
        <span className="character-lab__hint">roundPixels:</span>
        <button
          type="button"
          className={roundPixelsOverride === null ? 'is-active' : undefined}
          onClick={() => mapViewportLabStore.setFlag('roundPixelsOverride', null)}
        >
          Oficial
        </button>
        <button
          type="button"
          className={roundPixelsOverride === true ? 'is-active' : undefined}
          onClick={() => mapViewportLabStore.setFlag('roundPixelsOverride', true)}
        >
          true
        </button>
        <button
          type="button"
          className={roundPixelsOverride === false ? 'is-active' : undefined}
          onClick={() => mapViewportLabStore.setFlag('roundPixelsOverride', false)}
        >
          false
        </button>
      </div>

      {diagnostics ? (
        <div className="character-lab__hint">
          <strong>INFO</strong>
          <div>
            Viewport: {Math.round(diagnostics.viewportW)}×{Math.round(diagnostics.viewportH)} ·
            Canvas: {Math.round(diagnostics.canvasW)}×{Math.round(diagnostics.canvasH)}
          </div>
          <div>
            Camera: {Math.round(diagnostics.cameraX)} / {Math.round(diagnostics.cameraY)} · Zoom:{' '}
            {diagnostics.cameraZoom.toFixed(3)} · Map Scale: {layoutScale}
          </div>
          <div>
            DPR: {diagnostics.dpr.toFixed(2)} · Source px/screen px:{' '}
            {diagnostics.sourcePxPerScreenPx.toFixed(2)}
          </div>
          <div title={qualityTitle(diagnostics.quality)}>
            Qualidade: {diagnostics.quality}
            {diagnostics.upscale ? ' · UPSCALE DETECTADO' : ''}
            {diagnostics.downscale ? ' · DOWNSCALE' : ''}
          </div>
          <div>
            Fit: {diagnostics.fitMode} · Filter: {diagnostics.mapFilter} · roundPixels:{' '}
            {String(diagnostics.roundPixels)}
          </div>
          <div>
            Char worldScale: {diagnostics.characterWorldScale.toFixed(3)} · Pointer screen:{' '}
            {diagnostics.screenX ?? '—'}/{diagnostics.screenY ?? '—'} · world:{' '}
            {diagnostics.worldX ?? '—'}/{diagnostics.worldY ?? '—'}
          </div>
        </div>
      ) : null}

      <div className="character-lab__chips">
        <button type="button" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? 'Salvando…' : 'SALVAR CONFIGURAÇÃO DO MAPA'}
        </button>
      </div>
      {saveOk ? <p className="character-lab__hint">{saveOk}</p> : null}
      {saveError ? (
        <p className="character-lab__hint" style={{ color: '#f66' }}>
          {saveError}
        </p>
      ) : null}

      <div className="character-lab__value">
        <div className="character-lab__value-head">
          <span>Copiar config para outro mapa</span>
        </div>
        <select value={copyTarget} onChange={(e) => setCopyTarget(e.target.value)}>
          <option value="">— destino —</option>
          {catalog
            .filter((m) => m.kind !== 'HUB' && m.id !== catalogId)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
        </select>
        <button type="button" disabled={!copyTarget || saving} onClick={() => void copyConfig()}>
          COPIAR CONFIGURAÇÃO
        </button>
      </div>

      <p className="character-lab__hint">
        Personagem = avatar atual da sessão (Sprite Alignment hub/hunt já aplicado). Safe area: N/A.
        MAP_KEYS.hub = {MAP_KEYS.hubInterdimensional}.
      </p>
    </div>
  );
}
