/**
 * Strict sprite QA for Piccolo packed sheets.
 * Namekian green skin is allowed; only strict screen-green fails.
 *
 *   node scripts/qa-piccolo-sprites.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'sprites', 'player', 'piccolo');
const META = path.join(OUT, 'meta.json');
const ALPHA = 16;
const MAX_FEET_DRIFT = 2.5;
const MAX_CONTENT_H_SPREAD = 14;

/** Lime screen only — not Namekian (33,107,66). */
function isStrictScreenGreen(r, g, b) {
  return g >= 200 && r <= 40 && b <= 40 && g >= r + 140 && g >= b + 140;
}

const SHEETS = [
  { file: 'walk.png', metaKey: 'piccolo-walk', minOpaque: 80, checkFeet: true },
  { file: 'idle.png', metaKey: 'piccolo-idle', minOpaque: 100, checkFeet: true },
  { file: 'combo1.png', metaKey: 'piccolo-combo1', minOpaque: 80, checkFeet: false },
  { file: 'combo2.png', metaKey: 'piccolo-combo2', minOpaque: 80, checkFeet: false },
  { file: 'combo3.png', metaKey: 'piccolo-combo3', minOpaque: 80, checkFeet: false },
  { file: 'hurt.png', metaKey: 'piccolo-hurt', minOpaque: 60, checkFeet: false },
  { file: 'death.png', metaKey: 'piccolo-death', minOpaque: 40, checkFeet: false },
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
  let namekianGreen = 0;
  const frameOpaque = [];
  const feetX = [];
  const contentH = [];

  for (let f = 0; f < n; f += 1) {
    let op = 0;
    let minX = fw;
    let maxX = -1;
    let minY = fh;
    let maxY = -1;
    let footSumX = 0;
    let footN = 0;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * info.width + f * fw + x) * 4;
        if (data[i + 3] < ALPHA) continue;
        op += 1;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (isStrictScreenGreen(r, g, b)) residualGreen += 1;
        // Namekian mid green sample for health check
        if (Math.abs(r - 33) <= 20 && g >= 85 && g <= 130 && b >= 45 && b <= 90 && g > r && g > b) {
          namekianGreen += 1;
        }
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
    contentH.push(maxY >= 0 ? maxY - minY + 1 : 0);
    feetX.push(footN > 0 ? footSumX / footN : fw / 2);
    if (op < minOpaque) {
      errors.push(`${file} f${f + 1}: opaque ${op} < ${minOpaque}`);
    }
    if (minX <= 0 || maxX >= fw - 1) {
      errors.push(`${file} f${f + 1}: touches L/R edge (crop)`);
    }
    if (minY <= 0) {
      errors.push(`${file} f${f + 1}: touches top edge (crop)`);
    }
  }

  if (residualGreen > 0) {
    errors.push(`${file}: strictScreenGreen=${residualGreen}`);
  }
  // Idle/hurt must keep Namekian shadow green — proves chroma didn't eat skin.
  if (/idle\.png|hurt\.png/.test(file) && namekianGreen < 20) {
    errors.push(`${file}: namekian green too low (${namekianGreen}) — skin keyed out?`);
  }
  if (checkFeet && feetX.length > 1) {
    const drift = Math.max(...feetX) - Math.min(...feetX);
    if (drift > MAX_FEET_DRIFT) {
      errors.push(`${file}: feet drift ${drift.toFixed(2)}px > ${MAX_FEET_DRIFT}`);
    }
  }
  if (contentH.length > 1) {
    const spread = Math.max(...contentH) - Math.min(...contentH);
    if (!/death\.png|hurt\.png|combo\d+\.png/.test(file) && spread > MAX_CONTENT_H_SPREAD) {
      errors.push(`${file}: contentH spread ${spread}px > ${MAX_CONTENT_H_SPREAD}`);
    }
  }

  return {
    file,
    errors,
    residualGreen,
    namekianGreen,
    frameOpaque,
    feetX,
    contentH,
  };
}

async function main() {
  if (!fs.existsSync(META)) throw new Error(`missing meta ${META}`);
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const allErrors = [];
  const report = [];

  for (const sheet of SHEETS) {
    const m = meta[sheet.metaKey];
    if (!m) {
      allErrors.push(`missing meta key ${sheet.metaKey}`);
      continue;
    }
    const result = await analyzeStrip(
      sheet.file,
      m.frameWidth,
      m.frameHeight,
      m.frameCount,
      sheet.minOpaque,
      sheet.checkFeet,
    );
    report.push(result);
    allErrors.push(...result.errors);
  }

  for (const r of report) {
    const feet =
      r.feetX && r.feetX.length
        ? ` feetΔ=${(Math.max(...r.feetX) - Math.min(...r.feetX)).toFixed(2)}`
        : '';
    const h =
      r.contentH && r.contentH.length
        ? ` h=${Math.min(...r.contentH)}-${Math.max(...r.contentH)}`
        : '';
    console.log(
      `${r.errors.length ? 'FAIL' : 'OK  '} ${r.file}${h}${feet} screenGreen=${r.residualGreen ?? 0} namekian=${r.namekianGreen ?? 0}`,
    );
    for (const e of r.errors) console.log('  -', e);
  }

  if (allErrors.length) {
    console.error(`\nQA FAILED: ${allErrors.length} defect(s)`);
    process.exit(1);
  }
  console.log('\nQA PASS: Piccolo sprites clean');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
