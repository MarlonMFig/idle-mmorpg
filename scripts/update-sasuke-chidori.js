const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

// Re-run only chidori with adjusted large frame by patching rects in process script via inline
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "naruto-source", "sasuke-sheet.png");
const OUT = path.join(ROOT, "public", "sprites", "player", "sasuke");

const CHROMAS = [
  [33, 36, 57], [30, 35, 54], [56, 61, 81], [55, 60, 80], [40, 45, 65], [29, 34, 53], [63, 65, 80],
];
const TOL = 52;
function dist2(r,g,b,c){const dr=r-c[0],dg=g-c[1],db=b-c[2];return dr*dr+dg*dg+db*db;}
function isChroma(r,g,b){const maxD=TOL*TOL; for(const c of CHROMAS) if(dist2(r,g,b,c)<=maxD) return true; return r+g+b<18;}
function extractRect(data,sw,sh,rect){
  const {left,top,width,height}=rect; const out=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const sx=left+x,sy=top+y,di=(y*width+x)*4;
    if(sx<0||sy<0||sx>=sw||sy>=sh){out[di+3]=0;continue;}
    const si=(sy*sw+sx)*4,r=data[si],g=data[si+1],b=data[si+2];
    if(isChroma(r,g,b)) out[di+3]=0; else {out[di]=r;out[di+1]=g;out[di+2]=b;out[di+3]=255;}
  }
  return out;
}
function contentBounds(buf,w,h,pad=2){
  let minx=w,miny=h,maxx=-1,maxy=-1;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    if(buf[(y*w+x)*4+3]<16) continue;
    if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
  }
  if(maxx<0) return {left:0,top:0,width:w,height:h};
  const L=Math.max(0,minx-pad),T=Math.max(0,miny-pad);
  return {left:L,top:T,width:Math.min(w,maxx+pad+1)-L,height:Math.min(h,maxy+pad+1)-T};
}
function cropBuf(buf,w,h,box){
  const out=Buffer.alloc(box.width*box.height*4);
  for(let y=0;y<box.height;y++) for(let x=0;x<box.width;x++){
    const si=((box.top+y)*w+(box.left+x))*4, di=(y*box.width+x)*4;
    out[di]=buf[si];out[di+1]=buf[si+1];out[di+2]=buf[si+2];out[di+3]=buf[si+3];
  }
  return out;
}
function padTo(buf,w,h,tw,th){
  const out=Buffer.alloc(tw*th*4);
  const xOff=Math.floor((tw-w)/2), yOff=Math.floor((th-h)/2);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const si=(y*w+x)*4, di=((yOff+y)*tw+(xOff+x))*4;
    out[di]=buf[si];out[di+1]=buf[si+1];out[di+2]=buf[si+2];out[di+3]=buf[si+3];
  }
  return out;
}
function stitchH(frames,fw,fh){
  const n=frames.length,out=Buffer.alloc(fw*n*fh*4);
  for(let f=0;f<n;f++) for(let y=0;y<fh;y++) frames[f].copy(out,(y*fw*n+f*fw)*4,y*fw*4,(y+1)*fw*4);
  return {data:out,width:fw*n,height:fh};
}

(async()=>{
  const {data,info}=await sharp(SRC).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const sw=info.width, sh=info.height;
  // charge 2 + large orb + 2 character+lightning impacts from left stack
  const rects=[
    {left:265,top:110,width:70,height:55},
    {left:338,top:110,width:65,height:55},
    {left:655,top:210,width:200,height:140}, // large chidori orb (character-scale crop of big blue)
    {left:268,top:338,width:145,height:90},
    {left:268,top:420,width:145,height:105},
  ];
  const keyed=rects.map(r=>{
    const buf=extractRect(data,sw,sh,r);
    const box=contentBounds(buf,r.width,r.height,2);
    return {buf:cropBuf(buf,r.width,r.height,box), w:box.width, h:box.height};
  });
  const fw=Math.max(...keyed.map(k=>k.w));
  const fh=Math.max(...keyed.map(k=>k.h));
  const frames=keyed.map(k=>padTo(k.buf,k.w,k.h,fw,fh));
  const sheet=stitchH(frames,fw,fh);
  await sharp(sheet.data,{raw:{width:sheet.width,height:sheet.height,channels:4}}).png().toFile(path.join(OUT,"sasuke-chidori.png"));
  console.log("updated sasuke-chidori.png", sheet.width+"x"+sheet.height, "fw="+fw, "fh="+fh, "count=5");

  // update meta.json entry
  const metaPath=path.join(OUT,"meta.json");
  const meta=JSON.parse(fs.readFileSync(metaPath,"utf8"));
  meta["sasuke-chidori"]={
    frameWidth:fw, frameHeight:fh, frameCount:5, image:"sasuke-chidori.png",
    chroma:{samples:CHROMAS.map(([r,g,b])=>({r,g,b})), tolerance:TOL},
    outputSize:{width:sheet.width,height:sheet.height},
    sourceRects:rects,
    sequence:["charge","charge","large","impact","impact"]
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta,null,2)+"\n");
  console.log("meta updated");
})();
