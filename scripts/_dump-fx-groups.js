/**
 * Dump SFF groups as contact sheets, optionally converting MUGEN additive
 * (trans=A) sprites to straight alpha so black reads as transparent.
 * node scripts/_dump-fx-groups.js <charDir> <sffFile> <outDir> <group[,group...]>
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { openAnySff } = require('./lib/sff-open');

function additiveToAlpha(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const lum = Math.max(r, g, b);
    if (rgba[i + 3] === 0) continue;
    if (lum <= 8) {
      rgba[i + 3] = 0;
      continue;
    }
    const k = 255 / lum;
    rgba[i] = Math.min(255, Math.round(r * k));
    rgba[i + 1] = Math.min(255, Math.round(g * k));
    rgba[i + 2] = Math.min(255, Math.round(b * k));
    rgba[i + 3] = Math.min(255, lum);
  }
}

async function main() {
  const dir = process.argv[2];
  const sffFile = process.argv[3];
  const outDir = process.argv[4];
  const groups = (process.argv[5] || '').split(',').map(Number).filter(Boolean);
  const zoom = Number(process.argv[6] || 1);
  fs.mkdirSync(outDir, { recursive: true });
  const sff = openAnySff(path.join(dir, sffFile));

  for (const group of groups) {
    const sprites = [];
    for (let n = 0; n < 60; n += 1) {
      const spr = await sff.tryGet(group, n);
      if (!spr) continue;
      const rgba = Buffer.from(spr.rgba);
      additiveToAlpha(rgba);
      sprites.push({ n, rgba, w: spr.width, h: spr.height });
      if (sprites.length >= 12) break;
    }
    if (!sprites.length) {
      console.log(`g${group}: empty`);
      continue;
    }
    const cellW = Math.max(...sprites.map((s) => s.w));
    const cellH = Math.max(...sprites.map((s) => s.h));
    const cols = Math.min(6, sprites.length);
    const rows = Math.ceil(sprites.length / cols);
    const composite = [];
    for (let i = 0; i < sprites.length; i += 1) {
      const s = sprites[i];
      composite.push({
        input: await sharp(s.rgba, { raw: { width: s.w, height: s.h, channels: 4 } })
          .png()
          .toBuffer(),
        left: (i % cols) * cellW + Math.floor((cellW - s.w) / 2),
        top: Math.floor(i / cols) * cellH + Math.floor((cellH - s.h) / 2),
      });
    }
    const W = cols * cellW;
    const H = rows * cellH;
    let img = sharp({
      create: { width: W, height: H, channels: 4, background: { r: 24, g: 24, b: 40, alpha: 1 } },
    }).composite(composite);
    let buf = await img.png().toBuffer();
    const maxSide = 1100;
    const f = Math.min(zoom, maxSide / Math.max(W, H));
    if (f !== 1) {
      buf = await sharp(buf)
        .resize(Math.max(1, Math.round(W * f)), Math.max(1, Math.round(H * f)), {
          kernel: f > 1 ? sharp.kernel.nearest : sharp.kernel.lanczos3,
        })
        .png()
        .toBuffer();
    }
    await sharp(buf).toFile(path.join(outDir, `fxg-${group}.png`));
    console.log(`g${group}: ${sprites.length} sprites cell=${cellW}x${cellH}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
