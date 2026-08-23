import { createStore, type WritableStore } from '@/stores/create-store';
import type { MapKey } from '@/maps/map-registry';
import {
  getMapViewportCatalogEntry,
  listMapViewportCatalog,
  type QualityBand,
} from '@/lib/dev/map-viewport-catalog';

export const MAP_VIEWPORT_ZOOM_MIN = 0.5;
export const MAP_VIEWPORT_ZOOM_MAX = 2;
export const MAP_VIEWPORT_ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5] as const;
export const MAP_VIEWPORT_SCALE_PRESETS = [0.75, 1, 1.25, 2, 3.1, 4.75, 5.75] as const;

export type MapFilterMode = 'official' | 'nearest' | 'linear';

export interface MapViewportSnapshot {
  cameraZoom: number;
  layoutScale: number;
  camX: number;
  camY: number;
}

export interface MapViewportDiagnostics {
  canvasW: number;
  canvasH: number;
  viewportW: number;
  viewportH: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  roundPixels: boolean;
  dpr: number;
  sourcePxPerScreenPx: number;
  quality: QualityBand;
  upscale: boolean;
  downscale: boolean;
  fitMode: string;
  mapFilter: 'nearest' | 'linear' | 'unknown';
  characterWorldScale: number;
  screenX: number | null;
  screenY: number | null;
  worldX: number | null;
  worldY: number | null;
}

export interface MapViewportLabState {
  catalogId: string;
  mapKey: MapKey | string;
  /** Rascunho DEV (não oficial até salvar). */
  cameraZoom: number;
  layoutScale: number;
  /** Chão dos pés (só mapas laterais). */
  lateralFloorY: number;
  officialCameraZoom: number | null;
  officialLayoutScale: number;
  officialLateralFloorY: number | null;
  /** Baseline do teste (select/reset/save) — dirty = draft ≠ committed. */
  committedCameraZoom: number;
  committedLayoutScale: number;
  committedLateralFloorY: number;
  camX: number;
  camY: number;
  /** true = lab controla câmera (sem follow). */
  panMode: boolean;
  showGrid: boolean;
  showCharacter: boolean;
  showGroundGuide: boolean;
  showWorldBounds: boolean;
  showCameraBounds: boolean;
  showViewportBounds: boolean;
  filterMode: MapFilterMode;
  roundPixelsOverride: boolean | null;
  simWidth: number | null;
  simHeight: number | null;
  slotA: MapViewportSnapshot | null;
  slotB: MapViewportSnapshot | null;
  diagnostics: MapViewportDiagnostics | null;
  /** Lab ativo (aba Mapas aberta / sessão). */
  active: boolean;
}

const defaultDiagnostics = (): MapViewportDiagnostics => ({
  canvasW: 0,
  canvasH: 0,
  viewportW: 0,
  viewportH: 0,
  cameraX: 0,
  cameraY: 0,
  cameraZoom: 1,
  roundPixels: true,
  dpr: 1,
  sourcePxPerScreenPx: 1,
  quality: 'LIMITE',
  upscale: false,
  downscale: false,
  fitMode: '—',
  mapFilter: 'unknown',
  characterWorldScale: 1,
  screenX: null,
  screenY: null,
  worldX: null,
  worldY: null,
});

function clampZoom(z: number): number {
  return Math.min(MAP_VIEWPORT_ZOOM_MAX, Math.max(MAP_VIEWPORT_ZOOM_MIN, Math.round(z * 100) / 100));
}

function clampScale(s: number): number {
  return Math.min(20, Math.max(0.1, Math.round(s * 1000) / 1000));
}

function clampFloorY(y: number): number {
  return Math.round(Math.min(8000, Math.max(0, y)));
}

function emptyState(): MapViewportLabState {
  const first = listMapViewportCatalog()[0];
  const floor = first?.lateralFloorY ?? 0;
  return {
    catalogId: first?.id ?? 'hub',
    mapKey: first?.mapKey ?? 'hubInterdimensional',
    cameraZoom: first?.cameraZoom ?? 1,
    layoutScale: first?.layoutScale ?? 1,
    lateralFloorY: floor,
    officialCameraZoom: first?.cameraZoom ?? null,
    officialLayoutScale: first?.layoutScale ?? 1,
    officialLateralFloorY: first?.lateralFloorY ?? null,
    committedCameraZoom: first?.cameraZoom ?? 1,
    committedLayoutScale: first?.layoutScale ?? 1,
    committedLateralFloorY: floor,
    camX: (first?.worldWidth ?? 0) / 2,
    camY: (first?.worldHeight ?? 0) / 2,
    panMode: false,
    showGrid: false,
    showCharacter: true,
    showGroundGuide: false,
    showWorldBounds: false,
    showCameraBounds: false,
    showViewportBounds: false,
    filterMode: 'official',
    roundPixelsOverride: null,
    simWidth: null,
    simHeight: null,
    slotA: null,
    slotB: null,
    diagnostics: null,
    active: false,
  };
}

