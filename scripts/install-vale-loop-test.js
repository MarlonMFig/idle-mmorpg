/**
 * Instala mapa de teste lateral com loop de vídeo (Vale do Fim).
 * node scripts/install-vale-loop-test.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(process.env.USERPROFILE || '', 'Videos', '0814.mp4');
const OUT_DIR = path.join(ROOT, 'public', 'maps');
const OUT_MP4 = path.join(OUT_DIR, 'hunt-vale-loop.mp4');
const OUT_PNG = path.join(OUT_DIR, 'hunt-vale-loop.png');
const OUT_TMX = path.join(OUT_DIR, 'hunt-vale-loop.tmx');
const OUT_META = path.join(ROOT, 'public', 'data', 'wonsr', 'maps', 'hunt-vale-loop.json');

const W = 1904; // múltiplo de 16 (tile) e par (h264)
const H = 1088;
const TILE = 16;
const COLS = Math.ceil(W / TILE);
const ROWS = Math.ceil(H / TILE);

/** Frente do palco de pedra (origem 3790×2160 y≈1710 → escala H/2160). */
const FLOOR_Y = Math.round((1710 * H) / 2160);
const PLAYER_SPAWN = { x: Math.round(W / 2), y: FLOOR_Y };
const ENEMY_SPAWN_RIGHT = { x: W - 80, y: FLOOR_Y };
const ENEMY_SPAWN_LEFT = { x: 80, y: FLOOR_Y };

function runFfmpeg(args, label) {
  const result = spawnSync('ffmpeg', args, { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`${label} failed with code ${result.status}`);
  }
}

function main() {
  if (!fs.existsSync(SRC)) {
    throw new Error(`Missing source video: ${SRC}`);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  runFfmpeg(
    [
      '-y',
      '-i',
      SRC,
      '-an',
      '-vf',
      `scale=${W}:${H}:flags=lanczos`,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      OUT_MP4,
    ],
    'encode loop mp4',
  );

  runFfmpeg(
    [
      '-y',
      '-i',
      SRC,
      '-an',
      '-vf',
      `scale=${W}:${H}:flags=lanczos`,
      '-frames:v',
      '1',
      '-update',
      '1',
      OUT_PNG,
    ],
    'extract still png',
  );

  const collision = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < COLS; c += 1) {
      row.push(r < 2 ? 1 : 0);
    }
    collision.push(row.join(','));
  }
  const zeros = Array.from({ length: ROWS }, () => Array(COLS).fill(0).join(','));

  const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${COLS}" height="${ROWS}" tilewidth="${TILE}" tileheight="${TILE}" infinite="0" nextlayerid="3" nextobjectid="1">
 <tileset firstgid="1" name="hunt-vale-loop" tilewidth="${TILE}" tileheight="${TILE}" tilecount="1" columns="1">
  <image source="hunt-vale-loop.png" width="${W}" height="${H}"/>
 </tileset>
 <layer id="1" name="ground" width="${COLS}" height="${ROWS}">
  <data encoding="csv">
${zeros.join(',\n')}
</data>
 </layer>
 <layer id="2" name="collision" width="${COLS}" height="${ROWS}">
  <data encoding="csv">
${collision.join(',\n')}
</data>
 </layer>
</map>
`;
  fs.writeFileSync(OUT_TMX, tmx);

  const meta = {
    mapKey: 'huntValeLoop',
    slug: 'hunt-vale-loop',
    label: 'Vale do Fim (Loop)',
    image: '/maps/hunt-vale-loop.png',
    video: '/maps/hunt-vale-loop.mp4',
    tmx: '/maps/hunt-vale-loop.tmx',
    width: W,
    height: H,
    cols: COLS,
    rows: ROWS,
    lateralFloorY: FLOOR_Y,
    spawn: PLAYER_SPAWN,
    enemySpawns: [ENEMY_SPAWN_RIGHT, ENEMY_SPAWN_LEFT],
  };
  fs.mkdirSync(path.dirname(OUT_META), { recursive: true });
  fs.writeFileSync(OUT_META, JSON.stringify(meta, null, 2) + '\n');
  const stat = fs.statSync(OUT_MP4);
  console.log('wrote', OUT_MP4, `${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('wrote', OUT_PNG);
  console.log('wrote', OUT_TMX);
  console.log('wrote', OUT_META);
}

main();
