/**
 * HQ QA for Asta sheets: no chroma leftover, no empty frames, feet locked.
 */
const path = require('path');
const { isChromaGreen, writeMagentaPreview, ALPHA_KEEP } = require('./alpha-frame-pack');

function assertAstaSheet(sheetData, sheetW, fh, fw, n, name, { lockFeet = true } = {}) {
  let residualGreen = 0;
  const footY = [];
  for (let f = 0; f < n; f += 1) {
    let opaque = 0;
    let maxFoot = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] < ALPHA_KEEP) continue;
        opaque += 1;
        if (isChromaGreen(sheetData[i], sheetData[i + 1], sheetData[i + 2])) {
          residualGreen += 1;
        }
        if (y > maxFoot) maxFoot = y;
      }
    }
    if (opaque < 40) {
      throw new Error(`${name} frame ${f} too empty (${opaque}px)`);
    }
    footY.push(maxFoot);
  }
  if (residualGreen > 0) {
    throw new Error(`${name}: residual chroma green ${residualGreen}px`);
  }
  const feet = footY.filter((y) => y >= 0);
  const spread = feet.length ? Math.max(...feet) - Math.min(...feet) : 0;
  if (lockFeet && spread > 2) {
    throw new Error(`${name}: feet not locked (spread=${spread} ${feet.join(',')})`);
  }
  return { residualGreen, footSpread: spread, footY };
}

async function writeAstaQa(sheet, qaDir, name) {
  await writeMagentaPreview(sheet, path.join(qaDir, `${name}-magenta.png`));
}

module.exports = { assertAstaSheet, writeAstaQa };
