/**
 * Strict sprite QA for Chouji HQ pack (green chroma residual + meta dims).
 *
 *   node scripts/qa-chouji-sprites.js
 *   npm run chouji:qa
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { isGreenBg } = require('./lib/chroma-green-bg');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'sprites', 'player', 'chouji');
const META = path.join(OUT, 'meta.json');
const ALPHA = 16;

function greenness(r, g, b) {
  return g - Math.max(r, b);
}

const SHEETS = [
  { file: 'idle.png', metaKey: 'chouji-idle', minOpaque: 100, checkFeet: true },
  { file: 'walk.png', metaKey: 'chouji-walk', minOpaque: 80, checkFeet: true },
  { file: 'combo1.png', metaKey: 'chouji-combo1', minOpaque: 80, checkFeet: false },
  { file: 'combo2.png', metaKey: 'chouji-combo2', minOpaque: 80, checkFeet: false },
  { file: 'combo3.png', metaKey: 'chouji-combo3', minOpaque: 80, checkFeet: false },
  {
    file: 'nikudan-sensha.png',
    metaKey: 'chouji-nikudan-sensha',
    minOpaque: 60,
    checkFeet: false,
  },
];

async function analyzeStrip(file, fw, fh, n, minOpaque, checkFeet) {
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
  const feetY = [];
  const contentH = [];

  for (let f = 0; f < n; f += 1) {
    let op = 0;
    let minY = fh;
    let maxY = -1;
    let maxFoot = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * info.width + f * fw + x) * 4;
        if (data[i + 3] < ALPHA) continue;
        op += 1;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (isGreenBg(r, g, b) && greenness(r, g, b) >= 18) residualGreen += 1;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (y > maxFoot) maxFoot = y;
      }
    }
    frameOpaque.push(op);
    if (op < minOpaque) errors.push(`${file} f${f}: opaque ${op} < ${minOpaque}`);
    if (maxY >= 0) contentH.push(maxY - minY + 1);
    if (checkFeet && maxFoot >= 0) feetY.push(maxFoot);
  }

  if (residualGreen > 0) {
    errors.push(`${file}: residualGreen=${residualGreen}`);
  }
  if (checkFeet && feetY.length) {
    const spread = Math.max(...feetY) - Math.min(...feetY);
    if (spread > 4) errors.push(`${file}: footSpread=${spread} > 4`);
  }

  return {
    file,
    errors,
    residualGreen,
    contentHMin: contentH.length ? Math.min(...contentH) : 0,
    contentHMax: contentH.length ? Math.max(...contentH) : 0,
  };
}

async function main() {
  if (!fs.existsSync(META)) throw new Error(`missing ${META}`);
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const idleH = meta['chouji-idle']?.contentHeight;
  if (!(idleH > 0)) throw new Error('chouji-idle.contentHeight missing');

  const allErrors = [];
  for (const sheet of SHEETS) {
    const entry = meta[sheet.metaKey];
    if (!entry) {
      allErrors.push(`missing meta ${sheet.metaKey}`);
      continue;
    }
    if (entry.contentHeight !== idleH) {
      allErrors.push(
        `${sheet.metaKey}: contentHeight ${entry.contentHeight} != idle ${idleH}`,
      );
    }
    const result = await analyzeStrip(
      sheet.file,
      entry.frameWidth,
      entry.frameHeight,
      entry.frameCount,
      sheet.minOpaque,
      sheet.checkFeet,
    );
    for (const e of result.errors) allErrors.push(e);
    console.log(
      `OK ${sheet.file} fw=${entry.frameWidth} fh=${entry.frameHeight} n=${entry.frameCount} contentH=${entry.contentHeight} body~${result.contentHMin}-${result.contentHMax} green=${result.residualGreen}`,
    );
  }

  if (allErrors.length) {
    console.error('FAIL');
    for (const e of allErrors) console.error(' -', e);
    process.exit(1);
  }
  console.log(`PASS chouji HQ contentHeight=${idleH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
