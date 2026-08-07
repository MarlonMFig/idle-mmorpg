if (!process.env) process.env = {};
process.env.npm_package_config_libvips = '8.14.5';

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const jobs = [
  {
    label: 'female',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-9f08feb4-3b05-4e97-8c9c-0e74bcd1f02e.png',
    preview: 'public/sprites/player/suna/suna-female.png',
    walk: 'public/sprites/player/suna/suna-female-walk.png',
    attack: 'public/sprites/player/suna/suna-female-attack.png',
  },
  {
    label: 'male',
    src: 'C:/Users/marlo/.cursor/projects/c-Users-marlo-Projects-idle-mmorpg/assets/c__Users_marlo_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_image-95502963-ac96-4bf0-b6ca-4ce2a74be881.png',
    preview: 'public/sprites/player/suna/suna-male.png',
    walk: 'public/sprites/player/suna/suna-male-walk.png',
    attack: 'public/sprites/player/suna/suna-male-attack.png',
  },
];

async function processOne(job) {
  const { data, info } = await sharp(job.src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const ch = info.channels;
  const bg = { r: data[0], g: data[1], b: data[2] };
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += ch) {
    const dist = Math.hypot(out[i] - bg.r, out[i + 1] - bg.g, out[i + 2] - bg.b);
    if (dist < 48) out[i + 3] = 0;
    else if (dist < 75) out[i + 3] = Math.round(out[i + 3] * ((dist - 48) / 27));
  }

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (out[(y * w + x) * ch + 3] > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const trimmed = Buffer.alloc(tw * th * 4);
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const si = ((minY + y) * w + (minX + x)) * ch;
      const di = (y * tw + x) * 4;
      trimmed[di] = out[si];
      trimmed[di + 1] = out[si + 1];
      trimmed[di + 2] = out[si + 2];
      trimmed[di + 3] = out[si + 3];
    }
  }

  const targetH = 66;
  const targetW = Math.max(1, Math.round(tw * (targetH / th)));
  fs.mkdirSync(path.dirname(job.preview), { recursive: true });

  const png = await sharp(trimmed, { raw: { width: tw, height: th, channels: 4 } })
    .resize(targetW, targetH, { kernel: sharp.kernel.nearest })
    .png()
    .toBuffer();

  await sharp(png).toFile(job.preview);
  await sharp(png).toFile(job.walk);
  await sharp(png).toFile(job.attack);
  console.log(job.label, targetW + 'x' + targetH, 'from', tw + 'x' + th);
  return { label: job.label, w: targetW, h: targetH };
}

(async () => {
  const results = [];
  for (const job of jobs) results.push(await processOne(job));
  fs.writeFileSync('scripts/tmp-suna-meta.json', JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
