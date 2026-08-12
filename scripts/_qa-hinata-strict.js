/**
 * Strict QA for Hinata packed sheets — residual green, soft alpha, empty frames,
 * body vs idle shrink, corner flecks.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'sprites', 'player', 'hinata');
const META = JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8'));
const IDLE_CH = META['hinata-idle'].contentHeight;

function isChromaGreen(r, g, b) {
  return g >= 90 && g > r + 25 && g > b + 25 && r <= 120 && b <= 120;
}

async function qaSheet(key, file, fw, fh, n) {
  const p = path.join(OUT, file);
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const issues = [];
  let residualGreen = 0;
  let softAlpha = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 0 && a < 255) softAlpha += 1;
    if (a >= 16 && isChromaGreen(data[i], data[i + 1], data[i + 2])) residualGreen += 1;
  }
  if (residualGreen > 0) issues.push(`residualGreen=${residualGreen}`);
  if (softAlpha > 0) issues.push(`softAlpha=${softAlpha}`);

  for (let f = 0; f < n; f += 1) {
    let opaque = 0;
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * info.width + f * fw + x) * 4;
        if (data[i + 3] < 16) continue;
        opaque += 1;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (opaque < 40) issues.push(`f${f} empty opaque=${opaque}`);
    const bh = maxY >= 0 ? maxY - minY + 1 : 0;
    // Body sheets should not be dramatically shorter than idle (except death).
    if (!/death|fx/i.test(key) && !/combo3/i.test(key) && bh > 0 && bh < IDLE_CH * 0.72) {
      issues.push(`f${f} bodyH=${bh} << idle ${IDLE_CH}`);
    }
  }

  const ok = issues.length === 0;
  console.log(`${ok ? 'OK' : 'FAIL'} ${key} ${info.width}x${info.height} fw=${fw} n=${n}${issues.length ? ' — ' + issues.join('; ') : ''}`);
  return { key, ok, issues };
}

(async () => {
  const checks = [
    ['hinata-idle', 'idle.png'],
    ['hinata-walk', 'walk.png'],
    ['hinata-combo1', 'combo1.png'],
    ['hinata-combo2', 'combo2.png'],
    ['hinata-combo3', 'combo3.png'],
    ['hinata-hurt', 'hurt.png'],
    ['hinata-death', 'death.png'],
    ['hinata-hakke-shou', 'hakke-shou.png'],
    ['hinata-hakke-shou-fx', 'hakke-shou-fx.png'],
  ];
  const results = [];
  for (const [key, file] of checks) {
    const m = META[key];
    if (!m) {
      console.log(`FAIL ${key} missing meta`);
      results.push({ key, ok: false, issues: ['missing meta'] });
      continue;
    }
    results.push(await qaSheet(key, file, m.frameWidth, m.frameHeight, m.frameCount));
  }
  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} OK`);
  if (fails.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
