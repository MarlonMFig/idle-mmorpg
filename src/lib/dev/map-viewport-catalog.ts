import { HUB_CHARACTER_SCALE } from '@/constants/sprites';
import { getActiveHub } from '@/data/hub-backgrounds';
import {
  combatLayoutScale,
  getWonsrRenderedMap,
  listWonsrRenderedMaps,
} from '@/data/wonsr-rendered-maps';
import { MAP_FILES, MAP_KEYS, type MapKey } from '@/maps/map-registry';
import { getDevMapConfig } from '@/lib/dev/dev-runtime-registry';

export type MapLabKind = 'HUB' | 'HUNT' | 'OUTRO';

export interface MapLabCatalogEntry {
  id: string;
  mapKey: MapKey;
  label: string;
  kind: MapLabKind;
  /** Modo ao viajar (`hub` ou `combat`). */
  travelMode: 'hub' | 'combat';
  assetKey: string;
  assetUrl: string;
  assetWidth: number;
  assetHeight: number;
  worldWidth: number;
  worldHeight: number;
  /** Oficial (fonte + overlay DEV). */
  layoutScale: number;
  /** Oficial; null = zoom derivado (cover/contain). */
  cameraZoom: number | null;
  /** Chão dos pés (hub / hunts laterais). null = N/A. */
  lateralFloorY: number | null;
  cameraFollow: boolean;
  cameraFit: 'contain' | null;
  cameraMode: string;
  hasForeground: boolean;
  defaultFilter: 'nearest' | 'linear';
}

function kindForMapKey(mapKey: MapKey): MapLabKind {
  if (
    mapKey === MAP_KEYS.leafVillage ||
    mapKey === MAP_KEYS.leafVillageHub ||
    mapKey === MAP_KEYS.hubInterdimensional
  ) {
    return 'HUB';
  }
  if (mapKey.startsWith('hunt') || mapKey === MAP_KEYS.forest || mapKey === MAP_KEYS.academy || mapKey === MAP_KEYS.wonsrFarmAnbu || mapKey === MAP_KEYS.wonsrKonoha) {
    return 'HUNT';
  }
  return 'OUTRO';
}

