/**
 * Momo Hinamori full lateral pack (alpha frame_*.png zips).
 * npm run momo-hinamori:all
 *
 * Source: assets/naruto-source/nu/momo-hinamori/{idle,walk,combo,damage,jutsu}
 * Output: public/sprites/player/momo-hinamori/*
 *
 * Tobiume uses shared-source-crop body-lock (see process-momo-hinamori-tobiume.js).
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');
const { processTobiume } = require('./process-momo-hinamori-tobiume');

const ROOT = path.resolve(__dirname, '..');
const ID = 'momo-hinamori';

async function main() {
  const wire = await processCuratedAlphaPack({
    id: ID,
    srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', ID),
    outDir: path.join(ROOT, 'public', 'sprites', 'player', ID),
    previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${ID}.png`),
    metaJson: path.join(ROOT, 'public', 'sprites', 'player', ID, 'meta.json'),
    qaDir: path.join(ROOT, 'assets-src', '_qa', ID),
    expected: { idle: 8, walk: 5, combo: 11, damage: 7, jutsu: 0 },
    comboSplits: [4, 4, 3],
    jutsu: null,
  });

  const tobiume = await processTobiume();
  wire.jutsu = {
    frameWidth: tobiume.frameWidth,
    frameHeight: tobiume.frameHeight,
    frameCount: tobiume.frameCount,
    durationMs: tobiume.durationMs,
    hitDelayMs: tobiume.hitDelayMs,
    frameRate: tobiume.frameRate,
    file: 'tobiume.png',
  };
  console.log('DONE momo-hinamori', JSON.stringify(wire, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
