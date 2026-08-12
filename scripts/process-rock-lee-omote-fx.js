/**
 * Rock Lee Omote Renge — kick-off dust VFX (1st frame).
 * Blue-screen source → alpha strip under public/sprites/player/rock-lee/
 *
 * npm run rock-lee:omote-fx
 * Input:  assets/naruto-source/nu/rock-lee/omote-renge-fx-source.png (or Cursor drop)
 * Output: public/sprites/player/rock-lee/omote-renge-fx.png
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
  countOpaque,
} = require('./lib/alpha-frame-pack');
const { resolveHqFxTargetMaxSide } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const LOCAL_SRC_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'rock-lee');
const LOCAL_CANDIDATES = [
  path.join(LOCAL_SRC_DIR, 'omote-renge-fx-source.png'),
  path.join(LOCAL_SRC_DIR, 'omote-renge-fx.png'),
];
const CURSOR_SRC = path.normalize(
  'C:\\Users\\marlo\\.cursor\\projects\\c-Users-marlo-Projects-idle-mmorpg\\assets\\c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-d10f5c5b-a90c-4213-9151-19f8387cfa02.png',
);
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'rock-lee');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'rock-lee');
/** Max cell side in game (content scaled to this). */
const EXPECTED_SINGLE = 1;
/** Legacy kick-dust height when body was ~48. */
const LEGACY_FX_H = 40;
const PAD = 2;

function resolveSource() {
  for (const p of LOCAL_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  if (fs.existsSync(CURSOR_SRC)) return CURSOR_SRC;
  throw new Error(
    `Missing Omote Renge FX. Expected:\n  ${LOCAL_CANDIDATES.join('\n  ')}\n  or ${CURSOR_SRC}`,
  );
}

/** Dark navy / blue screen (NOT gray dust pixels). */
function isBlueScreen(r, g, b) {
  // Classic navy key (~#1b3c5d, #0a2848, #123a5a)
  if (b >= 40 && b >= r + 15 && b >= g + 10 && r <= 90 && g <= 110) return true;
  // Solid-ish blue: chroma dominates and value is mid-dark
  if (b > g + 25 && b > r + 25 && b < 160 && r < 80 && g < 100) return true;
  // Very dark blue canvas
  if (b <= 90 && r <= 40 && g <= 55 && b >= Math.max(r, g) + 8) return true;
  return false;
}

function keyBlue(data) {
  const out = Buffer.from(data);
  let keyed = 0;
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const a = out[i + 3];
    if (a < ALPHA_KEEP || isBlueScreen(r, g, b)) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      keyed += 1;
      continue;
    }
    // Keep dust; snap near-opaque
    out[i + 3] = 255;
  }
  return { data: out, keyed };
}

function placeCentered(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const ox = Math.floor((dw - sw) / 2);
  // Floor-align: hang dust from top padding, feet on bottom pad
  const oy = dh - sh - PAD;
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

function nearestScale(src, sw, sh, scale) {
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y += 1) {
    const sy = Math.min(sh - 1, Math.floor(y / scale));
    for (let x = 0; x < dw; x += 1) {
      const sx = Math.min(sw - 1, Math.floor(x / scale));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return { data: out, width: dw, height: dh };
}

async function main() {
  const srcPath = resolveSource();
  console.log('source', srcPath);

  const localKeep = path.join(LOCAL_SRC_DIR, 'omote-renge-fx-source.png');
  fs.mkdirSync(LOCAL_SRC_DIR, { recursive: true });
  if (path.resolve(srcPath) !== path.resolve(localKeep)) {
    fs.copyFileSync(srcPath, localKeep);
    console.log('copied →', localKeep);
  }

  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const { data: keyed, keyed: nKeyed } = keyBlue(data);
  console.log(`keyed blue pixels=${nKeyed} size=${w}x${h}`);

  const box = bbox(keyed, w, h);
  if (box.width < 4 || box.height < 4) {
    throw new Error('Empty after blue-key — adjust isBlueScreen');
  }

  const crop = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const si = ((box.minY + y) * w + (box.minX + x)) * 4;
      const di = (y * box.width + x) * 4;
      keyed.copy(crop, di, si, si + 4);
    }
  }

  const TARGET_H = resolveHqFxTargetMaxSide(META_JSON, 'rock-lee-idle', LEGACY_FX_H);
  console.log(`HQ FX targetH=${TARGET_H} (legacy ${LEGACY_FX_H})`);
  const scale = TARGET_H / Math.max(1, box.height);
  const scaled = nearestScale(crop, box.width, box.height, scale);
  const fw = scaled.width + PAD * 2;
  const fh = scaled.height + PAD * 2;
  const cell = placeCentered(scaled.data, scaled.width, scaled.height, fw, fh);
  const op = countOpaque(cell);
  if (op < 40) throw new Error(`FX too empty (${op}px)`);

  const sheet = stitch([cell], fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'omote-renge-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    { frames: [cell], frameWidth: fw, frameHeight: fh },
    QA_DIR,
    'omote-renge-fx',
    4,
  );

  // Static preview for eye-check
  await sharp(cell, { raw: { width: fw, height: fh, channels: 4 } })
    .resize(fw * 4, fh * 4, { kernel: sharp.kernel.nearest })
    .png()
    .toFile(path.join(QA_DIR, 'omote-renge-fx-mag-x4.png'));

  const entry = {
    image: '/sprites/player/rock-lee/omote-renge-fx.png',
    frameWidth: fw,
    frameHeight: fh,
    frameCount: 1,
    contentHeight: fh - PAD * 2,
    scale,
    residualBlue: 0,
    source: 'omote-renge-fx-source.png (1st-frame kick dust)',
  };
  updateMeta(META_JSON, 'rock-lee-omote-renge-fx', entry);
  updateMeta(META_JSON, 'skill-omote-renge-fx', entry);

  console.log('PACK_WIRE_FX', JSON.stringify(entry, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
