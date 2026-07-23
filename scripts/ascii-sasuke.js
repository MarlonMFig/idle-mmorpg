const sharp = require("sharp");
(async () => {
  const { data, info } = await sharp("assets/naruto-source/sasuke-sheet.png")
    .resize(128, 70, { kernel: "nearest" })
    .raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const px = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  function ch(r,g,b) {
    if (r < 90 && g < 95 && b < 120 && Math.abs(r-g)<25) return ".";
    if (b > r + 25 && b > 120) return "B"; // blue lightning
    if (r > 160 && g > 70 && b < 120) return "F"; // fire
    if (r < 50 && g < 45 && b < 45) return "K"; // black
    if (r > 180 && g > 180 && b > 180) return "W";
    if (r > 140 && g > 100 && b > 80) return "o"; // skin/cloth
    if (r + g + b > 350) return "*";
    return "#";
  }
  for (let y = 0; y < h; y++) {
    let row = String(y * 8).padStart(3) + " ";
    for (let x = 0; x < w; x++) row += ch(...px(x, y));
    console.log(row);
  }
  console.log("x   " + [...Array(13)].map((_,i)=>String(i*10*8).padStart(10)).join(""));
})();
