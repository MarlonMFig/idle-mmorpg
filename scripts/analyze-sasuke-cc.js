const sharp = require("sharp");
const fs = require("fs");

(async () => {
  const { data, info } = await sharp("assets/naruto-source/sasuke-sheet.png").raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const px = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  // more aggressive bg: dark blues
  const isBg = (r, g, b) => {
    // dark blue-teal backgrounds
    if (r < 90 && g < 95 && b < 120 && b >= g - 5 && b >= r) return true;
    if (r < 25 && g < 25 && b < 30) return true; // near black
    return false;
  };

  // Detect label text bands (bright pixels near top)
  console.log("=== bright pixels (labels) by y,x buckets ===");
  for (let y = 0; y < 100; y++) {
    let bright = [];
    for (let x = 0; x < w; x++) {
      const [r, g, b] = px(x, y);
      if (r + g + b > 400) bright.push(x);
    }
    if (bright.length > 5) {
      console.log("y", y, "bright count", bright.length, "xrange", bright[0], bright[bright.length - 1], "xsample", bright.filter((_,i)=>i%20===0).slice(0,15).join(","));
    }
  }

  // Find non-bg connected components roughly via flood fill for bounding boxes (downsample)
  const visited = new Uint8Array(w * h);
  const boxes = [];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx]) continue;
      const [r, g, b] = px(x, y);
      if (isBg(r, g, b)) { visited[idx] = 1; continue; }
      // flood
      let minx = x, maxx = x, miny = y, maxy = y, count = 0;
      const stack = [[x, y]];
      visited[idx] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        count++;
        if (cx < minx) minx = cx;
        if (cx > maxx) maxx = cx;
        if (cy < miny) miny = cy;
        if (cy > maxy) maxy = cy;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (visited[ni]) continue;
          const [rr, gg, bb] = px(nx, ny);
          if (isBg(rr, gg, bb)) { visited[ni] = 1; continue; }
          visited[ni] = 1;
          stack.push([nx, ny]);
        }
      }
      if (count > 80) boxes.push({ minx, maxx, miny, maxy, count, w: maxx - minx + 1, h: maxy - miny + 1 });
    }
  }
  boxes.sort((a, b) => a.miny - b.miny || a.minx - b.minx);
  console.log("=== components count", boxes.length, "===");
  for (const b of boxes) {
    console.log(JSON.stringify(b));
  }
})();
