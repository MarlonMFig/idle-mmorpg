const sharp = require("sharp");
(async () => {
  const { data, info } = await sharp("assets/naruto-source/sasuke-sheet.png").raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const px = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  function regionStats(name, x0, y0, x1, y1) {
    let n = 0, blue = 0, orange = 0, black = 0, white = 0, purple = 0, cyan = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const [r, g, b] = px(x, y);
        if (r < 90 && g < 95 && b < 120 && b >= g - 5) continue; // bg
        n++;
        if (b > r + 30 && b > g + 10) blue++;
        if (r > 180 && g > 80 && g < 200 && b < 100) orange++;
        if (r < 40 && g < 40 && b < 40) black++;
        if (r > 200 && g > 200 && b > 200) white++;
        if (r > 100 && b > 120 && g < 100) purple++;
        if (g > 150 && b > 150 && r < 120) cyan++;
      }
    }
    console.log(name, { n, blue, orange, black, white, purple, cyan, box: [x0,y0,x1,y1] });
  }
  // major content regions
  regionStats("leftA_r1", 50, 110, 105, 150);
  regionStats("leftB_r1", 155, 110, 220, 150);
  regionStats("top_mid_chars", 260, 110, 800, 160);
  regionStats("big_642", 642, 202, 889, 352);
  regionStats("box_279", 279, 203, 406, 316);
  regionStats("box_498", 498, 225, 621, 350);
  regionStats("box_322", 322, 343, 404, 420);
  regionStats("box_718", 718, 354, 861, 428);
  regionStats("box_502b", 502, 355, 619, 447);
  regionStats("box_281b", 281, 426, 407, 518);
  regionStats("char_458", 458, 275, 490, 320);
  regionStats("icon829", 829, 482, 876, 530);
  regionStats("icon883", 883, 482, 933, 532);
  regionStats("icon772", 772, 486, 812, 534);
  regionStats("icon713", 713, 485, 752, 534);
  regionStats("icon657", 657, 485, 690, 530);
  regionStats("right_927", 920, 100, 980, 190);
  regionStats("right_818", 810, 110, 860, 155);

  // scan for orange fireball-like blobs
  console.log("\n=== orange-heavy 40x40 windows ===");
  for (let y = 100; y < 520; y += 20) {
    for (let x = 200; x < 980; x += 20) {
      let orange = 0, n = 0;
      for (let yy = y; yy < y + 40 && yy < h; yy++) {
        for (let xx = x; xx < x + 40 && xx < w; xx++) {
          const [r, g, b] = px(xx, yy);
          if (r < 90 && g < 95 && b < 120) continue;
          n++;
          if (r > 160 && g > 60 && b < 110) orange++;
        }
      }
      if (orange > 200) console.log("orange@", x, y, orange, "of", n);
    }
  }
  console.log("\n=== cyan/blue-heavy windows ===");
  for (let y = 100; y < 520; y += 20) {
    for (let x = 200; x < 980; x += 20) {
      let blue = 0, n = 0;
      for (let yy = y; yy < y + 40 && yy < h; yy++) {
        for (let xx = x; xx < x + 40 && xx < w; xx++) {
          const [r, g, b] = px(xx, yy);
          if (r < 90 && g < 95 && b < 120) continue;
          n++;
          if (b > r + 25 && b > 100) blue++;
        }
      }
      if (blue > 250) console.log("blue@", x, y, blue, "of", n);
    }
  }
})();
