/**
 * Kakashi — pose geral de jutsu (7 frames).
 *
 * npm run kakashi:pose-geral
 * Input:  assets/naruto-source/nu/kakashi/pose-geral/frame_*.png
 * Output: public/sprites/player/kakashi/pose-geral.png
 */
const fs = require('fs');
const path = require('path');
const {
  loadAlphaFrames,
  packUniformGlobalScale,
  stitch,
  updateMeta,
  writePng,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'kakashi', 'pose-geral');
const OUT_DIR = path.join(ROOT, 'public', 'sprites', 'player', 'kakashi');
const META_JSON = path.join(OUT_DIR, 'meta.json');
const FRAME_RATE = 12;
const EXPECTED = 7;

async function main() {
  const keyed = await loadAlphaFrames(INPUT_DIR, EXPECTED);
  const packed = await packUniformGlobalScale(
    keyed.map((row) => row.frame),
    keyed.map((row) => row.width),
    keyed.map((row) => row.height),
    {
      pad: 2,
      alignX: 'feet',
      hq: { mode: 'match', metaPath: META_JSON, idleKey: 'kakashi-idle' },
    },
  );
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await writePng(path.join(OUT_DIR, 'pose-geral.png'), sheet.data, sheet.width, sheet.height);

  const durationMs = Math.round((packed.frames.length / FRAME_RATE) * 1000);
  const entry = {
    image: '/sprites/player/kakashi/pose-geral.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: packed.contentHeight,
    scale: packed.scale,
    frameRate: FRAME_RATE,
    durationMs,
    source: 'assets/naruto-source/nu/kakashi/pose-geral/frame_001..007.png',
    note: 'POSE GERAL.zip — alpha pack, HQ match idle, feet lock',
  };
  updateMeta(META_JSON, 'kakashi-pose-geral', entry);
  console.log(
    'Pack wire:',
    JSON.stringify({
      frameWidth: entry.frameWidth,
      frameHeight: entry.frameHeight,
      frameCount: entry.frameCount,
      contentHeight: entry.contentHeight,
      frameRate: FRAME_RATE,
      durationMs,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
