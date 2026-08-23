import fs from 'node:fs';
import path from 'node:path';
import { assertWritableSourcePath } from '@/lib/dev/find-character-source';
import { writeDevSourceAfterResponse } from '@/lib/dev/write-dev-source';
import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

const WONSR_MAPS_REL = 'src/data/wonsr-rendered-maps.ts';
const HUB_BG_REL = 'src/data/hub-backgrounds.ts';
const HUB_INTERACTABLES_REL = 'src/data/hub-interactables.ts';

export interface MapSourcePatch {
  mapKey: MapKey | string;
  layoutScale?: number;
  cameraZoom?: number | null;
  lateralFloorY?: number;
  /** Hub ativo (grava hub-backgrounds). */
  target: 'wonsr' | 'hub';
}

export interface MapSourcePatchResult {
  relativePath: string;
  absPath: string;
  source: string;
  applied: string[];
}

function absFromRel(rel: string): string {
  const abs = path.resolve(process.cwd(), rel);
  assertWritableSourcePath(abs);
  return abs;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const rounded = Math.round(n * 1000) / 1000;
  return String(rounded);
}

/**
 * Localiza o bloco `[MAP_KEYS.xxx]: { ... },` no fonte (nível superior do objeto).
 */
function findMapBlock(source: string, mapKey: string): { start: number; end: number; body: string } {
  const needle = `[MAP_KEYS.${mapKey}]:`;
  const idx = source.indexOf(needle);
  if (idx < 0) throw new Error(`Bloco MAP_KEYS.${mapKey} não encontrado`);
  const brace = source.indexOf('{', idx);
  if (brace < 0) throw new Error(`Abertura { ausente para ${mapKey}`);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start: brace, end: i + 1, body: source.slice(brace, i + 1) };
      }
    }
  }
  throw new Error(`Bloco ${mapKey} sem fechamento`);
}

function upsertNumericField(body: string, field: string, value: number | null | undefined): string {
  if (value === undefined) return body;
  const re = new RegExp(`(${field}\\s*:\\s*)(-?\\d+(?:\\.\\d+)?)`);
  if (value === null) {
    // Remove campo cameraZoom se null (volta ao derivado).
    return body.replace(new RegExp(`\\n\\s*${field}\\s*:\\s*-?\\d+(?:\\.\\d+)?,?`, 'g'), '');
  }
  const formatted = formatNum(value);
  if (re.test(body)) {
    return body.replace(re, `$1${formatted}`);
  }
  // Inserir antes do fechamento do bloco, após layoutScale se existir, senão no fim.
  const layoutMatch = body.match(/layoutScale\s*:\s*-?\d+(?:\.\d+)?,?/);
  if (layoutMatch && layoutMatch.index != null) {
    const insertAt = layoutMatch.index + layoutMatch[0].length;
    return `${body.slice(0, insertAt)}\n    ${field}: ${formatted},${body.slice(insertAt)}`;
  }
  const close = body.lastIndexOf('}');
  return `${body.slice(0, close)}    ${field}: ${formatted},\n${body.slice(close)}`;
}

function patchWonsrMap(
  source: string,
  mapKey: string,
  layoutScale?: number,
  cameraZoom?: number | null,
  lateralFloorY?: number,
): { source: string; applied: string[] } {
  const block = findMapBlock(source, mapKey);
  let body = block.body;
  const applied: string[] = [];
  if (layoutScale !== undefined) {
    body = upsertNumericField(body, 'layoutScale', layoutScale);
    applied.push(`layoutScale=${formatNum(layoutScale)}`);
  }
  if (cameraZoom !== undefined) {
    body = upsertNumericField(body, 'cameraZoom', cameraZoom);
    applied.push(
      cameraZoom === null ? 'cameraZoom=(removed)' : `cameraZoom=${formatNum(cameraZoom)}`,
    );
  }
  if (lateralFloorY !== undefined) {
    body = upsertNumericField(body, 'lateralFloorY', lateralFloorY);
    applied.push(`lateralFloorY=${formatNum(lateralFloorY)}`);
  }
  return {
    source: source.slice(0, block.start) + body + source.slice(block.end),
    applied,
  };
}

