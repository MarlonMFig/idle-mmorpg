/**
 * Shikamaru jutsu 2 VFX — explosive kunai / bakudan trail + blast (18 frames).
 *
 * Alpha-only (never black-key — pure black sparks/smoke outlines stay).
 * Centered cells (not floor-align body); scale so blast ≈ combat-readable.
 *
 * npm run shikamaru:jutsu2-vfx
 * Input:  assets/naruto-source/nu/shikamaru/jutsu2-vfx/frame_001..018.png
 * Output: public/sprites/player/shikamaru/explosion-kunai-fx.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  isChromaGreen,
  bbox,
} = require('./lib/alpha-frame-pack');
const { resolveHqFxTargetMaxSide } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'shikamaru', 'jutsu2-vfx');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'shikamaru');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'shikamaru');
const EXPECTED = 18;
const FRAME_RATE = 12;
/** Legacy max side when body was ~48 — HQ multiplies by idle/48. */
const LEGACY_FX_MAX_SIDE = 52;
const PAD = 2;

function placeCentered(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const ox = Math.floor((dw - sw) / 2);
  const oy = Math.floor((dh - sh) / 2);
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const si = (y * sw + x) * 4;
      if (src[si + 3] < ALPHA_KEEP) continue;
      const dx = x + ox;
      const dy = y + oy;
      if (dx < 0 || dy < 0 || dx >= dw || dy >= dh) continue;
      src.copy(out, (dy * dw + dx) * 4, si, si + 4);
    }
  }
  return out;
}

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);

  /**
   * Some impact frames ship as dual blasts on one canvas (side-by-side).
   * For single-target FX pick the denser left/right lobe when width ≫ peers.
   */
  function maybePrimaryBlast(frame, w, h, box) {
    const peerish = box.width < w * 0.85;
    if (peerish) return box;

    const dens = new Array(w).fill(0);
    for (let y = box.minY; y <= box.maxY; y += 1) {
      for (let x = box.minX; x <= box.maxX; x += 1) {
        if (frame[(y * w + x) * 4 + 3] >= ALPHA_KEEP) dens[x] += 1;
      }
    }
    // Weakest column near horizontal mid as split candidate
    const mid0 = Math.floor((box.minX + box.maxX) / 2);
    const lo = Math.floor(box.minX + box.width * 0.35);
    const hi = Math.floor(box.minX + box.width * 0.65);
    let splitX = mid0;
    let minD = Infinity;
    for (let x = lo; x <= hi; x += 1) {
      if (dens[x] < minD) {
        minD = dens[x];
        splitX = x;
      }
    }
    // Require a real valley (not flat sheet)
    const peak = Math.max(...dens.slice(box.minX, box.maxX + 1));
    if (minD > peak * 0.45) return box;

    const leftOp = dens.slice(box.minX, splitX).reduce((s, v) => s + v, 0);
    const rightOp = dens.slice(splitX, box.maxX + 1).reduce((s, v) => s + v, 0);
    const useLeft = leftOp >= rightOp;
    const x0 = useLeft ? box.minX : splitX;
    const x1 = useLeft ? splitX - 1 : box.maxX;
    let minY = h;
    let maxY = -1;
    let minX = w;
    let maxX = -1;
    for (let y = box.minY; y <= box.maxY; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (frame[(y * w + x) * 4 + 3] < ALPHA_KEEP) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return box;
    console.log(
      `  dual-blast → keep ${useLeft ? 'LEFT' : 'RIGHT'} lobe split@${splitX} densMid=${minD}/${peak}`,
    );
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  const crops = [];
  let maxW = 0;
  let maxH = 0;
  // Peer width for dual-blast detection (ignore full-canvas outliers later)
  const baseBoxes = keyed.map((k) => bbox(k.frame, k.width, k.height));
  const sortedW = baseBoxes.map((b) => b.width).sort((a, b) => a - b);
  const medianW = sortedW[Math.floor(sortedW.length / 2)] || 80;

  for (let ki = 0; ki < keyed.length; ki += 1) {
    const k = keyed[ki];
    let box = baseBoxes[ki];
    // Full-canvas or far above median width → try dual-blast lobe pick
    if (box.width >= Math.max(medianW * 1.8, k.width * 0.7)) {
      box = maybePrimaryBlast(k.frame, k.width, k.height, box);
    }
    const bw = box.width;
    const bh = box.height;
    const crop = Buffer.alloc(bw * bh * 4);
    for (let y = 0; y < bh; y += 1) {
      for (let x = 0; x < bw; x += 1) {
        const si = ((box.minY + y) * k.width + (box.minX + x)) * 4;
        const di = (y * bw + x) * 4;
        crop[di] = k.frame[si];
        crop[di + 1] = k.frame[si + 1];
        crop[di + 2] = k.frame[si + 2];
        crop[di + 3] = k.frame[si + 3];
      }
    }
    maxW = Math.max(maxW, bw);
    maxH = Math.max(maxH, bh);
    crops.push({ crop, bw, bh, file: k.file });
    console.log(`  crop ${k.file} ${bw}x${bh}`);
  }

  const cellW = maxW + PAD * 2;
  const cellH = maxH + PAD * 2;
  const cells = crops.map(({ crop, bw, bh }) => placeCentered(crop, bw, bh, cellW, cellH));

  // Scale so largest side ≈ HQ target (playPackFx uses player.scale × texture).
  const TARGET_MAX_SIDE = resolveHqFxTargetMaxSide(
    META_JSON,
    'shikamaru-idle',
    LEGACY_FX_MAX_SIDE,
  );
  console.log(`HQ FX targetMaxSide=${TARGET_MAX_SIDE} (legacy ${LEGACY_FX_MAX_SIDE})`);
  const scale = TARGET_MAX_SIDE / Math.max(1, cellW, cellH);
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));

  const frames = [];
  for (const cell of cells) {
    const { data } = await sharp(cell, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        data[i + 3] = 255;
        if (isChromaGreen(data[i], data[i + 1], data[i + 2])) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 0;
        }
      }
    }
    frames.push(data);
  }

  const sheet = stitch(frames, outW, outH);

  // QA: residual green + non-empty frames; multi-component OK (tag + kunai)
  let residualGreen = 0;
  let opaque = 0;
  let pureBlack = 0;
  let warm = 0; // fire/orange/yellow
  const frameOpaque = [];

  for (let f = 0; f < frames.length; f += 1) {
    let pix = 0;
    let hot = 0;
    for (let y = 0; y < outH; y += 1) {
      for (let x = 0; x < outW; x += 1) {
        const i = (y * sheet.width + f * outW + x) * 4;
        if (sheet.data[i + 3] < ALPHA_KEEP) continue;
        pix += 1;
        opaque += 1;
        const r = sheet.data[i];
        const g = sheet.data[i + 1];
        const b = sheet.data[i + 2];
        if (isChromaGreen(r, g, b)) residualGreen += 1;
        if (r <= 12 && g <= 12 && b <= 12) pureBlack += 1;
        // warm fire / parchment / explode core
        if (r >= 160 && g >= 80 && b <= 140) {
          warm += 1;
          hot += 1;
        } else if (r >= 120 && g >= 40 && g <= 180 && b <= 90) {
          warm += 1;
          hot += 1;
        }
      }
    }
    frameOpaque.push(pix);
    if (pix < 8) {
      throw new Error(`Frame ${f} too empty (${pix}px)`);
    }
  }

  console.log(
    `QA residualGreen=${residualGreen} opaque=${opaque} pureBlack=${pureBlack} warm=${warm} frameOpaque=[${frameOpaque.join(',')}]`,
  );
  if (residualGreen > 0) {
    throw new Error(`QA fail: residual green = ${residualGreen}`);
  }
  if (warm < 80) {
    throw new Error(`QA fail: fire/warm tones nearly gone (${warm})`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(
    path.join(OUT_DIR, 'explosion-kunai-fx.png'),
    sheet.data,
    sheet.width,
    sheet.height,
  );

  const scaledMeta = {
    frames,
    frameWidth: outW,
    frameHeight: outH,
    contentHeight: outH,
    scale,
  };
  await writeFrameCrops(sheet, scaledMeta, QA_DIR, 'explosion-kunai-fx', 2);

  const durationMs = Math.round((frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: '/sprites/player/shikamaru/explosion-kunai-fx.png',
    frameWidth: outW,
    frameHeight: outH,
    frameCount: frames.length,
    contentHeight: outH,
    scale,
    frameRate: FRAME_RATE,
    durationMs,
    source: 'assets/naruto-source/nu/shikamaru/jutsu2-vfx/frame_001..018.png',
    residualGreen,
    residualExteriorBlack: 0,
    pureBlack,
    warm,
    note: `${frames.length}f explosion/kunai VFX only — alpha-only, centered cells`,
  };
  updateMeta(META_JSON, 'shikamaru-explosion-kunai-fx', entry);

  console.log(
    `-> explosion-kunai-fx.png ${sheet.width}x${sheet.height} fw=${outW} fh=${outH} n=${frames.length} scale=${scale.toFixed(4)} durationMs=${durationMs}`,
  );
  console.log(
    'Pack wire fx:',
    JSON.stringify({
      key: 'shikamaru-explosion-kunai-fx',
      frameWidth: outW,
      frameHeight: outH,
      frameCount: frames.length,
      contentHeight: outH,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
