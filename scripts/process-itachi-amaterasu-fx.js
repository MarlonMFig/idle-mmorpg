/**
 * Itachi Amaterasu black-flame VFX — blue-screen horizontal sheet → target FX strip.
 *
 * Source: dark navy/blue canvas with 9 frames LTR:
 *   1. Mangekyō Sharingan flash
 *   2. dark energy charge
 *   3–9. black Amaterasu flames (peak → fade)
 *
 * Exterior blue flood only (NOT global blue-key) so navy flame cores stay.
 * Equal-column split (9f) then content bbox + centered cells.
 *
 * npm run itachi:amaterasu-fx
 * Input:  assets/naruto-source/nu/itachi/amaterasu-fx-source.png or Cursor asset
 * Output: public/sprites/player/itachi/amaterasu-fx.png
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  bbox,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
} = require('./lib/alpha-frame-pack');
const {
  readIdleContentHeight,
  hqLinearScale,
  LEGACY_TARGET_BODY_H,
} = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'itachi');
const LOCAL_CANDIDATES = [
  path.join(LOCAL_SRC_DIR, 'amaterasu-fx-source.png'),
  path.join(LOCAL_SRC_DIR, 'amaterasu-fx-source.jpg'),
  path.join(LOCAL_SRC_DIR, 'amaterasu-fx-source.jpeg'),
];
const CURSOR_SRC = path.normalize(
  'C:\\Users\\marlo\\.cursor\\projects\\c-Users-marlo-Projects-idle-mmorpg\\assets\\c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-c694775f-e945-42d1-a696-d7f732c32d93.png',
);
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'itachi');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'itachi');
const FRAME_RATE = 12;
const EXPECTED = 9;
/** Legacy FX max-side when body was 48 — playPackFx uses player.scale, so FX
 *  must track idle contentHeight or the flames shrink on HQ packs. */
const LEGACY_FX_MAX_SIDE = 56;
const PAD = 2;

function resolveSource() {
  // Prefer fresh Cursor drop when present (new sheet); then local cache.
  if (fs.existsSync(CURSOR_SRC)) return CURSOR_SRC;
  for (const p of LOCAL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `Missing Amaterasu FX sheet. Expected one of:\n  ${CURSOR_SRC}\n  ${LOCAL_CANDIDATES.join('\n  ')}`,
  );
}

/** Solid navy/blue canvas (~#004080) — not flame cores or red Sharingan. */
function isBlueCanvas(r, g, b) {
  // Dominant mid blue bg bucket from histogram: (0,64,128) family
  if (r <= 28 && g >= 40 && g <= 100 && b >= 100 && b <= 170 && b >= g + 30 && b >= r + 55) {
    return true;
  }
  // AA / slightly darker edges of the same screen
  if (r <= 24 && g >= 28 && g <= 90 && b >= 90 && b <= 150 && b > g + 25 && b > r + 50) {
    return true;
  }
  return false;
}

function isSharinganRed(r, g, b) {
  return r >= 100 && r > g + 35 && r > b + 35;
}

/**
 * Flood-clear exterior blue canvas from image borders.
 * Leaves interior navy/black flames + red eye intact.
 */
function keyExteriorBlue(src, w, h) {
  const out = Buffer.from(src);
  const N = w * h;
  const exterior = new Uint8Array(N);
  const stack = [];

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const idx = y * w + x;
    if (exterior[idx]) return;
    const i = idx * 4;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    if (a < 16 || isBlueCanvas(r, g, b)) {
      exterior[idx] = 1;
      stack.push(idx);
    }
  };

  for (let x = 0; x < w; x += 1) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y += 1) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx / w) | 0;
    tryPush(x - 1, y);
    tryPush(x + 1, y);
    tryPush(x, y - 1);
    tryPush(x, y + 1);
  }

  let keyed = 0;
  for (let idx = 0; idx < N; idx += 1) {
    const i = idx * 4;
    if (exterior[idx]) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      keyed += 1;
      continue;
    }
    // Non-exterior residual pure canvas pockets (small enclosed blue)
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (out[i + 3] >= ALPHA_KEEP && isBlueCanvas(r, g, b) && !isSharinganRed(r, g, b)) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      keyed += 1;
      continue;
    }
    if (out[i + 3] >= ALPHA_KEEP) out[i + 3] = 255;
  }
  return { data: out, keyed };
}

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

