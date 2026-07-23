const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

async function stats(file, fw, count) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const total = w * h;
  let a0 = 0;
  for (let i = 0; i < total; i++) if (data[i * 4 + 3] < 16) a0++;
  console.log(path.basename(file), w + "x" + h, "alpha0%", ((100 * a0) / total).toFixed(1));
  if (fw && count) {
    for (let f = 0; f < count; f++) {
      let op = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < fw; x++) {
          const i = (y * w + f * fw + x) * 4;
          if (data[i + 3] >= 16) op++;
        }
      }
      console.log("  frame", f, "opaque", op);
    }
  }
}

(async () => {
  const dir = "public/sprites/player/sasuke";
  await stats(dir + "/sasuke-idle-walk.png", 57, 4);
  await stats(dir + "/sasuke-kick.png", 65, 4);
  await stats(dir + "/sasuke-chidori.png", 143, 5);
  await stats(dir + "/sasuke-fireball-cast.png", 59, 5);
  await stats(dir + "/sasuke-fireball-fx.png", 130, 2);
  await stats(dir + "/sasuke-kirin-cast.png", 65, 3);
  await stats(dir + "/sasuke-amaterasu-cast.png", 68, 3);
  await stats(dir + "/sasuke-amaterasu-fx.png", 60, 3);
  await stats("public/sprites/skills/sasuke-chidori.png");
  await stats("public/sprites/skills/sasuke-fireball.png");
  await stats("public/sprites/skills/sasuke-amaterasu.png");
  await stats(dir + "/sasuke-kirin-dragon.png");
  console.log("\nfiles:");
  for (const f of fs.readdirSync(dir)) {
    const st = fs.statSync(path.join(dir, f));
    console.log(f, st.size);
  }
})();
