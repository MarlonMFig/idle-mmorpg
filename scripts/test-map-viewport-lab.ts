/**
 * Smoke test: patch/read map config in wonsr-rendered-maps (dry parse).
 * Run: npx --yes tsx scripts/test-map-viewport-lab.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  patchMapSource,
  readMapConfigFromSource,
} from '../src/lib/dev/patch-map-source';
import { diagnosePixelDensity } from '../src/lib/dev/map-viewport-catalog';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const dens = diagnosePixelDensity(2);
assert(dens.band === 'EXCELENTE' && dens.downscale, '2.0 dens');
assert(diagnosePixelDensity(0.5).band === 'AMPLIADO', '0.5 ampliado');

const abs = path.resolve('src/data/wonsr-rendered-maps.ts');
const original = fs.readFileSync(abs, 'utf8');
const before = readMapConfigFromSource('wonsr', 'huntTesteFarmWonsr');
assert(before.layoutScale != null, 'clareira tem layoutScale');

const patched = patchMapSource({
  mapKey: 'huntTesteFarmWonsr',
  target: 'wonsr',
  layoutScale: 3.1,
  cameraZoom: 0.55,
});
assert(patched.source.includes('layoutScale: 3.1'), 'layout in patch');
assert(patched.source.includes('cameraZoom: 0.55'), 'zoom in patch');

// Não grava — só valida parser. Restaura mentalmente.
assert(original.includes('huntTesteFarmWonsr'), 'mapa existe');

console.log('PASS map-viewport-lab smoke');