function extractRegion(data, w, h, x0, x1) {
  const regionW = x1 - x0;
  const crop = Buffer.alloc(regionW * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < regionW; x += 1) {
      const si = (y * w + (x0 + x)) * 4;
      const di = (y * regionW + x) * 4;
      crop[di] = data[si];
      crop[di + 1] = data[si + 1];
      crop[di + 2] = data[si + 2];
      crop[di + 3] = data[si + 3];
    }
  }
  return { crop, bw: regionW, bh: h };
}

async function main() {
  const srcPath = resolveSource();
  console.log('source', srcPath);

  const { data: raw, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  const { data, keyed } = keyExteriorBlue(raw, w, h);
  console.log(`keyed exterior blue ${keyed}px on ${w}x${h}`);

  // Equal LTR columns for the 9-frame strip.
  const colW = w / EXPECTED;
  const crops = [];
  let maxW = 0;
  let maxH = 0;

  for (let f = 0; f < EXPECTED; f += 1) {
    const x0 = Math.floor(f * colW);
    const x1 = f === EXPECTED - 1 ? w : Math.floor((f + 1) * colW);
    const { crop, bw, bh } = extractRegion(data, w, h, x0, x1);
    const box = bbox(crop, bw, bh);
    if (box.width < 2 || box.height < 2) {
      throw new Error(`Frame ${f} empty after blue key (${x0}-${x1})`);
    }
    const tw = box.width;
    const th = box.height;
    const tight = Buffer.alloc(tw * th * 4);
    for (let y = 0; y < th; y += 1) {
      for (let x = 0; x < tw; x += 1) {
        const si = ((box.minY + y) * bw + (box.minX + x)) * 4;
        const di = (y * tw + x) * 4;
        tight[di] = crop[si];
        tight[di + 1] = crop[si + 1];
        tight[di + 2] = crop[si + 2];
        tight[di + 3] = crop[si + 3];
      }
    }
    maxW = Math.max(maxW, tw);
    maxH = Math.max(maxH, th);
    crops.push({ crop: tight, bw: tw, bh: th });
    console.log(`  f${f} ${tw}x${th} col=${x0}-${x1}`);
  }

  const cellW = maxW + PAD * 2;
  const cellH = maxH + PAD * 2;
  const cellsBuf = crops.map(({ crop, bw, bh }) => placeCentered(crop, bw, bh, cellW, cellH));

  const idleH =
    readIdleContentHeight(META_JSON, 'itachi-idle') || LEGACY_TARGET_BODY_H;
  // Keep the legacy FX∶body ratio (~56/48) so playPackFx(player.scale×1.15) looks right.
  const targetMaxSide = Math.max(
    1,
    Math.round(LEGACY_FX_MAX_SIDE * hqLinearScale(idleH)),
  );
  const scale = Math.min(
    targetMaxSide / Math.max(1, cellH),
    (targetMaxSide * 1.25) / Math.max(1, cellW),
  );
  console.log(
    `HQ FX: idleH=${idleH} targetMaxSide=${targetMaxSide} cell=${cellW}x${cellH} scale=${scale.toFixed(4)}`,
  );
  const outW = Math.max(1, Math.round(cellW * scale));
  const outH = Math.max(1, Math.round(cellH * scale));
  const area = scale * scale;

  const frames = [];
  for (const cell of cellsBuf) {
    const { data: resized } = await sharp(cell, {
      raw: { width: cellW, height: cellH, channels: 4 },
    })
      .resize(outW, outH, { kernel: sharp.kernel.nearest })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < resized.length; i += 4) {
      if (resized[i + 3] < 128) {
        resized[i] = 0;
        resized[i + 1] = 0;
        resized[i + 2] = 0;
        resized[i + 3] = 0;
      } else {
        resized[i + 3] = 255;
        if (isBlueCanvas(resized[i], resized[i + 1], resized[i + 2])) {
          resized[i] = 0;
          resized[i + 1] = 0;
          resized[i + 2] = 0;
          resized[i + 3] = 0;
        }
      }
    }
    frames.push(resized);
  }

  const sheet = stitch(frames, outW, outH);

  // QA
  let residualBlue = 0;
  let opaque = 0;
  let pureBlack = 0;
  let navy = 0;
  let red = 0;
  const frameOpaque = [];

  for (let f = 0; f < frames.length; f += 1) {
    let pix = 0;
    let fRed = 0;
    for (let y = 0; y < outH; y += 1) {
      for (let x = 0; x < outW; x += 1) {
        const i = (y * sheet.width + f * outW + x) * 4;
        if (sheet.data[i + 3] < ALPHA_KEEP) continue;
        pix += 1;
        opaque += 1;
        const r = sheet.data[i];
        const g = sheet.data[i + 1];
        const b = sheet.data[i + 2];
        if (isBlueCanvas(r, g, b)) residualBlue += 1;
        if (r <= 12 && g <= 12 && b <= 12) pureBlack += 1;
        if (r <= 60 && g <= 70 && b <= 120 && (b >= r || r <= 25)) navy += 1;
        if (isSharinganRed(r, g, b)) {
          red += 1;
          fRed += 1;
        }
      }
    }
    frameOpaque.push(pix);
    if (pix < Math.max(4, Math.round(4 * area))) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (f === 0 && fRed < Math.max(8, Math.round(8 * area))) {
      throw new Error(`Frame 0 missing Sharingan red (${fRed}px)`);
    }
  }

  console.log(
    `QA residualBlue=${residualBlue} opaque=${opaque} pureBlack=${pureBlack} navy=${navy} red=${red} frameOpaque=[${frameOpaque.join(',')}]`,
  );
  if (residualBlue > Math.round(40 * area)) {
    throw new Error(`QA fail: residual blue canvas = ${residualBlue}`);
  }
  if (pureBlack + navy < Math.round(80 * area)) {
    throw new Error(
      `QA fail: black/navy flame nearly gone (pureBlack=${pureBlack} navy=${navy})`,
    );
  }

  // Cache source
  fs.mkdirSync(LOCAL_SRC_DIR, { recursive: true });
  const localSrc = path.join(LOCAL_SRC_DIR, 'amaterasu-fx-source.png');
  if (path.resolve(srcPath) !== path.resolve(localSrc)) {
    await sharp(srcPath).png().toFile(localSrc);
    console.log('cached source →', localSrc);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'amaterasu-fx.png'), sheet.data, sheet.width, sheet.height);

  const scaledMeta = {
    frames,
    frameWidth: outW,
    frameHeight: outH,
    contentHeight: outH,
    scale,
  };
  await writeFrameCrops(sheet, scaledMeta, QA_DIR, 'amaterasu-fx', 3);

  const durationMs = Math.round((frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: '/sprites/player/itachi/amaterasu-fx.png',
    frameWidth: outW,
    frameHeight: outH,
    frameCount: frames.length,
    contentHeight: outH,
    scale,
    frameRate: FRAME_RATE,
    durationMs,
    source: 'assets/naruto-source/nu/itachi/amaterasu-fx-source.png',
    residualBlue,
    pureBlack,
    navy,
    red,
    note: `${frames.length}f Amaterasu VFX (Sharingan + black flames) — exterior blue key, equal columns`,
  };
  updateMeta(META_JSON, 'itachi-amaterasu-fx', entry);
  updateMeta(META_JSON, 'skill-amaterasu-fx', {
    ...entry,
    note: 'skill-amaterasu FX — black flames on target (hitDelay−80)',
  });

  console.log(
    `-> amaterasu-fx.png ${sheet.width}x${sheet.height} fw=${outW} fh=${outH} n=${frames.length} scale=${scale.toFixed(4)} durationMs=${durationMs}`,
  );
  console.log(
    'Pack wire fx:',
    JSON.stringify({
      key: 'itachi-amaterasu-fx',
      url: '/sprites/player/itachi/amaterasu-fx.png',
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
