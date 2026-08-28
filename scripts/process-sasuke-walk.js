/**
 * Sasuke classic walk only — replace walk.png from frame_*.png sequence.
 *
 * Matches idle body ruler (contentHeight 111) without regenerating other anims.
 *
 * Usage:
 *   node scripts/process-sasuke-walk.js [zipOrDir]
 * Default zip: c:/Users/marlo/Downloads/sprite walk sasuke.zip
 *
 * Input → assets/naruto-source/nu/sasuke/walk/frame_*.png
 * Output → public/sprites/player/sasuke/walk.png (+ meta + pack metrics)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
  countOpaque,
  isChromaGreen,
  bbox,
} = require('./lib/alpha-frame-pack');
const { preferNativeScale } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const ID = 'sasuke';
const SRC_WALK = path.join(ROOT, 'assets', 'naruto-source', 'nu', ID, 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', ID);
const IDLE_PNG = path.join(OUT_DIR, 'idle.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', ID);
const PACK_TS = path.join(ROOT, 'src', 'data', 'character-packs.ts');
const EXPECTED = 6;
const PAD = 2;
const DEFAULT_ZIP = 'c:/Users/marlo/Downloads/sprite walk sasuke.zip';
/** Fallback if idle.png metrics missing — matches current SASUKE_IDLE. */
const FALLBACK_IDLE_BODY_H = 111;
const FALLBACK_IDLE_FW = 86;
const FALLBACK_IDLE_FH = 115;

function scrub(frame) {
  const d = Buffer.from(frame);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_KEEP) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    if (isChromaGreen(d[i], d[i + 1], d[i + 2])) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
    d[i + 3] = 255;
  }
  return d;
}

function countGreen(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (isChromaGreen(data[i], data[i + 1], data[i + 2])) n += 1;
  }
  return n;
}

function countBlack(data) {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < ALPHA_KEEP) continue;
    if (data[i] <= 12 && data[i + 1] <= 12 && data[i + 2] <= 12) n += 1;
  }
  return n;
}

function removeTinyIslands(frame, w, h, maxSize = 2) {
  const N = w * h;
  const seen = new Uint8Array(N);
  for (let start = 0; start < N; start += 1) {
    if (seen[start] || frame[start * 4 + 3] < ALPHA_KEEP) continue;
    const stack = [start];
    const cells = [];
    seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      cells.push(idx);
      const x = idx % w;
      const y = (idx / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (seen[ni] || frame[ni * 4 + 3] < ALPHA_KEEP) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (cells.length <= maxSize) {
      for (const idx of cells) {
        const i = idx * 4;
        frame[i] = 0;
        frame[i + 1] = 0;
        frame[i + 2] = 0;
        frame[i + 3] = 0;
      }
    }
  }
}

async function measureIdleBody() {
  if (!fs.existsSync(IDLE_PNG)) {
    return {
      bodyH: FALLBACK_IDLE_BODY_H,
      fw: FALLBACK_IDLE_FW,
      fh: FALLBACK_IDLE_FH,
    };
  }
  const meta = JSON.parse(fs.readFileSync(META_JSON, 'utf8'));
  const idleMeta = meta['sasuke-idle'] || {};
  const fw = idleMeta.frameWidth || FALLBACK_IDLE_FW;
  const fh = idleMeta.frameHeight || FALLBACK_IDLE_FH;
  const { data, info } = await sharp(IDLE_PNG).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  if (info.width % fw !== 0) {
    return {
      bodyH: idleMeta.contentHeight || FALLBACK_IDLE_BODY_H,
      fw,
      fh,
    };
  }
  const n = info.width / fw;
  let maxH = 0;
  for (let f = 0; f < n; f += 1) {
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * info.width + f * fw + x) * 4;
        if (data[i + 3] < ALPHA_KEEP) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY >= 0) maxH = Math.max(maxH, maxY - minY + 1);
  }
  return {
    bodyH: maxH || idleMeta.contentHeight || FALLBACK_IDLE_BODY_H,
    fw,
    fh,
  };
}

