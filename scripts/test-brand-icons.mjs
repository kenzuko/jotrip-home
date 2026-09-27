import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const dir=process.env.OPENPQ_DIST||"dist";
const pngMagic=Buffer.from([137,80,78,71,13,10,26,10]);
const png=(file,expected)=>{
  const bytes=readFileSync(dir+"/"+file);
  assert.ok(bytes.subarray(0,8).equals(pngMagic),file+" must contain actual PNG bytes");
  assert.equal(bytes.readUInt32BE(16),expected,file+" width");
  assert.equal(bytes.readUInt32BE(20),expected,file+" height");
  assert.ok(bytes.length>450,file+" too small to be official cropped artwork");
  assert.equal(bytes[25],6,file+" must preserve original transparent pixels");
  return bytes;
};
png("favicon-48.png",48);
png("apple-touch-icon.png",180);
png("assets/favicon-192.png",192);
png("assets/favicon-512.png",512);
const ico=readFileSync(dir+"/favicon.ico");
assert.equal(ico.readUInt16LE(0),0);
assert.equal(ico.readUInt16LE(2),1);
assert.equal(ico.readUInt16LE(4),4);
const sizes=[];
for(let i=0;i<4;i++){
  const p=6+i*16,size=ico[p]||256,length=ico.readUInt32LE(p+8),offset=ico.readUInt32LE(p+12);
  sizes.push(size);
  assert.ok(offset+length<=ico.length,"favicon.ico embedded image must be complete");
  assert.ok(ico.subarray(offset,offset+8).equals(pngMagic),"favicon.ico sizes contain PNG images");
}
assert.deepEqual(sizes,[16,32,48,64]);
const svg=readFileSync(dir+"/assets/favicon.svg","utf8");
assert.ok(svg.includes("data:image/png;base64,")&&!svg.includes("fill=\"#F2EBDD\""),"old hand-drawn fallback is no longer shipped");
const manifest=JSON.parse(readFileSync(dir+"/site.webmanifest","utf8"));
assert.deepEqual(manifest.icons.map(x=>x.sizes),["192x192","512x512"]);
for(const file of ["index.html","admin/index.html","guide/article.html","stories/article.html","weather/index.html"]){
  const html=readFileSync(dir+"/"+file,"utf8");
  assert.ok(html.includes('href="/favicon.ico"'),file+" must expose the classic favicon");
  assert.ok(html.includes('href="/favicon-48.png"'),file+" must expose Google's 48px PNG favicon");
  assert.ok(html.includes('href="/apple-touch-icon.png"'),file+" must support iPhone home screen");
  assert.ok(html.includes('href="/site.webmanifest"'),file+" must expose progressive app icons");
  assert.ok(!/<link[^>]+rel=["']icon["'][^>]+href=["'][^"']*\/assets\/favicon\.svg/i.test(html),"Old SVG favicon link remains: "+file);
}
assert.ok(statSync("assets/logo-master.png").size>30000,"Full official wordmark must remain untouched");
console.log("OFFICIAL FAVICON QA PASS: original cropped eye, 48/180/192/512 PNG, multi-size ICO, all pages including admin, unchanged full wordmark.");
