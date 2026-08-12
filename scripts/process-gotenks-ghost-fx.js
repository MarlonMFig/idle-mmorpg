/**
 * Gotenks Super Ghost — projectile FX (flight + impact on target).
 *
 *   f0–f1  ghost flight loop (jutsu source frame_017–018)
 *   f2–f6  kamikaze burst on enemy
 *
 * npm run gotenks:ghost-fx
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  ALPHA_KEEP,
  isChromaGreen,
  bbox,
  packUniformGlobalScale,
  stitch,
  writeFrameCrops,
  updateMeta,
  writePng,
} = require('./lib/alpha-frame-pack');
const { resolveHqFxTargetMaxSide } = require('./lib/strip-hq-scale');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', 'gotenks', 'jutsu');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'gotenks');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const QA_DIR = path.join(ROOT, 'assets-src', '_qa', 'gotenks');

const FLIGHT_FRAME_COUNT = 2;
const IMPACT_FRAME_COUNT = 5;
const LEGACY_FX_BODY_H = 44;
const PAD = 2;
const FRAME_RATE = 10;

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

/** Expanding white→orange burst for ghost kamikaze impact. */
function buildImpactFrame(index, total, size) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const progress = (index + 1) / total;
  const maxR = size * 0.46 * (0.35 + progress * 0.65);
  const fade = index === total - 1 ? 0.45 : 1;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > maxR) continue;
      const edge = dist / Math.max(1, maxR);
      let r;
      let g;
      let b;
      let a = 255;
      if (edge < 0.22) {
        r = 255;
        g = 255;
        b = 255;
      } else if (edge < 0.5) {
        r = 255;
        g = 236;
        b = 120;
      } else if (edge < 0.78) {
        r = 255;
        g = 150;
        b = 48;
      } else {
        r = 220;
        g = 70;
        b = 28;
        a = Math.round(255 * (1 - (edge - 0.78) / 0.22));
      }
      a = Math.round(a * fade);
      if (a < 16) continue;
      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = a;
    }
  }
  return buf;
}

async function loadFlightSources() {
  const names = ['frame_017.png', 'frame_018.png'];
  const out = [];
  for (const name of names) {
    const p = path.join(SRC_DIR, name);
    if (!fs.existsSync(p)) throw new Error(`Missing ${p}`);
    const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    out.push({ frame: scrub(data), width: info.width, height: info.height, name });
  }
  return out;
}

async function main() {
  const TARGET_BODY_H = resolveHqFxTargetMaxSide(META_JSON, 'gotenks-idle', LEGACY_FX_BODY_H);
  console.log('HQ FX targetBodyH=' + TARGET_BODY_H + ' (legacy ' + LEGACY_FX_BODY_H + ')');
  const flightSrc = await loadFlightSources();
  const flightFrames = flightSrc.map((s) => s.frame);
  const flightW = flightSrc.map((s) => s.width);
  const flightH = flightSrc.map((s) => s.height);

  const flightPacked = await packUniformGlobalScale(flightFrames, flightW, flightH, {
    targetBodyH: TARGET_BODY_H,
    pad: PAD,
    allowOversizedFrames: true,
    alignX: 'bbox',
  });

  const impactSize = Math.max(flightPacked.frameWidth, flightPacked.frameHeight, 40);
  const impactFrames = [];
  for (let i = 0; i < IMPACT_FRAME_COUNT; i += 1) {
    const raw = buildImpactFrame(i, IMPACT_FRAME_COUNT, impactSize);
    impactFrames.push(raw);
  }

  const fw = Math.max(flightPacked.frameWidth, impactSize);
  const fh = Math.max(flightPacked.frameHeight, impactSize);

  function centerInCell(src, sw, sh) {
    const cell = Buffer.alloc(fw * fh * 4);
    const ox = Math.floor((fw - sw) / 2);
    const oy = Math.floor((fh - sh) / 2);
    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const si = (y * sw + x) * 4;
        if (src[si + 3] < ALPHA_KEEP) continue;
        const di = ((y + oy) * fw + (x + ox)) * 4;
        src.copy(cell, di, si, si + 4);
      }
    }
    return cell;
  }

  const allFrames = [
    ...flightPacked.frames.map((f) => centerInCell(f, flightPacked.frameWidth, flightPacked.frameHeight)),
    ...impactFrames.map((f) => centerInCell(f, impactSize, impactSize)),
  ];

  for (let i = 0; i < allFrames.length; i += 1) {
    let op = 0;
    for (let p = 3; p < allFrames[i].length; p += 4) {
      if (allFrames[i][p] >= ALPHA_KEEP) op += 1;
    }
    if (op < 20) throw new Error(`ghost-fx f${i} too empty (${op}px)`);
  }

  const sheet = stitch(allFrames, fw, fh);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'ghost-fx.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    { frames: allFrames, frameWidth: fw, frameHeight: fh, contentHeight: fh, scale: 1 },
    QA_DIR,
    'ghost-fx',
    3,
  );

  const frameCount = allFrames.length;
  const entry = {
    image: '/sprites/player/gotenks/ghost-fx.png',
    frameWidth: fw,
    frameHeight: fh,
    frameCount,
    contentHeight: fh,
    frameRate: FRAME_RATE,
    flightFrameCount: FLIGHT_FRAME_COUNT,
    durationMs: Math.round((frameCount / FRAME_RATE) * 1000),
    residualGreen: 0,
    note: `${FLIGHT_FRAME_COUNT}f ghost flight + ${IMPACT_FRAME_COUNT}f kamikaze burst`,
  };
  updateMeta(META_JSON, 'gotenks-ghost-fx', entry);

  console.log(
    `-> ghost-fx.png ${sheet.width}x${sheet.height} fw=${fw} fh=${fh} n=${frameCount} flight=${FLIGHT_FRAME_COUNT}`,
  );
  console.log(
    'FX_WIRE',
    JSON.stringify({
      key: 'gotenks-ghost-fx',
      url: '/sprites/player/gotenks/ghost-fx.png',
      frameWidth: fw,
      frameHeight: fh,
      frameCount,
      flightFrameCount: FLIGHT_FRAME_COUNT,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