function labelFor(mapKey: MapKey, kind: MapLabKind): string {
  if (kind === 'HUB') return 'Hub Interdimensional';
  return mapKey
    .replace(/^hunt/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function resolveOfficial(
  mapKey: MapKey,
  base: { layoutScale: number; cameraZoom: number | null; lateralFloorY: number | null },
): { layoutScale: number; cameraZoom: number | null; lateralFloorY: number | null } {
  const overlay = getDevMapConfig(mapKey);
  return {
    layoutScale: overlay?.layoutScale ?? base.layoutScale,
    cameraZoom: overlay?.cameraZoom !== undefined ? overlay.cameraZoom : base.cameraZoom,
    lateralFloorY:
      overlay?.lateralFloorY !== undefined ? overlay.lateralFloorY : base.lateralFloorY,
  };
}

/** Catálogo DEV: hub ativo + todos os mapas WONSR renderizados. */
export function listMapViewportCatalog(): MapLabCatalogEntry[] {
  const hub = getActiveHub();
  const hubKey = hub.tilemapKey ?? MAP_KEYS.hubInterdimensional;
  const hubOfficial = resolveOfficial(hubKey, {
    layoutScale: hub.layoutScale ?? HUB_CHARACTER_SCALE,
    cameraZoom: hub.cameraZoom ?? null,
    lateralFloorY: hub.lateralFloorY ?? null,
  });

  const hubEntry: MapLabCatalogEntry = {
    id: 'hub',
    mapKey: hubKey,
    label: 'Hub Interdimensional',
    kind: 'HUB',
    travelMode: 'hub',
    assetKey: hub.tilemapImageKey ?? hub.key,
    assetUrl: hub.tilemapImageUrl ?? hub.url,
    assetWidth: hub.tilemapWidth ?? hub.width,
    assetHeight: hub.tilemapHeight ?? hub.height,
    worldWidth: hub.tilemapWidth ?? hub.width,
    worldHeight: hub.tilemapHeight ?? hub.height,
    layoutScale: hubOfficial.layoutScale,
    cameraZoom: hubOfficial.cameraZoom,
    lateralFloorY: hubOfficial.lateralFloorY,
    cameraFollow: hub.cameraMode === 'follow',
    cameraFit: hub.cameraMode === 'contain' ? 'contain' : null,
    cameraMode: hub.cameraMode ?? 'cover',
    hasForeground: false,
    defaultFilter: 'linear',
  };

  const hunts = listWonsrRenderedMaps().map((m) => {
    const kind = kindForMapKey(m.mapKey);
    const official = resolveOfficial(m.mapKey, {
      layoutScale: combatLayoutScale(m.mapKey),
      cameraZoom: m.cameraZoom ?? null,
      lateralFloorY: m.lateralFloorY ?? null,
    });
    return {
      id: m.mapKey,
      mapKey: m.mapKey,
      label: labelFor(m.mapKey, kind),
      kind,
      travelMode: 'combat' as const,
      assetKey: m.imageKey,
      assetUrl: m.imageUrl,
      assetWidth: m.width,
      assetHeight: m.height,
      worldWidth: m.width,
      worldHeight: m.height,
      layoutScale: official.layoutScale,
      cameraZoom: official.cameraZoom,
      lateralFloorY: official.lateralFloorY,
      cameraFollow: m.cameraFollow === true,
      cameraFit: m.cameraFit === 'contain' ? ('contain' as const) : null,
      cameraMode: m.cameraFollow
        ? m.cameraFit === 'contain'
          ? 'follow-contain'
          : 'follow-explore'
        : 'contain-combat',
      hasForeground: Boolean(m.foregroundKey),
      defaultFilter: m.foregroundKey ? ('nearest' as const) : ('linear' as const),
    };
  });

  return [hubEntry, ...hunts];
}

export function getMapViewportCatalogEntry(id: string): MapLabCatalogEntry | undefined {
  return listMapViewportCatalog().find((e) => e.id === id || e.mapKey === id);
}

export function mapTmxUrl(mapKey: MapKey): string {
  return MAP_FILES[mapKey] ?? '';
}

/** Aspect ratio amigável a partir de W×H. */
export function formatAspectRatio(width: number, height: number): string {
  if (!(width > 0 && height > 0)) return '—';
  const g = gcd(Math.round(width), Math.round(height));
  const a = Math.round(width) / g;
  const b = Math.round(height) / g;
  const ratio = width / height;
  if (Math.abs(ratio - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(ratio - 16 / 10) < 0.02) return '16:10';
  if (Math.abs(ratio - 21 / 9) < 0.03) return '21:9';
  if (Math.abs(ratio - 1) < 0.02) return '1:1';
  if (a <= 32 && b <= 32) return `${a}:${b}`;
  return `${ratio.toFixed(2)}:1`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 1;
  while (y) {
    const t = y;
    y = x % y;
    x = t;
    if (!Number.isFinite(y)) return 1;
  }
  return x || 1;
}

export type QualityBand = 'EXCELENTE' | 'BOA' | 'LIMITE' | 'AMPLIADO';

/**
 * Densidade aproximada: pixels de asset por pixel de tela no eixo X,
 * com o zoom atual (1/zoom ≈ world px por screen px se asset 1:1 world).
 */
export function diagnosePixelDensity(sourcePxPerScreenPx: number): {
  band: QualityBand;
  upscale: boolean;
  downscale: boolean;
} {
  const dens = sourcePxPerScreenPx;
  let band: QualityBand;
  if (dens >= 1.6) band = 'EXCELENTE';
  else if (dens >= 1.15) band = 'BOA';
  else if (dens >= 0.95) band = 'LIMITE';
  else band = 'AMPLIADO';
  return {
    band,
    upscale: dens < 0.98,
    downscale: dens > 1.05,
  };
}