function installFrames(src) {
  fs.mkdirSync(SRC_WALK, { recursive: true });
  for (const f of fs.readdirSync(SRC_WALK)) {
    if (/^frame_\d+\.png$/i.test(f)) fs.unlinkSync(path.join(SRC_WALK, f));
  }

  let dir = src;
  if (fs.statSync(src).isFile() && /\.zip$/i.test(src)) {
    const tmp = path.join(ROOT, 'assets', 'naruto-source', 'nu', '_tmp-sasuke-walk-zip');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    execSync(`tar -xf "${src}" -C "${tmp}"`, { stdio: 'inherit' });
    dir = tmp;
  }

  const frames = [];
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^frame_\d+\.png$/i.test(e.name)) frames.push(p);
    }
  }
  walk(dir);
  frames.sort((a, b) => {
    const na = +(path.basename(a).match(/frame_(\d+)/i) || [])[1] || 0;
    const nb = +(path.basename(b).match(/frame_(\d+)/i) || [])[1] || 0;
    return na - nb;
  });
  if (frames.length !== EXPECTED) {
    throw new Error(`expected ${EXPECTED} frames, got ${frames.length}`);
  }
  for (const f of frames) {
    fs.copyFileSync(f, path.join(SRC_WALK, path.basename(f).toLowerCase()));
  }
  console.log(`installed ${frames.length} frames → ${SRC_WALK}`);
}

function patchPackTs(fw, fh, count, contentHeight) {
  let src = fs.readFileSync(PACK_TS, 'utf8');
  const re =
    /const SASUKE_WALK: SpriteSheetDef = \{[\s\S]*?contentHeight: \d+,\r?\n\};/;
  const next = `const SASUKE_WALK: SpriteSheetDef = {
  key: 'sasuke-walk',
  url: '/sprites/player/sasuke/walk.png',
  // npm run sasuke:walk — assets/naruto-source/nu/sasuke/walk
  frameWidth: ${fw},
  frameHeight: ${fh},
  frameCount: ${count},
  contentHeight: ${contentHeight},
};`;
  if (!re.test(src)) throw new Error('SASUKE_WALK block not found in character-packs.ts');
  src = src.replace(re, next);
  fs.writeFileSync(PACK_TS, src);
  console.log('patched SASUKE_WALK in character-packs.ts');
}

async function main() {
  const srcArg = process.argv[2] || DEFAULT_ZIP;
  if (!fs.existsSync(srcArg)) throw new Error(`source not found: ${srcArg}`);
  installFrames(srcArg);

  const idle = await measureIdleBody();
  const idleBodyH = idle.bodyH;
  console.log(`idle body ruler contentH=${idleBodyH}`);

  const keyed = await loadAlphaFrames(SRC_WALK, EXPECTED);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  let walkMaxH = 0;
  for (let i = 0; i < frames.length; i += 1) {
    walkMaxH = Math.max(walkMaxH, bbox(frames[i], widths[i], heights[i]).height);
  }
  const walkScale = preferNativeScale(walkMaxH > 0 ? idleBodyH / walkMaxH : 1);
  console.log(`walkMaxH=${walkMaxH} → scale=${walkScale.toFixed(4)}`);

  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: idleBodyH,
    pad: PAD,
    absoluteScale: walkScale,
    allowOversizedFrames: true,
    alignX: 'bbox',
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    removeTinyIslands(packed.frames[i], packed.frameWidth, packed.frameHeight, 2);
    const op = countOpaque(packed.frames[i]);
    if (op < 50) throw new Error(`walk f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  const pureBlack = countBlack(sheet.data);
  if (residualGreen > 0) throw new Error(`residualGreen=${residualGreen}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(QA_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'walk.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA_DIR,
    'walk',
    3,
  );

  updateMeta(META_JSON, 'sasuke-walk', {
    image: '/sprites/player/sasuke/walk.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: idleBodyH,
    scale: packed.scale,
    originX: packed.originX,
    residualGreen: 0,
    pureBlack,
    source: 'assets/naruto-source/nu/sasuke/walk (sprite walk sasuke.zip)',
    frameRate: 10,
  });

  patchPackTs(packed.frameWidth, packed.frameHeight, packed.frames.length, idleBodyH);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${packed.frameWidth} fh=${packed.frameHeight} n=${packed.frames.length} contentH=${idleBodyH} black=${pureBlack}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