function patchHubBackground(
  source: string,
  layoutScale?: number,
  cameraZoom?: number | null,
  lateralFloorY?: number,
): { source: string; applied: string[] } {
  const applied: string[] = [];
  let patchedFloorConst = false;
  if (lateralFloorY !== undefined) {
    const constRe = /(const HUB_FLOOR_Y\s*=\s*)(-?\d+(?:\.\d+)?)/;
    if (constRe.test(source)) {
      source = source.replace(constRe, `$1${formatNum(lateralFloorY)}`);
      applied.push(`HUB_FLOOR_Y=${formatNum(lateralFloorY)}`);
      patchedFloorConst = true;
    }
  }

  const marker = '[HUB_KEYS.interdimensional]:';
  const idx = source.indexOf(marker);
  if (idx < 0) throw new Error('Hub interdimensional não encontrado');
  const brace = source.indexOf('{', idx);
  let depth = 0;
  let end = -1;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) throw new Error('Hub block sem fechamento');
  let body = source.slice(brace, end);
  if (layoutScale !== undefined) {
    body = upsertNumericField(body, 'layoutScale', layoutScale);
    applied.push(`layoutScale=${formatNum(layoutScale)}`);
  }
  if (cameraZoom !== undefined) {
    body = upsertNumericField(body, 'cameraZoom', cameraZoom);
    applied.push(
      cameraZoom === null ? 'cameraZoom=(removed)' : `cameraZoom=${formatNum(cameraZoom)}`,
    );
  }
  if (lateralFloorY !== undefined && !patchedFloorConst) {
    body = upsertNumericField(body, 'lateralFloorY', lateralFloorY);
    applied.push(`lateralFloorY=${formatNum(lateralFloorY)}`);
  }
  return {
    source: source.slice(0, brace) + body + source.slice(end),
    applied,
  };
}

export function readMapConfigFromSource(
  target: 'wonsr' | 'hub',
  mapKey: string,
): { layoutScale: number | null; cameraZoom: number | null; lateralFloorY: number | null } {
  const rel = target === 'hub' ? HUB_BG_REL : WONSR_MAPS_REL;
  const abs = absFromRel(rel);
  const source = fs.readFileSync(abs, 'utf8');
  let body: string;
  if (target === 'hub') {
    const floorConst = source.match(/const HUB_FLOOR_Y\s*=\s*(-?\d+(?:\.\d+)?)/);
    const marker = '[HUB_KEYS.interdimensional]:';
    const idx = source.indexOf(marker);
    if (idx < 0) {
      return {
        layoutScale: null,
        cameraZoom: null,
        lateralFloorY: floorConst ? Number(floorConst[1]) : null,
      };
    }
    const brace = source.indexOf('{', idx);
    let depth = 0;
    let end = brace;
    for (let i = brace; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    body = source.slice(brace, end);
    const layout = body.match(/layoutScale\s*:\s*(-?\d+(?:\.\d+)?)/);
    const zoom = body.match(/cameraZoom\s*:\s*(-?\d+(?:\.\d+)?)/);
    const floor = body.match(/lateralFloorY\s*:\s*(-?\d+(?:\.\d+)?)/);
    return {
      layoutScale: layout ? Number(layout[1]) : null,
      cameraZoom: zoom ? Number(zoom[1]) : null,
      lateralFloorY: floorConst
        ? Number(floorConst[1])
        : floor
          ? Number(floor[1])
          : null,
    };
  } else {
    body = findMapBlock(source, mapKey).body;
  }
  const layout = body.match(/layoutScale\s*:\s*(-?\d+(?:\.\d+)?)/);
  const zoom = body.match(/cameraZoom\s*:\s*(-?\d+(?:\.\d+)?)/);
  const floor = body.match(/lateralFloorY\s*:\s*(-?\d+(?:\.\d+)?)/);
  return {
    layoutScale: layout ? Number(layout[1]) : null,
    cameraZoom: zoom ? Number(zoom[1]) : null,
    lateralFloorY: floor ? Number(floor[1]) : null,
  };
}

export function patchMapSource(input: MapSourcePatch): MapSourcePatchResult {
  const rel = input.target === 'hub' ? HUB_BG_REL : WONSR_MAPS_REL;
  const abs = absFromRel(rel);
  let source = fs.readFileSync(abs, 'utf8');
  let applied: string[] = [];

  if (input.target === 'hub') {
    const result = patchHubBackground(
      source,
      input.layoutScale,
      input.cameraZoom,
      input.lateralFloorY,
    );
    source = result.source;
    applied = result.applied;
    if (input.lateralFloorY !== undefined) {
      const interactAbs = absFromRel(HUB_INTERACTABLES_REL);
      let interact = fs.readFileSync(interactAbs, 'utf8');
      const baseRe = /(const HUB_BUILDING_BASE\s*=\s*)(-?\d+(?:\.\d+)?)/;
      if (baseRe.test(interact)) {
        interact = interact.replace(baseRe, `$1${formatNum(input.lateralFloorY)}`);
        writeDevSourceAfterResponse(interactAbs, interact);
        applied.push(`HUB_BUILDING_BASE=${formatNum(input.lateralFloorY)}`);
      }
    }
  } else {
    const key = String(input.mapKey);
    if (!(key in MAP_KEYS) && !Object.values(MAP_KEYS).includes(key as MapKey)) {
      // mapKey is the value string e.g. huntTesteFarmWonsr
    }
    const result = patchWonsrMap(
      source,
      key,
      input.layoutScale,
      input.cameraZoom,
      input.lateralFloorY,
    );
    source = result.source;
    applied = result.applied;
  }

  return { relativePath: rel, absPath: abs, source, applied };
}
