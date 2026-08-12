/**
 * Strict sprite QA for Naruto Shippuden packed sheets.
 * Exit 1 if any defect is found — re-process until clean.
 *
 *   node scripts/qa-naruto-shippuden-sprites.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { isChromaGreen } = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'sprites', 'player', 'naruto-shippuden');
const META = path.join(OUT, 'meta.json');
const ALPHA = 16;

const SHEETS = [
  { file: 'walk.png', metaKey: 'naruto-shippuden-walk', minOpaque: 80 },
  { file: 'idle.png', metaKey: 'naruto-shippuden-idle', minOpaque: 100 },
  { file: 'combo1.png', metaKey: 'naruto-shippuden-combo1', minOpaque: 80 },
  { file: 'combo2.png', metaKey: 'naruto-shippuden-combo2', minOpaque: 80 },
  { file: 'combo3.png', metaKey: 'naruto-shippuden-combo3', minOpaque: 80 },
  { file: 'hurt.png', metaKey: 'naruto-shippuden-hurt', minOpaque: 60 },
  { file: 'death.png', metaKey: 'naruto-shippuden-death', minOpaque: 40 },
  { file: 'rasengan-shippuden.png', metaKey: 'naruto-shippuden-rasengan', minOpaque: 40 },
];

async function analyzeStrip(file, fw, fh, n, minOpaque) {
  const filePath = path.join(OUT, file);
  if (!fs.existsSync(filePath)) {
    return { file, errors: [`missing file ${file}`] };
  }
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const errors = [];
  if (info.width !== fw * n) {
    errors.push(`${file}: width ${info.width} != fw*n ${fw * n}`);
  }
  if (info.height !== fh) {
    errors.push(`${file}: height ${info.height} != fh ${fh}`);
  }

  let residualGreen = 0;
  const frameOpaque = [];
  const feetX = [];
  const contentH = [];

  for (let f = 0; f < n; f += 1) {
    let op = 0;
    let minX = fw;
    let maxX = -1;
    let minY = fh;
    let maxY = -1;
    // Foot mass center (same metric as packer feet lock) — not densest-column
    // which swings between L/R foot during gait.
    let footSumX = 0;
    let footN = 0;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * info.width + f * fw + x) * 4;
        if (data[i + 3] < ALPHA) continue;
        op += 1;
        if (isChromaGreen(data[i], data[i + 1], data[i + 2])) residualGreen += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY >= 0) {
      const y0 = Math.max(0, maxY - 4);
      for (let y = y0; y <= maxY; y += 1) {
        for (let x = 0; x < fw; x += 1) {
          const i = (y * info.width + f * fw + x) * 4;
          if (data[i + 3] < ALPHA) continue;
          footSumX += x;
          footN += 1;
        }
      }
    }
    frameOpaque.push(op);
    if (op < minOpaque) {
      errors.push(`${file} f${f}: opaque ${op} < min ${minOpaque}`);
    }
    if (maxX < 0) {
      errors.push(`${file} f${f}: empty bbox`);
      contentH.push(0);
      feetX.push(fw / 2);
      continue;
    }
    contentH.push(maxY - minY + 1);
    feetX.push(footN > 0 ? footSumX / footN : (minX + maxX) / 2);
  }

  if (residualGreen > 0) {
    errors.push(`${file}: residualGreen=${residualGreen}`);
  }

  // Walk / idle: feet X must not slide hard (visual wobble).
  if (file === 'walk.png' || file === 'idle.png') {
    const mean = feetX.reduce((a, b) => a + b, 0) / feetX.length;
    const maxDrift = Math.max(...feetX.map((x) => Math.abs(x - mean)));
    // Feet-lock should hold mass center within ~1.5px; allow slight round error.
    if (maxDrift > 1.6) {
      errors.push(
        `${file}: feet mass X drift ${maxDrift.toFixed(2)}px > 1.6 (values ${feetX
          .map((x) => x.toFixed(1))
          .join(',')})`,
      );
    }
    const hMin = Math.min(...contentH.filter((h) => h > 0));
    const hMax = Math.max(...contentH);
    // Idle breath / walk bounce: small vertical content change is normal.
    if (hMax - hMin > 12) {
      errors.push(`${file}: contentH variance ${hMin}–${hMax} (>12)`);
    }
  }

  // Check outer edge of whole sheet is fully transparent (no garbage margins).
  let rimOpaque = 0;
  for (let x = 0; x < info.width; x += 1) {
    for (const y of [0, info.height - 1]) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3] >= ALPHA) rimOpaque += 1;
    }
  }
  for (let y = 0; y < info.height; y += 1) {
    for (const x of [0, info.width - 1]) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3] >= ALPHA) rimOpaque += 1;
    }
  }
  // Allow edge touch on wide jutsu VFX; fail body strips with rim dirt.
  if (!file.includes('rasengan') && rimOpaque > 8) {
    errors.push(`${file}: rim opaque pixels=${rimOpaque} (edge dirt)`);
  }

  return {
    file,
    errors,
    residualGreen,
    frameOpaque,
    feetX,
    contentH,
  };
}

async function main() {
  if (!fs.existsSync(META)) {
    throw new Error(`Missing meta ${META} — run process first`);
  }
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const allErrors = [];
  const reports = [];

  for (const sheet of SHEETS) {
    const m = meta[sheet.metaKey];
    if (!m) {
      allErrors.push(`meta missing key ${sheet.metaKey}`);
      continue;
    }
    const report = await analyzeStrip(
      sheet.file,
      m.frameWidth,
      m.frameHeight,
      m.frameCount,
      sheet.minOpaque,
    );
    reports.push(report);
    allErrors.push(...report.errors);
  }

  for (const r of reports) {
    console.log(
      `OK? ${r.file} green=${r.residualGreen ?? '?'} ops=[${(r.frameOpaque || []).join(',')}]` +
        (r.errors?.length ? ` FAIL×${r.errors.length}` : ' PASS'),
    );
    for (const e of r.errors || []) console.log('  -', e);
  }

  if (allErrors.length) {
    console.error(`\nQA FAILED: ${allErrors.length} defect(s)`);
    process.exit(1);
  }
  console.log('\nQA PASSED: zero sprite defects detected.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
