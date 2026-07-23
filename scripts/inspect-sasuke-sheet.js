const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

(async () => {
  const src = "assets/naruto-source/sasuke-sheet.png";
  const outDir = "assets/naruto-source/_inspect";
  fs.mkdirSync(outDir, { recursive: true });
  const w = 1024, h = 559;
  let lines = "";
  for (let x = 0; x <= w; x += 50) {
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="rgba(255,0,0,0.5)" stroke-width="1"/>`;
    lines += `<text x="${x + 2}" y="12" fill="yellow" font-size="10" font-family="monospace">${x}</text>`;
  }
  for (let y = 0; y <= h; y += 25) {
    lines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="rgba(0,255,255,0.35)" stroke-width="1"/>`;
    lines += `<text x="2" y="${y + 10}" fill="lime" font-size="9" font-family="monospace">${y}</text>`;
  }
  const svg = `<svg width="${w}" height="${h}">${lines}</svg>`;
  await sharp(src).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(path.join(outDir, "grid.png"));

  const bands = [
    ["top_labels", 0, 0, 1024, 50],
    ["row1_chars", 0, 90, 1024, 120],
    ["row2_mid", 0, 190, 1024, 180],
    ["row3_lower", 0, 360, 1024, 180],
  ];
  for (const [n, l, t, ww, hh] of bands) {
    await sharp(src).extract({ left: l, top: t, width: ww, height: hh }).png().toFile(path.join(outDir, n + ".png"));
  }
  for (let i = 0; i < 8; i++) {
    const left = i * 128;
    await sharp(src).extract({ left, top: 60, width: 128, height: 480 }).png().toFile(path.join(outDir, "col" + i + ".png"));
  }
  console.log("wrote inspect files");
})();
