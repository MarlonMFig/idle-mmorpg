/**
 * Batch: process 6 curated packs from assets/naruto-source/nu/*
 * npm run packs:batch-6
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');

/** @type {Array<Parameters<typeof processCuratedAlphaPack>[0]>} */
const PACKS = [
  {
    id: 'sasuke-cursed',
    expected: { idle: 6, walk: 8, combo: 18, damage: 6, jutsu: 38 },
    comboSplits: [6, 6, 6],
    jutsu: {
      file: 'chidori-nagashi.png',
      metaKey: 'sasuke-cursed-chidori-nagashi',
      skillMetaKey: 'skill-chidori-nagashi',
      frameRate: 12,
      hitFrame1based: 26,
    },
  },
  {
    id: 'sakura',
    expected: { idle: 6, walk: 6, combo: 12, damage: 5, jutsu: 19 },
    comboSplits: [4, 4, 4],
    jutsu: {
      file: 'chou-bakou.png',
      metaKey: 'sakura-chou-bakou',
      skillMetaKey: 'skill-chou-bakou',
      frameRate: 12,
      hitFrame1based: 12,
    },
  },
  {
    id: 'orochimaru',
    expected: { idle: 4, walk: 6, combo: 15, damage: 6, jutsu: 0 },
    comboSplits: [5, 5, 5],
    jutsu: null,
  },
  {
    id: 'naruto-kyubi',
    expected: { idle: 6, walk: 6, combo: 13, damage: 7, jutsu: 36 },
    comboSplits: [4, 4, 5],
    jutsu: {
      file: 'kyuubi.png',
      metaKey: 'naruto-kyubi-mode',
      skillMetaKey: 'skill-kurama-mode',
      frameRate: 12,
      hitFrame1based: 25,
    },
  },
  {
    id: 'naruto',
    expected: { idle: 6, walk: 6, combo: 12, damage: 5, jutsu: 48 },
    comboSplits: [4, 4, 4],
    jutsu: {
      file: 'rasengan.png',
      metaKey: 'naruto-rasengan',
      skillMetaKey: 'skill-rasengan',
      frameRate: 12,
      hitFrame1based: 32,
    },
  },
  {
    id: 'kisame',
    expected: { idle: 4, walk: 6, combo: 13, damage: 5, jutsu: 19 },
    comboSplits: [4, 4, 5],
    jutsu: {
      file: 'suiryudan.png',
      metaKey: 'kisame-suiryudan',
      skillMetaKey: 'skill-suiton-suiryudan',
      frameRate: 12,
      hitFrame1based: 13,
    },
  },
];

async function runOne(cfg) {
  const id = cfg.id;
  console.log(`\n======== ${id} ========`);
  const expected = { ...cfg.expected };
  if (!expected.jutsu) expected.jutsu = 0;
  return processCuratedAlphaPack({
    id,
    srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', id),
    outDir: path.join(ROOT, 'public', 'sprites', 'player', id),
    previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${id}.png`),
    metaJson: path.join(ROOT, 'public', 'sprites', 'player', id, 'meta.json'),
    qaDir: path.join(ROOT, 'assets-src', '_qa', id),
    expected,
    comboSplits: cfg.comboSplits,
    jutsu: cfg.jutsu || undefined,
  });
}

async function main() {
  const results = {};
  for (const cfg of PACKS) {
    results[cfg.id] = await runOne(cfg);
  }
  console.log('\n======== ALL PACKS OK ========');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
