/**
 * Batch: Deidara, Sakura Shippuden, Tenten, Temari, Tayuya, Shino
 * npm run packs:batch-6b
 */
const path = require('path');
const { processCuratedAlphaPack } = require('./lib/curated-alpha-pack');

const ROOT = path.resolve(__dirname, '..');

const PACKS = [
  {
    // Combo/jutsu frames must be content-island resliced first:
    //   npm run deidara:reslice
    // (equal-width split of the 2-row green COMBO sheet chops bodies).
    id: 'deidara',
    expected: { idle: 4, walk: 6, combo: 25, damage: 5, jutsu: 7 },
    comboSplits: [8, 8, 9],
    jutsu: {
      file: 'kijutsu.png',
      metaKey: 'deidara-kijutsu',
      skillMetaKey: 'skill-c2-dragon',
      frameRate: 12,
      hitFrame1based: 6,
    },
  },
  {
    id: 'sakura-shippuden',
    expected: { idle: 5, walk: 6, combo: 13, damage: 5, jutsu: 22 },
    comboSplits: [4, 4, 5],
    jutsu: {
      file: 'chou-tsubo.png',
      metaKey: 'sakura-shippuden-chou-tsubo',
      skillMetaKey: 'skill-chou-tsubo',
      frameRate: 12,
      hitFrame1based: 15,
    },
  },
  {
    id: 'tenten',
    expected: { idle: 6, walk: 6, combo: 16, damage: 6, jutsu: 31 },
    comboSplits: [5, 5, 6],
    jutsu: {
      file: 'sou shuriken.png',
      // use valid filename without spaces
      metaKey: 'tenten-soushuriken',
      skillMetaKey: 'skill-soushuriken',
      frameRate: 12,
      hitFrame1based: 20,
    },
  },
  {
    id: 'temari',
    expected: { idle: 6, walk: 8, combo: 16, damage: 5, jutsu: 14 },
    comboSplits: [5, 5, 6],
    jutsu: {
      file: 'kamaitachi.png',
      metaKey: 'temari-kamaitachi',
      skillMetaKey: 'skill-kamaitachi',
      frameRate: 12,
      hitFrame1based: 10,
    },
  },
  {
    id: 'tayuya',
    expected: { idle: 6, walk: 8, combo: 15, damage: 5, jutsu: 18 },
    comboSplits: [5, 5, 5],
    jutsu: {
      file: 'magen-mateki.png',
      metaKey: 'tayuya-magen-mateki',
      skillMetaKey: 'skill-magen-mateki',
      frameRate: 12,
      hitFrame1based: 12,
    },
  },
  {
    id: 'shino',
    expected: { idle: 7, walk: 6, combo: 16, damage: 5, jutsu: 13 },
    comboSplits: [5, 5, 6],
    jutsu: {
      file: 'kikaichu.png',
      metaKey: 'shino-kikaichu',
      skillMetaKey: 'skill-kikaichu',
      frameRate: 12,
      hitFrame1based: 9,
    },
  },
];

// Fix tenten file name (no spaces)
PACKS.find((p) => p.id === 'tenten').jutsu.file = 'soushuriken.png';

async function runOne(cfg) {
  console.log(`\n======== ${cfg.id} ========`);
  return processCuratedAlphaPack({
    id: cfg.id,
    srcDir: path.join(ROOT, 'assets', 'naruto-source', 'nu', cfg.id),
    outDir: path.join(ROOT, 'public', 'sprites', 'player', cfg.id),
    previewPath: path.join(ROOT, 'public', 'sprites', 'player', 'previews', `${cfg.id}.png`),
    metaJson: path.join(ROOT, 'public', 'sprites', 'player', cfg.id, 'meta.json'),
    qaDir: path.join(ROOT, 'assets-src', '_qa', cfg.id),
    expected: cfg.expected,
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
