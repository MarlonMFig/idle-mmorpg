/**
 * Rock Lee classic — substitui somente a animação do Omote Renge.
 *
 * Input:  assets/naruto-source/nu/rock-lee/omote-renge-new/frames/frame_*.png
 * Output: public/sprites/player/rock-lee/omote-renge.png
 */
const fs = require('fs');
const path = require('path');
const {
  loadAlphaFrames,
  packUniformGlobalScale,
  preserveFrame,
  stitch,
  writeFrameCrops,
  writePng,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'assets', 'naruto-source', 'nu', 'rock-lee', 'omote-renge-new', 'frames');
const OUTPUT = path.join(ROOT, 'public', 'sprites', 'player', 'rock-lee', 'omote-renge.png');
const META = path.join(ROOT, 'public', 'sprites', 'player', 'rock-lee', 'meta.json');
const QA = path.join(ROOT, 'assets-src', '_qa', 'rock-lee', 'omote-renge-new');
const FRAME_RATE = 14;
const CONTENT_HEIGHT = 127;

async function main() {
  const keyed = await loadAlphaFrames(INPUT, 19, { chromaKey: false });
  const frames = keyed.map(({ frame }) => preserveFrame(frame));
  const packed = await packUniformGlobalScale(
    frames,
    keyed.map(({ width }) => width),
    keyed.map(({ height }) => height),
    {
      targetBodyH: CONTENT_HEIGHT,
      pad: 2,
      alignX: 'feet',
    },
  );
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.mkdirSync(QA, { recursive: true });
  await writePng(OUTPUT, sheet.data, sheet.width, sheet.height);
  await writeFrameCrops(sheet, packed, QA, 'omote-renge-new', 4);

  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  const entry = {
    image: '/sprites/player/rock-lee/omote-renge.png',
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight: packed.contentHeight,
    frameRate: FRAME_RATE,
    durationMs: Math.round((packed.frames.length / FRAME_RATE) * 1000),
    hitDelayMs: Math.round((15 / FRAME_RATE) * 1000),
    source: 'assets/naruto-source/nu/rock-lee/omote-renge-new/frames',
    residualGreen: 0,
  };
  meta['rock-lee-omote-renge'] = entry;
  meta['skill-omote-renge'] = entry;
  fs.writeFileSync(META, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(
    `OK Omote Renge n=${entry.frameCount} fw=${entry.frameWidth} fh=${entry.frameHeight} ` +
      `contentH=${entry.contentHeight} duration=${entry.durationMs}ms hit=${entry.hitDelayMs}ms`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