const STORE_KEY = '__idleMmorpgMapViewportLabStore';
type G = { [STORE_KEY]?: WritableStore<MapViewportLabState> };

function getStore(): WritableStore<MapViewportLabState> {
  const g = globalThis as G;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = createStore(emptyState());
    return g[STORE_KEY]!;
  }
  // HMR: store antigo sem lateralFloorY — remonta baseline.
  const snap = g[STORE_KEY]!.getSnapshot() as Partial<MapViewportLabState>;
  if (typeof snap.lateralFloorY !== 'number' || typeof snap.committedLateralFloorY !== 'number') {
    g[STORE_KEY] = createStore({ ...emptyState(), active: snap.active === true });
  }
  return g[STORE_KEY]!;
}

function patch(partial: Partial<MapViewportLabState>): void {
  const store = getStore();
  store.setState({ ...store.getSnapshot(), ...partial });
}

function loadOfficialFor(catalogId: string): void {
  const entry = getMapViewportCatalogEntry(catalogId);
  if (!entry) return;
  const zoom = entry.cameraZoom ?? 1;
  const floor = entry.lateralFloorY ?? 0;
  patch({
    catalogId: entry.id,
    mapKey: entry.mapKey,
    cameraZoom: zoom,
    layoutScale: entry.layoutScale,
    lateralFloorY: floor,
    officialCameraZoom: entry.cameraZoom,
    officialLayoutScale: entry.layoutScale,
    officialLateralFloorY: entry.lateralFloorY,
    committedCameraZoom: zoom,
    committedLayoutScale: entry.layoutScale,
    committedLateralFloorY: floor,
    camX: entry.worldWidth / 2,
    camY: entry.worldHeight / 2,
    panMode: false,
  });
}

