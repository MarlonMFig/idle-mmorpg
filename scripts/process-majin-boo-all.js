/**
 * Majin Boo pack — lateral curated alpha (flight + ESPECIAL with charge orb).
 *
 *   node scripts/import-majin-boo-sources.js
 *   node scripts/process-majin-boo-all.js
 *   node scripts/qa-majin-boo-sprites.js
 *
 * Especial body:
 *   wind-up f1–3 → charge (arms-up + vfx f1–6 composited) → throw f14–17
 * Projectile FX (especial-fx): vfx f7/9/11 flight + f12–f13 impact
 */
const fs = require('fs');
const path = require('path');
const {
  processCuratedAlphaPack,
  TARGET_BODY_H,
} = require('./lib/curated-alpha-pack');
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

const ROOT = path.resolve(__dirname, '..');
const ID = 'majin-boo';
const SRC = path.join(ROOT, 'assets', 'dragon-ball-source', 'nu', ID);
const OUT = path.join(ROOT, 'public', 'sprites', 'player', ID);
const QA = path.join(ROOT, 'assets-src', '_qa', ID);
const META = path.join(OUT, 'meta.json');

const FRAME_RATE = 10;
/** Arms-up hold body (1-based source frame). */
const CHARGE_BODY_FRAME = 11;
/** Orb center on body bbox — between raised palms (matches user reference). */
const ORB_ANCHOR = { x: 0.5, y: 0.11 };

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

function cropToBox(frame, w, box) {
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width; x += 1) {
      const si = ((box.minY + y) * w + (box.minX + x)) * 4;
      const di = (y * box.width + x) * 4;
      out[di] = frame[si];
      out[di + 1] = frame[si + 1];
      out[di + 2] = frame[si + 2];
      out[di + 3] = frame[si + 3];
    }
  }
  return out;
}

function blit(dst, dw, dh, src, sw, sh, ox, oy) {
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const si = (y * sw + x) * 4;
      if (src[si + 3] < ALPHA_KEEP) continue;
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= dw || dy >= dh) continue;
      const di = (dy * dw + dx) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = 255;
    }
  }
}

/** Composite vfx orb onto arms-up body (orb between hands). */
function compositeCharge(bodyFrame, bodyW, bodyH, vfxFrame, vfxW, vfxH) {
  const bodyScrub = scrub(bodyFrame);
  const vfxScrub = scrub(vfxFrame);
  const bb = bbox(bodyScrub, bodyW, bodyH);
  const vb = bbox(vfxScrub, vfxW, vfxH);
  const bodyCrop = cropToBox(bodyScrub, bodyW, bb);
  const vfxCrop = cropToBox(vfxScrub, vfxW, vb);

  const orbCx = Math.round(bb.width * ORB_ANCHOR.x);
  const orbCy = Math.round(bb.height * ORB_ANCHOR.y);
  const padTop = Math.max(0, Math.ceil(vb.height / 2 - orbCy) + 4);
  const padBot = 2;
  const padX = Math.max(
    4,
    Math.ceil(vb.width / 2 - Math.min(orbCx, bb.width - orbCx)) + 2,
  );
  const dw = bb.width + padX * 2;
  const dh = bb.height + padTop + padBot;
  const canvas = Buffer.alloc(dw * dh * 4);
  const bodyOx = padX;
  const bodyOy = padTop;
  blit(canvas, dw, dh, bodyCrop, bb.width, bb.height, bodyOx, bodyOy);
  const vox = bodyOx + orbCx - Math.floor(vb.width / 2);
  const voy = bodyOy + orbCy - Math.floor(vb.height / 2);
  blit(canvas, dw, dh, vfxCrop, vb.width, vb.height, vox, voy);
  return { frame: canvas, width: dw, height: dh };
}

/**
 * Build especial.png:
 *   3f wind-up + 6f charge (arms-up + vfx1–6) + 4f throw = 13f
 * Body density locked to idle scale.
 */
