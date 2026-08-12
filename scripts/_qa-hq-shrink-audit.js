/**
 * Audit HQ shrink bugs: body/FX sheets whose packed art is much smaller than
 * the idle contentHeight ruler (or still on legacy ~48).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const PLAYER = path.join(ROOT, 'public', 'sprites', 'player');

async function bodyHeight(pngPath, fw, fh, frame = 0) {
  const { data, info } = await sharp(pngPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const x0 = frame * fw;
  let minY = fh;
  let maxY = -1;
  for (let y = 0; y < fh; y += 1) {
    for (let x = 0; x < fw; x += 1) {
      const i = (y * w + (x0 + x)) * 4;
      if (data[i + 3] < 128) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxY >= 0 ? maxY - minY + 1 : 0;
}

async function main() {
  const dirs = fs
    .readdirSync(PLAYER, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const severe = [];
  for (const id of dirs) {
    const metaPath = path.join(PLAYER, id, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      continue;
    }
    const idleKey = Object.keys(meta).find((k) => k.endsWith('-idle'));
    const idleCh = idleKey && meta[idleKey].contentHeight;
    if (!idleCh) continue;

    for (const [k, v] of Object.entries(meta)) {
      if (!v || !v.frameWidth || !v.contentHeight || !v.image) continue;
      if (k.includes('preview')) continue;
      const img = path.join(ROOT, 'public', String(v.image).replace(/^\//, ''));
      if (!fs.existsSync(img)) continue;

      let bh;
      try {
        bh = await bodyHeight(img, v.frameWidth, v.frameHeight, 0);
      } catch {
        continue;
      }
      const fill = bh / v.contentHeight;
      const vsIdle = bh / idleCh;
      const isFx = /fx/i.test(k);
      const isBody = !isFx;
      const bodyBug = isBody && vsIdle < 0.78 && v.contentHeight >= idleCh * 0.95;
      const legacy48 = isBody && v.contentHeight <= 52 && idleCh >= 80;
      const fxBug = isFx && idleCh >= 80 && v.contentHeight <= 64 && vsIdle < 0.55;

      if (bodyBug || legacy48 || fxBug) {
        severe.push({
          id,
          key: k,
          fw: v.frameWidth,
          fh: v.frameHeight,
          ch: v.contentHeight,
          bh,
          idleCh,
          vsIdle: +vsIdle.toFixed(3),
          fill: +fill.toFixed(3),
          scale: v.scale != null ? +(+v.scale).toFixed(3) : null,
          kind: legacy48 ? 'legacy48' : fxBug ? 'fx' : 'body',
        });
      }
    }
  }

  console.log(JSON.stringify(severe, null, 2));
  console.log('TOTAL', severe.length);
  console.log(
    'CHARS',
    [...new Set(severe.map((s) => s.id))].join(', '),
  );
  const kinds = {};
  for (const s of severe) kinds[s.kind] = (kinds[s.kind] || 0) + 1;
  console.log('KINDS', kinds);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
