const sharp = require("sharp");
(async () => {
  const { data, info } = await sharp("assets/naruto-source/sasuke-sheet.png").raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const px = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const isBg = (r, g, b) => r < 90 && g < 95 && b < 120 && b >= g - 5;

  // Find dark-but-not-bg (amaterasu flames often dark red/black with red edges)
  console.log("=== dark-red / amaterasu-ish windows ===");
  for (let y = 100; y < 540; y += 15) {
    for (let x = 200; x < 1000; x += 15) {
      let darkRed = 0, n = 0;
      for (let yy = y; yy < y + 35 && yy < h; yy++) {
        for (let xx = x; xx < x + 35 && xx < w; xx++) {
          const [r, g, b] = px(xx, yy);
          if (isBg(r, g, b)) continue;
          n++;
          if (r > 40 && r < 140 && g < 60 && b < 60 && r > g + 10) darkRed++;
          if (r < 50 && g < 35 && b < 35 && r + g + b > 15) darkRed++;
        }
      }
      if (darkRed > 80) console.log("dark@", x, y, darkRed, "of", n);
    }
  }

  // Tight bboxes for left columns by scanning each row band
  function contentBBox(x0, x1, y0, y1) {
    let minx = 9999, maxx = -1, miny = 9999, maxy = -1, c = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const [r, g, b] = px(x, y);
        if (isBg(r, g, b)) continue;
        c++;
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
    return c ? { minx, maxx, miny, maxy, c, w: maxx - minx + 1, h: maxy - miny + 1 } : null;
  }

  console.log("\n=== left column A bands ===");
  for (const [y0, y1] of [[100,170],[190,270],[290,370],[410,490]]) {
    console.log("A", contentBBox(40, 120, y0, y1));
  }
  console.log("=== left column B bands ===");
  for (const [y0, y1] of [[100,170],[190,270],[290,370],[410,490]]) {
    console.log("B", contentBBox(140, 230, y0, y1));
  }

  console.log("\n=== top row individual char bboxes ===");
  const tops = [
    [250,340],[340,400],[420,490],[490,560],[560,630],[640,720],[720,800],[800,870],[900,990]
  ];
  for (const [x0,x1] of tops) console.log(x0, contentBBox(x0, x1, 100, 170));

  console.log("\n=== fireball orb bboxes ===");
  console.log("orb1", contentBBox(490, 630, 220, 340));
  console.log("orb2", contentBBox(490, 630, 350, 455));
  console.log("cast chars near fireball", contentBBox(440, 500, 260, 320), contentBBox(440, 500, 370, 430));

  console.log("\n=== chidori large ===");
  console.log(contentBBox(620, 900, 190, 360));
  console.log("chidori lower", contentBBox(700, 880, 340, 440));
  console.log("blue left stack", contentBBox(270, 420, 195, 330), contentBBox(270, 420, 330, 430), contentBBox(270, 420, 420, 530));

  console.log("\n=== right side ===");
  console.log(contentBBox(900, 1000, 95, 200));
  console.log(contentBBox(900, 1000, 250, 380));
  console.log(contentBBox(900, 1000, 430, 540));

  // Sample average color of top-row cells to classify
  console.log("\n=== top row mean colors ===");
  for (const [x0,x1] of tops) {
    let r=0,g=0,b=0,n=0;
    for(let y=110;y<160;y++) for(let x=x0;x<x1;x++){
      const p=px(x,y); if(isBg(...p)) continue; r+=p[0];g+=p[1];b+=p[2];n++;
    }
    if(n) console.log(x0+"-"+x1, "mean", Math.round(r/n), Math.round(g/n), Math.round(b/n), "n", n);
  }
})();
