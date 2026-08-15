/**
 * Exporta VFX de impacto do Yuno Royal Knight (AIR 1151 / 1551)
 * e liga no acerto das skills 2 e 4.
 */
const fs = require('fs');
const path = require('path');
const { openAnySff } = require('./lib/sff-open');
const { parseAir, collapse } = require('./lib/mugen-air');
const {
  packUniformGlobalScale,
  stitch,
  writePng,
  updateMeta,
  ALPHA_KEEP,
} = require('./lib/alpha-frame-pack');

const ROOT = path.resolve(__dirname, '..');
const CHAR_DIR = path.join(
  process.env.USERPROFILE || '',
  'Downloads',
  'Black Clover Mugen V8 (DirectX)',
  'Black Clover Mugen V8 (DirectX)',
  'chars',
  'Yuno_Royal_Knight',
);
const ID = 'yuno-royal-knight';
const OUT = path.join(ROOT, 'public', 'sprites', 'player', ID);
const META = path.join(OUT, 'meta.json');

function readAir(file) {
  const buf = fs.readFileSync(file);
  let text;
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.subarray(2).toString('utf16le');
  } else if (buf[0] === 0xfe && buf[1] === 0xff) {
    text = Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  } else {
    text = buf.toString('utf8');
    if (text.includes('\u0000')) text = buf.toString('latin1');
  }
  return parseAir(text);
}

function measureBodyH(frames, fw, fh) {
  let maxH = 1;
  for (const frame of frames) {
    let minY = fh;
    let maxY = -1;
    for (let y = 0; y < fh; y += 1) {
      for (let x = 0; x < fw; x += 1) {
        if (frame[(y * fw + x) * 4 + 3] < ALPHA_KEEP) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY >= minY) maxH = Math.max(maxH, maxY - minY + 1);
  }
  return maxH;
}

/** VFX MUGEN vem com preto opaco no canvas — sem isso o acerto vira uma caixa preta. */
function knockoutFxBlack(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] < 22 && rgba[i + 1] < 22 && rgba[i + 2] < 22) {
      rgba[i] = 0;
      rgba[i + 1] = 0;
      rgba[i + 2] = 0;
      rgba[i + 3] = 0;
    }
  }
}

async function spritesFromAction(sff, air, actionId) {
  const act = air.get(actionId);
  if (!act) throw new Error(`missing action ${actionId}`);
  const refs = collapse(act.frames);
  const sprites = [];
  for (const ref of refs) {
    const sprite = await sff.tryGet(ref.group, ref.number);
    if (!sprite || sprite.width < 2 || sprite.height < 2) continue;
    let opaque = 0;
    for (let i = 3; i < sprite.rgba.length; i += 4) {
      if (sprite.rgba[i] >= ALPHA_KEEP) opaque += 1;
    }
    if (opaque < 16) continue;
    knockoutFxBlack(sprite.rgba);
    sprites.push(sprite);
  }
  if (!sprites.length) throw new Error(`no sprites in action ${actionId}`);
  return { sprites, name: act.name, refs };
}

async function writeFxSheet(name, sprites) {
  const packed = await packUniformGlobalScale(
    sprites.map((s) => s.rgba),
    sprites.map((s) => s.width),
    sprites.map((s) => s.height),
    {
      absoluteScale: 1,
      allowOversizedFrames: true,
      alignX: 'bbox',
      preserveCostumeGreen: true,
    },
  );
  const sheet = stitch(packed.frames, packed.frameWidth, packed.frameHeight);
  await writePng(path.join(OUT, `${name}.png`), sheet.data, sheet.width, sheet.height);
  const contentHeight = measureBodyH(
    packed.frames,
    packed.frameWidth,
    packed.frameHeight,
  );
  const entry = {
    image: `/sprites/player/${ID}/${name}.png`,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    frameCount: packed.frames.length,
    contentHeight,
    scale: packed.scale,
    originX: packed.originX,
    frameRate: 12,
  };
  updateMeta(META, `${ID}-${name}`, entry);
  console.log(
    `  ${name}: ${entry.frameCount}f ${entry.frameWidth}x${entry.frameHeight} h=${contentHeight}`,
  );
  return entry;
}

async function main() {
  const sff = openAnySff(path.join(CHAR_DIR, 'Yuno_Black_Clover.sff'));
  const air = readAir(path.join(CHAR_DIR, 'Yuno_Black_Clover.air'));
  console.log('Yuno Royal Knight hit FX');

  const tornado = await spritesFromAction(sff, air, 1150);
  console.log('  1150', tornado.name, tornado.sprites.length, 'sprites');
  const fx2 = await writeFxSheet('special2-fx', tornado.sprites);

  const radial = await spritesFromAction(sff, air, 1151);
  console.log('  1151', radial.name, radial.sprites.length, 'sprites');
  const hit2 = await writeFxSheet('special2-hit', radial.sprites);

  const birdEnd = await spritesFromAction(sff, air, 1551);
  console.log('  1551', birdEnd.name, birdEnd.sprites.length, 'sprites');
  const hit4 = await writeFxSheet('special4-hit', birdEnd.sprites);

  const wirePath = path.join(OUT, 'wire.json');
  const wire = JSON.parse(fs.readFileSync(wirePath, 'utf8'));
  for (const sk of wire.skills || []) {
    if (sk.skillId === 'skill-yuno-royal-knight-2') {
      sk.fx = fx2;
      sk.hit = hit2;
    }
    if (sk.skillId === 'skill-yuno-royal-knight-4') sk.hit = hit4;
  }
  fs.writeFileSync(wirePath, JSON.stringify(wire, null, 2));
  console.log('updated', wirePath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
