// Build the official Open Phu Quoc favicon from the existing approved PNG.
// Crops ONLY the eye/wave symbol. Never redraws the logo or includes the wordmark.
// Pure Node built-ins: works in both Cloudflare Pages and GitHub build environments.
import {readFile,writeFile,readdir,mkdir} from "node:fs/promises";
import {join,dirname} from "node:path";
import {inflateSync,deflateSync} from "node:zlib";

const dist=process.env.OPENPQ_DIST||"dist";
const MAGIC=Buffer.from([137,80,78,71,13,10,26,10]);
const expect=(ok,message)=>{if(!ok)throw Error("OpenPQ favicon: "+message)};
function crc32(bytes){
  let crc=0xffffffff;
  for(const value of bytes){crc^=value;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}
  return (crc^0xffffffff)>>>0;
}
function chunk(type,payload){
  const t=Buffer.from(type,"ascii"),b=Buffer.alloc(12+payload.length);
  b.writeUInt32BE(payload.length,0);t.copy(b,4);payload.copy(b,8);
  b.writeUInt32BE(crc32(b.subarray(4,8+payload.length)),8+payload.length);
  return b;
}
function decodePng(file){
  expect(file.subarray(0,8).equals(MAGIC),"official logo is not a PNG");
  let width,height,depth,type,interlace,palette=null,transparency=null;
  const idat=[];
  for(let p=8;p<file.length;){
    const len=file.readUInt32BE(p),tag=file.toString("ascii",p+4,p+8);
    expect(p+len+12<=file.length,"damaged PNG chunk");
    const bytes=file.subarray(p+8,p+8+len);p+=len+12;
    if(tag==="IHDR"){width=bytes.readUInt32BE(0);height=bytes.readUInt32BE(4);depth=bytes[8];type=bytes[9];interlace=bytes[12]}
    else if(tag==="IDAT")idat.push(bytes);
    else if(tag==="PLTE")palette=bytes;
    else if(tag==="tRNS")transparency=bytes;
    else if(tag==="IEND")break;
  }
  expect(width>=300&&height>=300&&width<=5000&&height<=5000,"unexpected official logo dimensions");
  expect(depth===8&&interlace===0&&[0,2,3,4,6].includes(type),"unsupported official PNG format");
  const bpp=({0:1,2:3,3:1,4:2,6:4})[type],stride=width*bpp;
  const zipped=inflateSync(Buffer.concat(idat));
  expect(zipped.length===(stride+1)*height,"PNG decompression size mismatch");
  const image=Buffer.alloc(width*height*4);
  let previous=Buffer.alloc(stride),read=0;
  for(let y=0;y<height;y++){
    const filter=zipped[read++],row=Buffer.allocUnsafe(stride);
    for(let x=0;x<stride;x++){
      const n=zipped[read++],a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0;
      let p=0;
      if(filter===1)p=a;else if(filter===2)p=b;else if(filter===3)p=Math.floor((a+b)/2);
      else if(filter===4){
        const pr=a+b-c,pa=Math.abs(pr-a),pb=Math.abs(pr-b),pc=Math.abs(pr-c);
        p=pa<=pb&&pa<=pc?a:pb<=pc?b:c;
      }else expect(filter===0,"unsupported PNG row filter");
      row[x]=(n+p)&255;
    }
    for(let x=0;x<width;x++){
      const i=x*bpp,j=(y*width+x)*4;
      if(type===6){image[j]=row[i];image[j+1]=row[i+1];image[j+2]=row[i+2];image[j+3]=row[i+3]}
      if(type===2){image[j]=row[i];image[j+1]=row[i+1];image[j+2]=row[i+2];image[j+3]=255}
      if(type===4){image[j]=image[j+1]=image[j+2]=row[i];image[j+3]=row[i+1]}
      if(type===0){image[j]=image[j+1]=image[j+2]=row[i];image[j+3]=255}
      if(type===3){
        const n=row[i],q=n*3;
        expect(palette&&q+2<palette.length,"invalid indexed PNG palette");
        image[j]=palette[q];image[j+1]=palette[q+1];image[j+2]=palette[q+2];
        image[j+3]=transparency?.[n]??255;
      }
    }
    previous=row;
  }
  return {width,height,rgba:image};
}
function symbolBounds(source){
  // Verified layout of official logo-master.png: symbol is the upper 61%,
  // "OPEN PHU QUOC" wordmark starts below it. Never include text in icons.
  const maxY=Math.floor(source.height*.61);
  let minX=source.width,minY=maxY,maxX=-1,maxSeenY=-1;
  for(let y=0;y<maxY;y++)for(let x=0;x<source.width;x++){
    const alpha=source.rgba[(y*source.width+x)*4+3];
    if(alpha<50)continue;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxSeenY=Math.max(maxSeenY,y);
  }
  expect(maxX-minX>=source.width*.65,"eye symbol not detected");
  expect(maxSeenY<maxY-3,"symbol crop might include the wordmark");
  expect(maxSeenY-minY>=source.height*.32,"symbol height suspiciously small");
  return {x:minX,y:minY,w:maxX-minX+1,h:maxSeenY-minY+1};
}
function render(source,box,size){
  const out=Buffer.alloc(size*size*4);
  const targetWidth=size*.90,scale=targetWidth/box.w;
  const targetHeight=box.h*scale,offsetX=(size-targetWidth)/2,offsetY=(size-targetHeight)/2;
  // Supersampling protects the original wave and orange center at 16-48px.
  const taps=size<=48?6:size<=192?3:2;
  function sample(x,y){
    const xx=Math.max(0,Math.min(source.width-1,x)),yy=Math.max(0,Math.min(source.height-1,y));
    const x0=Math.floor(xx),y0=Math.floor(yy),x1=Math.min(source.width-1,x0+1),y1=Math.min(source.height-1,y0+1);
    const fx=xx-x0,fy=yy-y0,values=[0,0,0,0];
    for(const [xi,yi,weight] of [[x0,y0,(1-fx)*(1-fy)],[x1,y0,fx*(1-fy)],[x0,y1,(1-fx)*fy],[x1,y1,fx*fy]]){
      const i=(yi*source.width+xi)*4,a=source.rgba[i+3]/255;
      values[0]+=source.rgba[i]*a*weight;values[1]+=source.rgba[i+1]*a*weight;
      values[2]+=source.rgba[i+2]*a*weight;values[3]+=a*weight;
    }
    return values;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let r=0,g=0,b=0,a=0;
    for(let sy=0;sy<taps;sy++)for(let sx=0;sx<taps;sx++){
      const u=(x+(sx+.5)/taps-offsetX)/scale+box.x;
      const v=(y+(sy+.5)/taps-offsetY)/scale+box.y;
      if(u<box.x||u>=box.x+box.w||v<box.y||v>=box.y+box.h)continue;
      const q=sample(u,v);r+=q[0];g+=q[1];b+=q[2];a+=q[3];
    }
    const samples=taps*taps,i=(y*size+x)*4;
    a/=samples;
    out[i]=a?Math.round(r/samples/a):0;
    out[i+1]=a?Math.round(g/samples/a):0;
    out[i+2]=a?Math.round(b/samples/a):0;
    out[i+3]=Math.round(a*255);
  }
  return out;
}
function encodePng(width,height,rgba){
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  const rows=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++){
    const d=y*(width*4+1);rows[d]=1; // Sub filtering gives compact transparent PNGs.
    for(let x=0;x<width*4;x++){
      const i=y*width*4+x;rows[d+1+x]=(rgba[i]-(x>=4?rgba[i-4]:0)+256)&255;
    }
  }
  return Buffer.concat([MAGIC,chunk("IHDR",ihdr),chunk("IDAT",deflateSync(rows,{level:9})),chunk("IEND",Buffer.alloc(0))]);
}
function encodeIco(sizes){
  const header=Buffer.alloc(6+16*sizes.length);
  header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  for(let i=0;i<sizes.length;i++){
    const {size,png}=sizes[i],p=6+16*i;
    header[p]=size;header[p+1]=size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);
    header.writeUInt32LE(png.length,p+8);header.writeUInt32LE(offset,p+12);offset+=png.length;
  }
  return Buffer.concat([header,...sizes.map(s=>s.png)]);
}
const logo=decodePng(await readFile("assets/logo-master.png"));
const bounds=symbolBounds(logo);
const pngs=new Map();
for(const size of [16,32,48,64,96,180,192,512])pngs.set(size,encodePng(size,size,render(logo,bounds,size)));
const put=async(rel,bytes)=>{const target=join(dist,rel);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes)};
await put("favicon.ico",encodeIco([16,32,48,64].map(size=>({size,png:pngs.get(size)}))));
await put("favicon-48.png",pngs.get(48));
await put("apple-touch-icon.png",pngs.get(180));
await put("assets/favicon-192.png",pngs.get(192));
await put("assets/favicon-512.png",pngs.get(512));
// Existing SVG references now show the exact approved eye rather than the old,
 // unrelated hand-drawn placeholder. This fallback embeds only our 96px cropped mark.
