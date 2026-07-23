const sharp = require("sharp");
const fs = require("fs");
(async () => {
  const src = "assets/naruto-source/sasuke-sheet.png";
  const out = "assets/naruto-source/_inspect/labels";
  fs.mkdirSync(out, { recursive: true });
  // crop label bands high contrast
  await sharp(src).extract({ left: 0, top: 10, width: 1024, height: 40 }).negate().png().toFile(out + "/top_neg.png");
  await sharp(src).extract({ left: 0, top: 65, width: 1024, height: 40 }).negate().png().toFile(out + "/sub_neg.png");
  // left standing/kick area full height
  await sharp(src).extract({ left: 30, top: 95, width: 200, height: 400 }).png().toFile(out + "/left_stack.png");
  // middle sections
  await sharp(src).extract({ left: 220, top: 95, width: 220, height: 430 }).png().toFile(out + "/mid1.png");
  await sharp(src).extract({ left: 440, top: 95, width: 220, height: 430 }).png().toFile(out + "/mid2.png");
  await sharp(src).extract({ left: 640, top: 95, width: 260, height: 430 }).png().toFile(out + "/mid3.png");
  await sharp(src).extract({ left: 880, top: 95, width: 140, height: 430 }).png().toFile(out + "/right.png");
  // bottom icons strip
  await sharp(src).extract({ left: 450, top: 450, width: 520, height: 100 }).png().toFile(out + "/icons.png");
  console.log("ok");
})();
