const sharp = require("sharp");
(async () => {
  const { data, info } = await sharp("assets/naruto-source/sasuke-sheet.png").raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const px = (x, y) => { const i = (y * w + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const isBg = (r, g, b) => (r < 90 && g < 95 && b < 120 && b >= g - 5) || (r < 20 && g < 20 && b < 25);

  function contentBBox(x0, x1, y0, y1, pred) {
    let minx = 9999, maxx = -1, miny = 9999, maxy = -1, c = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const p = px(x, y);
        if (isBg(...p)) continue;
        if (pred && !pred(...p)) continue;
        c++;
        minx = Math.min(minx, x); maxx = Math.max(maxx, x);
        miny = Math.min(miny, y); maxy = Math.max(maxy, y);
      }
    }
    return c > 30 ? { minx, maxx, miny, maxy, c, w: maxx - minx + 1, h: maxy - miny + 1 } : null;
  }

  // Per-top-cell blue ratio
  console.log("TOP CELL blue ratios");
  for (const [x0, x1] of [[260,335],[335,400],[430,485],[490,555],[555,625],[645,720],[725,795],[805,875],[915,995]]) {
    let blue=0,n=0;
    for(let y=100;y<175;y++) for(let x=x0;x<=x1;x++){
      const [r,g,b]=px(x,y); if(isBg(r,g,b)) continue; n++; if(b>r+20 && b>100) blue++;
    }
    console.log(x0, "blue%", n? (blue/n*100).toFixed(1):0, "n", n, "bbox", contentBBox(x0,x1,100,175));
  }

  // Bottom strip components with color
  console.log("\nBOTTOM icons colors");
  const bottoms = [
    [460,510,470,535],[520,590,470,535],[590,640,470,535],[645,700,470,535],
    [700,760,470,540],[760,825,470,540],[820,885,470,540],[875,945,470,540],[900,970,440,540]
  ];
  for (const [x0,x1,y0,y1] of bottoms) {
    let r=0,g=0,b=0,n=0,blue=0,orange=0,black=0;
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const p=px(x,y); if(isBg(...p)) continue; n++; r+=p[0];g+=p[1];b+=p[2];
      if(p[2]>p[0]+20 && p[2]>100) blue++;
      if(p[0]>160 && p[1]>60 && p[2]<110) orange++;
      if(p[0]<55 && p[1]<45 && p[2]<45) black++;
    }
    if(n>100) console.log(x0+"-"+x1, "n",n,"mean",Math.round(r/n),Math.round(g/n),Math.round(b/n),"blue",blue,"orange",orange,"black",black,"bbox", contentBBox(x0,x1,y0,y1));
  }

  // Separate left columns more tightly - only character-sized connected content using earlier CC boxes
  // Re-run CC but filter to left zone and print sorted
  console.log("\nLEFT zone refined: scan row gaps");
  // horizontal projection for x40-120 and x140-230
  for (const [name,x0,x1] of [["A",40,120],["B",140,230]]) {
    const row=[];
    for(let y=95;y<500;y++){
      let c=0; for(let x=x0;x<=x1;x++){ const p=px(x,y); if(!isBg(...p)) c++; }
      row.push(c);
    }
    let runs=[], inR=false,s=0;
    for(let i=0;i<=row.length;i++){
      const v=i<row.length?row[i]:0;
      if(v>10 && !inR){inR=true;s=i;}
      if((v<=10||i===row.length)&&inR){runs.push([s+95,i-1+95, row.slice(s,i).reduce((a,b)=>a+b,0)]); inR=false;}
    }
    console.log(name, "y-runs", runs);
    for (const [y0,y1] of runs) console.log(" ", contentBBox(x0,x1,y0,y1));
  }

  // Blue left column (kirin/chidori cast area x270-420) y runs
  console.log("\nBLUE LEFT x270-420 y-runs");
  {
    const x0=270,x1=420; const row=[];
    for(let y=180;y<540;y++){ let c=0; for(let x=x0;x<=x1;x++){const p=px(x,y); if(!isBg(...p)) c++;} row.push(c); }
    let runs=[], inR=false,s=0;
    for(let i=0;i<=row.length;i++){
      const v=i<row.length?row[i]:0;
      if(v>40 && !inR){inR=true;s=i;}
      if((v<=40||i===row.length)&&inR){runs.push([s+180,i-1+180]); inR=false;}
    }
    console.log(runs);
    for (const [y0,y1] of runs) console.log(contentBBox(x0,x1,y0,y1));
  }

  // Sample chroma more carefully from known bg
  console.log("\nChroma samples");
  for (const [x,y] of [[10,10],[10,250],[120,180],[240,180],[450,200],[630,180],[900,200],[400,50]]) {
    console.log(x,y,px(x,y).join(","));
  }
})();