export const mapViewportLabStore = {
  subscribe: (listener: () => void) => getStore().subscribe(listener),
  getSnapshot: () => getStore().getSnapshot(),

  setActive(active: boolean): void {
    patch({ active });
  },

  selectCatalog(catalogId: string): void {
    loadOfficialFor(catalogId);
  },

  setCameraZoom(zoom: number): void {
    patch({ cameraZoom: clampZoom(zoom) });
  },

  nudgeCameraZoom(delta: number): void {
    const s = getStore().getSnapshot();
    patch({ cameraZoom: clampZoom(s.cameraZoom + delta) });
  },

  setLayoutScale(scale: number): void {
    patch({ layoutScale: clampScale(scale) });
  },

  nudgeLayoutScale(delta: number): void {
    const s = getStore().getSnapshot();
    patch({ layoutScale: clampScale(s.layoutScale + delta) });
  },

  setLateralFloorY(y: number): void {
    patch({ lateralFloorY: clampFloorY(y) });
  },

  nudgeLateralFloorY(delta: number): void {
    const s = getStore().getSnapshot();
    patch({ lateralFloorY: clampFloorY(s.lateralFloorY + delta) });
  },

  setCameraPos(x: number, y: number): void {
    patch({ camX: x, camY: y, panMode: true });
  },

  setPanMode(panMode: boolean): void {
    patch({ panMode });
  },

  centerCamera(): void {
    const entry = getMapViewportCatalogEntry(getStore().getSnapshot().catalogId);
    if (!entry) return;
    patch({
      camX: entry.worldWidth / 2,
      camY: entry.worldHeight / 2,
      panMode: true,
    });
  },

  resetTest(): void {
    const s = getStore().getSnapshot();
    loadOfficialFor(s.catalogId);
    patch({
      filterMode: 'official',
      roundPixelsOverride: null,
      simWidth: null,
      simHeight: null,
      showGrid: false,
      showGroundGuide: false,
      showWorldBounds: false,
      showCameraBounds: false,
      showViewportBounds: false,
      panMode: false,
    });
  },

  setFlag<K extends keyof MapViewportLabState>(key: K, value: MapViewportLabState[K]): void {
    patch({ [key]: value } as Partial<MapViewportLabState>);
  },

  setSimResolution(width: number | null, height: number | null): void {
    patch({ simWidth: width, simHeight: height });
  },

  saveSlot(slot: 'A' | 'B'): void {
    const s = getStore().getSnapshot();
    const snap: MapViewportSnapshot = {
      cameraZoom: s.cameraZoom,
      layoutScale: s.layoutScale,
      camX: s.camX,
      camY: s.camY,
    };
    patch(slot === 'A' ? { slotA: snap } : { slotB: snap });
  },

  loadSlot(slot: 'A' | 'B'): void {
    const s = getStore().getSnapshot();
    const snap = slot === 'A' ? s.slotA : s.slotB;
    if (!snap) return;
    patch({
      cameraZoom: snap.cameraZoom,
      layoutScale: snap.layoutScale,
      camX: snap.camX,
      camY: snap.camY,
      panMode: true,
    });
  },

  setDiagnostics(diagnostics: MapViewportDiagnostics): void {
    const prev = getStore().getSnapshot().diagnostics;
    if (
      prev &&
      prev.canvasW === diagnostics.canvasW &&
      prev.canvasH === diagnostics.canvasH &&
      prev.viewportW === diagnostics.viewportW &&
      prev.viewportH === diagnostics.viewportH &&
      prev.cameraX === diagnostics.cameraX &&
      prev.cameraY === diagnostics.cameraY &&
      prev.cameraZoom === diagnostics.cameraZoom &&
      prev.roundPixels === diagnostics.roundPixels &&
      prev.dpr === diagnostics.dpr &&
      prev.sourcePxPerScreenPx === diagnostics.sourcePxPerScreenPx &&
      prev.quality === diagnostics.quality &&
      prev.fitMode === diagnostics.fitMode &&
      prev.mapFilter === diagnostics.mapFilter &&
      prev.characterWorldScale === diagnostics.characterWorldScale &&
      prev.screenX === diagnostics.screenX &&
      prev.screenY === diagnostics.screenY &&
      prev.worldX === diagnostics.worldX &&
      prev.worldY === diagnostics.worldY
    ) {
      return;
    }
    patch({ diagnostics });
  },

  markOfficialSaved(
    layoutScale: number,
    cameraZoom: number | null,
    lateralFloorY?: number | null,
  ): void {
    const zoom = cameraZoom ?? getStore().getSnapshot().cameraZoom;
    const floor =
      lateralFloorY !== undefined && lateralFloorY != null
        ? clampFloorY(lateralFloorY)
        : getStore().getSnapshot().lateralFloorY;
    patch({
      officialLayoutScale: layoutScale,
      officialCameraZoom: cameraZoom,
      officialLateralFloorY: lateralFloorY === undefined ? getStore().getSnapshot().officialLateralFloorY : lateralFloorY,
      layoutScale,
      cameraZoom: zoom,
      lateralFloorY: floor,
      committedLayoutScale: layoutScale,
      committedCameraZoom: zoom,
      committedLateralFloorY: floor,
    });
  },

  /** Cover/contain: sincroniza baseline com zoom real da câmera uma vez. */
  syncComputedZoomBaseline(zoom: number): void {
    const s = getStore().getSnapshot();
    if (s.officialCameraZoom != null) return;
    if (Math.abs(s.committedCameraZoom - s.cameraZoom) > 0.001) return;
    const z = clampZoom(zoom);
    if (Math.abs(s.cameraZoom - z) < 0.001 && Math.abs(s.committedCameraZoom - z) < 0.001) {
      return;
    }
    patch({
      cameraZoom: z,
      committedCameraZoom: z,
    });
  },

  isDirty(): boolean {
    const s = getStore().getSnapshot();
    return (
      Math.abs(s.layoutScale - s.committedLayoutScale) > 0.001 ||
      Math.abs(s.cameraZoom - s.committedCameraZoom) > 0.001 ||
      Math.abs(s.lateralFloorY - s.committedLateralFloorY) > 0.5
    );
  },

  /** Overrides aplicados pela GameScene quando active. */
  getLiveOverrides(): {
    active: boolean;
    catalogId: string;
    mapKey: string;
    cameraZoom: number;
    layoutScale: number;
    lateralFloorY: number | null;
    camX: number;
    camY: number;
    panMode: boolean;
    showGrid: boolean;
    showCharacter: boolean;
    showGroundGuide: boolean;
    showWorldBounds: boolean;
    showCameraBounds: boolean;
    showViewportBounds: boolean;
    filterMode: MapFilterMode;
    roundPixelsOverride: boolean | null;
    simWidth: number | null;
    simHeight: number | null;
  } | null {
    const s = getStore().getSnapshot();
    if (!s.active) return null;
    const entry = getMapViewportCatalogEntry(s.catalogId);
    return {
      active: true,
      catalogId: s.catalogId,
      mapKey: String(s.mapKey),
      cameraZoom: s.cameraZoom,
      layoutScale: s.layoutScale,
      lateralFloorY: entry?.lateralFloorY != null || s.officialLateralFloorY != null ? s.lateralFloorY : null,
      camX: s.camX,
      camY: s.camY,
      panMode: s.panMode,
      showGrid: s.showGrid,
      showCharacter: s.showCharacter,
      showGroundGuide: s.showGroundGuide,
      showWorldBounds: s.showWorldBounds,
      showCameraBounds: s.showCameraBounds,
      showViewportBounds: s.showViewportBounds,
      filterMode: s.filterMode,
      roundPixelsOverride: s.roundPixelsOverride,
      simWidth: s.simWidth,
      simHeight: s.simHeight,
    };
  },
};

/** Evita tree-shake do defaultDiagnostics em builds estranhos. */
void defaultDiagnostics;