async function buildEspecialBody(contentHeight) {
  const jutsu = await loadAlphaFrames(path.join(SRC, 'jutsu'), 17);
  const vfx = await loadAlphaFrames(path.join(SRC, 'vfx'), 13);

  const windup = jutsu.slice(0, 3).map((k) => ({
    frame: scrub(k.frame),
    width: k.width,
    height: k.height,
  }));

  const chargeBody = jutsu[CHARGE_BODY_FRAME - 1];
  const charge = [];
  for (let i = 0; i < 6; i += 1) {
    const c = compositeCharge(
      chargeBody.frame,
      chargeBody.width,
      chargeBody.height,
      vfx[i].frame,
      vfx[i].width,
      vfx[i].height,
    );
    charge.push(c);
  }

  const throwFrames = jutsu.slice(13, 17).map((k) => ({
    frame: scrub(k.frame),
    width: k.width,
    height: k.height,
  }));

  const all = [...windup, ...charge, ...throwFrames];
  // Match wind-up body height to idle ruler (sources are drawn shorter than idle).
  let windupH = 0;
  for (const f of windup) {
    windupH = Math.max(windupH, bbox(f.frame, f.width, f.height).height);
  }
  const especialScale =
    contentHeight != null && contentHeight > 0 && windupH > 0
      ? contentHeight / windupH
      : 1;
  console.log(
    `especial scale=${especialScale.toFixed(4)} (windupH=${windupH} → contentHeight=${contentHeight})`,
  );
  const packed = await packUniformGlobalScale(
    all.map((f) => f.frame),
    all.map((f) => f.width),
    all.map((f) => f.height),
    {
      targetBodyH: contentHeight ?? TARGET_BODY_H,
      pad: 10,
      absoluteScale: especialScale,
      allowOversizedFrames: true,
      alignX: 'feet',
    },
  );

  for (let i = 0; i < packed.frames.length; i += 1) {
    const op = countOpaque(packed.frames[i]);
    if (op < 80) throw new Error(`especial f${i + 1} too empty (${op}px)`);
  }

  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  const residualGreen = countGreen(sheet.data);
  if (residualGreen > 0) throw new Error(`especial residualGreen=${residualGreen}`);

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  await writePng(path.join(OUT, 'especial.png'), sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(
    sheet,
    {
      frames: packed.frames,
      frameWidth: packed.frameWidth,
      frameHeight: packed.frameHeight,
    },
    QA,
    'especial',
    3,
  );

  // Throw starts after wind-up(3)+charge(6) → frame index 9 (1-based 10)
  const throwFrame1based = 10;
  const hitIdx = throwFrame1based - 1;
  const entry = {
    image: '/sprites/player/majin-boo/especial.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: contentHeight ?? packed.frameHeight,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs: Math.round((packed.frames.length / FRAME_RATE) * 1000),
    hitDelayMs: Math.round((hitIdx / FRAME_RATE) * 1000),
    residualGreen: 0,
    originX: packed.originX,
    note: '3f wind-up + 6f charge(vfx1–6 on arms-up) + 4f throw; body matched to idle contentHeight; projectile in especial-fx',
  };
  updateMeta(META, 'majin-boo-especial', entry);
  updateMeta(META, 'skill-majin-boo-especial', entry);

  console.log(
    `-> especial.png n=${entry.frameCount} fw=${entry.frameWidth} fh=${entry.frameHeight} scale=${packed.scale.toFixed(4)} throw@${throwFrame1based} hit=${entry.hitDelayMs}ms originX=${(packed.originX ?? 0.5).toFixed(3)}`,
  );
  return entry;
}

processCuratedAlphaPack({
  id: ID,
  srcDir: SRC,
  outDir: OUT,
  previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
  metaJson: META,
  qaDir: QA,
  expected: { idle: 4, walk: 4, combo: 28, damage: 4 },
  comboSplits: [10, 9, 9],
  hurtFrameCount: 2,
  walkAlignX: 'feet',
  scaleRef: 'idle',
  nativePixels: true,
})
  .then(async (wire) => {
    const especial = await buildEspecialBody(wire.contentHeight);
    const { spawnSync } = require('child_process');
    const r = spawnSync('node', [path.join(__dirname, 'process-majin-boo-especial-fx.js')], {
      stdio: 'inherit',
      cwd: ROOT,
    });
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log('MAJIN_BOO_WIRE', JSON.stringify({ ...wire, jutsu: especial }, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