await put("assets/favicon.svg",'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,'+pngs.get(96).toString("base64")+'"/></svg>\n');
await put("site.webmanifest",JSON.stringify({
  name:"Open Phu Quoc",short_name:"Open Phu Quoc",start_url:"/",scope:"/",display:"standalone",
  icons:[{src:"/assets/favicon-192.png",sizes:"192x192",type:"image/png"},{src:"/assets/favicon-512.png",sizes:"512x512",type:"image/png"}]
},null,2)+"\n");
const iconLinks=[
  '<link rel="icon" href="/favicon.ico" sizes="any">',
  '<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">',
  '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
  '<link rel="manifest" href="/site.webmanifest">'
].join("\n  ");
let count=0;
async function rewrite(directory){
  const entries=await readdir(directory,{withFileTypes:true});
  for(const entry of entries){
    if(entry.isDirectory()){
      if(["assets","data","cms"].includes(entry.name))continue;
      await rewrite(join(directory,entry.name));
    }else if(entry.isFile()&&entry.name.endsWith(".html")){
      const file=join(directory,entry.name);
      let html=(await readFile(file,"utf8")).replace(/<link\b[^>]*\brel=["'](?:shortcut )?icon["'][^>]*>\s*/gi,"")
        .replace(/<link\b[^>]*\brel=["']apple-touch-icon["'][^>]*>\s*/gi,"")
        .replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>\s*/gi,"");
      const next=html.replace(/<\/head>/i,"  "+iconLinks+"\n</head>");
      if(next===html)continue;
      await writeFile(file,next);count++;
    }
  }
}
await rewrite(dist);
expect(count>=10,"too few HTML pages received the official favicon");
console.log("OPENPQ OFFICIAL FAVICON PASS:",bounds, "HTML pages:",count,
 "full wordmark untouched; PNG 48/180/192/512, ICO and SVG fallback generated");
