import type { TiledLayerJson, TiledMapJson, TiledTilesetJson } from '@/maps/tiled-types';

function attr(el: Element, name: string, fallback = ''): string {
  return el.getAttribute(name) ?? fallback;
}

function num(el: Element, name: string, fallback = 0): number {
  const raw = el.getAttribute(name);
  if (raw == null || raw === '') return fallback;
  return Number(raw);
}

function parseCsvData(text: string, expected: number): number[] {
  const values = text
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => Number(v));

  if (values.length < expected) {
    throw new Error(`TMX CSV incompleto: ${values.length}/${expected}`);
  }

  return values.slice(0, expected);
}

function resolveImageUrl(tmxUrl: string, imageSource: string): string {
  if (imageSource.startsWith('/') || /^https?:/i.test(imageSource)) {
    return imageSource;
  }

  const base = tmxUrl.replace(/[^/]+$/, '');
  const parts = `${base}${imageSource}`.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return `/${out.join('/')}`.replace(/\/+/g, '/');
}

function parseTileset(el: Element, tmxUrl: string): TiledTilesetJson {
  const imageEl = el.querySelector('image');
  if (!imageEl) {
    throw new Error(`Tileset "${attr(el, 'name')}" sem <image>`);
  }

  const source = attr(imageEl, 'source');
  return {
    firstgid: num(el, 'firstgid', 1),
    name: attr(el, 'name', 'tileset'),
    tilewidth: num(el, 'tilewidth', 32),
    tileheight: num(el, 'tileheight', 32),
    tilecount: num(el, 'tilecount'),
    columns: num(el, 'columns'),
    image: resolveImageUrl(tmxUrl, source),
    imagewidth: num(imageEl, 'width'),
    imageheight: num(imageEl, 'height'),
    margin: num(el, 'margin'),
    spacing: num(el, 'spacing'),
  };
}

function parseTileLayer(el: Element): TiledLayerJson {
  const width = num(el, 'width');
  const height = num(el, 'height');
  const dataEl = el.querySelector('data');
  if (!dataEl) throw new Error(`Layer "${attr(el, 'name')}" sem <data>`);

  const encoding = attr(dataEl, 'encoding', 'csv');
  if (encoding !== 'csv') {
    throw new Error(`Encoding TMX não suportado: ${encoding} (use CSV)`);
  }

  return {
    id: num(el, 'id'),
    name: attr(el, 'name', 'layer'),
    type: 'tilelayer',
    width,
    height,
    visible: attr(el, 'visible', '1') !== '0',
    opacity: num(el, 'opacity', 1),
    x: num(el, 'x'),
    y: num(el, 'y'),
    data: parseCsvData(dataEl.textContent ?? '', width * height),
  };
}

function parseTilesets(mapEl: Element, tmxUrl: string): TiledTilesetJson[] {
  return Array.from(mapEl.children)
    .filter((el) => el.tagName.toLowerCase() === 'tileset')
    .map((el) => parseTileset(el, tmxUrl));
}

function parseTileLayers(mapEl: Element): TiledLayerJson[] {
  return Array.from(mapEl.children)
    .filter((el) => el.tagName.toLowerCase() === 'layer')
    .map((el) => parseTileLayer(el));
}

/** Converte XML TMX (ortogonal + CSV) para JSON Tiled consumível pelo Phaser. */
export function parseTmxXml(xmlText: string, tmxUrl: string): TiledMapJson {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const mapEl = doc.querySelector('map');
  if (!mapEl) throw new Error(`TMX inválido: ${tmxUrl}`);

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`Falha ao parsear TMX: ${tmxUrl}`);
  }

  const tilesets = parseTilesets(mapEl, tmxUrl);
  const layers = parseTileLayers(mapEl);

  if (layers.length === 0) {
    throw new Error(`TMX sem tile layers: ${tmxUrl}`);
  }

  return {
    compressionlevel: -1,
    height: num(mapEl, 'height'),
    width: num(mapEl, 'width'),
    tilewidth: num(mapEl, 'tilewidth', 32),
    tileheight: num(mapEl, 'tileheight', 32),
    infinite: attr(mapEl, 'infinite', '0') === '1',
    orientation: attr(mapEl, 'orientation', 'orthogonal'),
    renderorder: attr(mapEl, 'renderorder', 'right-down'),
    type: 'map',
    version: attr(mapEl, 'version', '1.10'),
    tiledversion: attr(mapEl, 'tiledversion', '1.10.2'),
    nextlayerid: num(mapEl, 'nextlayerid', layers.length + 1),
    nextobjectid: num(mapEl, 'nextobjectid', 1),
    layers,
    tilesets,
  };
}
