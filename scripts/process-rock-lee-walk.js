/**
 * Rock Lee classic walk only — replace walk.png from frame_*.png sequence.
 *
 * Alpha-only (never black-key). Feet-locked packing. Idle body ruler.
 *
 * Usage:
 *   node scripts/process-rock-lee-walk.js [zipOrDir]
 * Default zip: c:/Users/marlo/Downloads/srp walk lee.zip
 *
 * Input → assets/naruto-source/nu/rock-lee/walk/frame_*.png
 * Output → public/sprites/player/rock-lee/walk.png (+ meta + pack metrics)
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
const ID = 'rock-lee';
const SRC_WALK = path.join(ROOT, 'assets', 'naruto-source', 'nu', ID, 'walk');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', ID);
const IDLE_PNG = path.join(OUT_DIR, 'idle.png');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', ID);
const PACK_TS = path.join(ROOT, 'src', 'data', 'character-packs.ts');
const EXPECTED = 6;
const PAD = 2;
const DEFAULT_ZIP = 'c:/Users/marlo/Downloads/srp walk lee.zip';
const FALLBACK_IDLE_BODY_H = 127;
const FALLBACK_IDLE_FW = 80;
const FALLBACK_IDLE_FH = 131;
const FEET_Y_DELTA_MAX = 2;

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

function isJumpsuitGreen(r, g, b) {
  if (g < 45 || g > 190) return false;
  if (g <= r + 4 || g <= b + 2) return false;
  if (isChromaGreen(r, g, b)) return false;
  return true;
}

function isLegWarmerOrange(r, g, b) {
  return r >= 120 && g >= 55 && g <= 150 && b <= 90 && r > g + 15;
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

function componentSizes(frameData, w, h, sheetW, frameIndex, fw) {
  const n = fw * h;
  const seen = new Uint8Array(n);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const comps = [];
  for (let start = 0; start < n; start += 1) {
    const x0 = start % fw;
    const y0 = (start / fw) | 0;
    const i0 = (y0 * sheetW + frameIndex * fw + x0) * 4;
    if (seen[start] || frameData[i0 + 3] < ALPHA_KEEP) continue;
    const stack = [start];
    let size = 0;
    seen[start] = 1;
    while (stack.length) {
      const s = stack.pop();
      size += 1;
      const x = s % fw;
      const y = (s / fw) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= fw || ny >= h) continue;
        const ni = ny * fw + nx;
        const ii = (ny * sheetW + frameIndex * fw + nx) * 4;
        if (seen[ni] || frameData[ii + 3] < ALPHA_KEEP) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    comps.push(size);
  }
  comps.sort((a, b) => b - a);
  return comps;
}

function qaWalkSheet(sheetData, sheetW, fh, fw, n, contentHeight) {
  let residualGreen = 0;
  const footY = [];
  const frameComps = [];

  for (let f = 0; f < n; f += 1) {
    let maxFoot = -1;
    let pix = 0;
    let frameBlack = 0;
    let frameGreen = 0;
    let frameOrange = 0;

    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * sheetW + f * fw + x) * 4;
        if (sheetData[i + 3] < ALPHA_KEEP) continue;
        pix += 1;
        const r = sheetData[i];
        const g = sheetData[i + 1];
        const b = sheetData[i + 2];
        if (isChromaGreen(r, g, b)) residualGreen += 1;
        if (r <= 12 && g <= 12 && b <= 12) frameBlack += 1;
        if (isJumpsuitGreen(r, g, b)) frameGreen += 1;
        if (isLegWarmerOrange(r, g, b)) frameOrange += 1;
        if (y > maxFoot) maxFoot = y;
      }
    }

    const comps = componentSizes(sheetData, fw, fh, sheetW, f, fw);
    frameComps.push(comps);
    footY.push(maxFoot);

    if (pix < 80) throw new Error(`Frame ${f} too empty (${pix}px)`);
    if (frameBlack < 8) throw new Error(`Frame ${f} outline missing (${frameBlack}px black)`);
    if (frameGreen < 40) throw new Error(`Frame ${f} jumpsuit green missing (${frameGreen}px)`);
    if (frameOrange < 8) throw new Error(`Frame ${f} leg warmers missing (${frameOrange}px)`);
    if (comps.length > 1) {
      const minor = comps.slice(1).reduce((s, c) => s + c, 0);
      if (minor > Math.max(12, comps[0] * 0.04)) {
        throw new Error(
          `Frame ${f} disconnected limbs nComps=${comps.length} top=${comps[0]} minor=${minor}`,
        );
      }
    }
  }

  if (residualGreen > 0) throw new Error(`residualGreen=${residualGreen}`);

  const footMin = Math.min(...footY);
  const footMax = Math.max(...footY);
  const footDelta = footMax - footMin;
  if (footDelta > FEET_Y_DELTA_MAX) {
    throw new Error(`foot hop footY=${footY.join(',')} delta=${footDelta} max=${FEET_Y_DELTA_MAX}`);
  }

  const measuredBody = footMax - Math.min(...footY.map((fy, fi) => {
    let minY = fh;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        const i = (y * sheetW + fi * fw + x) * 4;
        if (sheetData[i + 3] >= ALPHA_KEEP && y < minY) minY = y;
      }
    }
    return minY;
  })) + 1;

  if (Math.abs(measuredBody - contentHeight) > 3) {
    console.warn(
      `WARN body height ${measuredBody}px vs contentHeight ${contentHeight} (delta ${Math.abs(measuredBody - contentHeight)})`,
    );
  }

  return {
    residualGreen,
    pureBlack: countBlack(sheetData),
    footY,
    footDelta,
    frameComps,
  };
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
  const idleMeta = meta['rock-lee-idle'] || {};
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
    const tmp = path.join(ROOT, 'assets', 'naruto-source', 'nu', '_tmp-rock-lee-walk-zip');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    execSync(`tar -xf "${src}" -C "${tmp}"`, { stdio: 'inherit' });
    dir = tmp;
  }

  const frames = [];
  function walkDir(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkDir(p);
      else if (/^frame_\d+\.png$/i.test(e.name)) frames.push(p);
    }
  }
  walkDir(dir);
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
    /const ROCK_LEE_WALK: SpriteSheetDef = \{[\s\S]*?contentHeight: \d+,\r?\n\};/;
  const next = `const ROCK_LEE_WALK: SpriteSheetDef = {
  key: 'rock-lee-walk',
  url: '/sprites/player/rock-lee/walk.png',
  // npm run rock-lee:walk — assets/naruto-source/nu/rock-lee/walk
  frameWidth: ${fw},
  frameHeight: ${fh},
  frameCount: ${count},
  contentHeight: ${contentHeight},
};`;
  if (!re.test(src)) throw new Error('ROCK_LEE_WALK block not found in character-packs.ts');
  src = src.replace(re, next);
  fs.writeFileSync(PACK_TS, src);
  console.log('patched ROCK_LEE_WALK in character-packs.ts');
}

async function buildWalk(idleBodyH, { alignX, fullFrame, walkScale }) {
  const keyed = await loadAlphaFrames(SRC_WALK, EXPECTED);
  const frames = keyed.map((k) => scrub(k.frame));
  const widths = keyed.map((k) => k.width);
  const heights = keyed.map((k) => k.height);

  const packed = await packUniformGlobalScale(frames, widths, heights, {
    targetBodyH: idleBodyH,
    pad: PAD,
    absoluteScale: walkScale,
    allowOversizedFrames: true,
    alignX,
    fullFrame,
  });

  for (let i = 0; i < packed.frames.length; i += 1) {
    removeTinyIslands(packed.frames[i], packed.frameWidth, packed.frameHeight, 2);
    const op = countOpaque(packed.frames[i]);
    if (op < 60) throw new Error(`walk f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const qa = qaWalkSheet(
    sheet.data,
    sheet.width,
    packed.frameHeight,
    packed.frameWidth,
    packed.frames.length,
    idleBodyH,
  );

  return { packed, sheet, qa };
}

async function main() {
  const srcArg = process.argv[2] || DEFAULT_ZIP;
  if (!fs.existsSync(srcArg)) throw new Error(`source not found: ${srcArg}`);
  installFrames(srcArg);

  const idle = await measureIdleBody();
  const idleBodyH = idle.bodyH;
  console.log(`idle body ruler contentH=${idleBodyH}`);

  const keyedProbe = await loadAlphaFrames(SRC_WALK, EXPECTED);
  let walkMaxH = 0;
  for (const k of keyedProbe) {
    walkMaxH = Math.max(walkMaxH, bbox(scrub(k.frame), k.width, k.height).height);
  }
  const walkScale = preferNativeScale(walkMaxH > 0 ? idleBodyH / walkMaxH : 1);
  console.log(`walkMaxH=${walkMaxH} → scale=${walkScale.toFixed(4)}`);

  const attempts = [
    { alignX: 'feet', fullFrame: true, label: 'feet+fullFrame' },
    { alignX: 'feet', fullFrame: false, label: 'feet+bbox' },
    { alignX: 'bbox', fullFrame: false, label: 'bbox' },
  ];

  let best = null;
  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const result = await buildWalk(idleBodyH, {
        alignX: attempt.alignX,
        fullFrame: attempt.fullFrame,
        walkScale,
      });
      console.log(
        `QA OK [${attempt.label}] footY=${result.qa.footY.join(',')} delta=${result.qa.footDelta} black=${result.qa.pureBlack}`,
      );
      if (!best || result.qa.footDelta < best.qa.footDelta) {
        best = { ...result, attempt: attempt.label };
      }
      if (result.qa.footDelta === 0) break;
    } catch (err) {
      lastErr = err;
      console.warn(`QA fail [${attempt.label}]: ${err.message}`);
    }
  }

  if (!best) {
    throw lastErr || new Error('all walk pack attempts failed QA');
  }

  const { packed, sheet, qa, attempt } = best;
  console.log(`using pack mode: ${attempt}`);

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

  updateMeta(META_JSON, 'rock-lee-walk', {
    image: '/sprites/player/rock-lee/walk.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: idleBodyH,
    scale: packed.scale,
    originX: packed.originX,
    residualGreen: 0,
    pureBlack: qa.pureBlack,
    source: 'assets/naruto-source/nu/rock-lee/walk (srp walk lee.zip)',
    frameRate: 10,
    packMode: attempt,
    footY: qa.footY,
  });

  patchPackTs(packed.frameWidth, packed.frameHeight, packed.frames.length, idleBodyH);

  console.log(
    `-> walk.png ${sheet.width}x${sheet.height} fw=${packed.frameWidth} fh=${packed.frameHeight} n=${packed.frames.length} contentH=${idleBodyH} black=${qa.pureBlack}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
