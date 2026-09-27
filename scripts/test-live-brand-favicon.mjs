// Production smoke test. Checks Cloudflare's actual bytes, never browser cache.
import assert from "node:assert/strict";
const host="https://cms.openphuquoc.com";
const pngMagic=Buffer.from([137,80,78,71,13,10,26,10]);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path){
 const response=await fetch(host+path+(path.includes("?")?"&":"?")+"fresh="+Date.now(),{
  redirect:"follow",headers:{"Cache-Control":"no-cache","User-Agent":"OpenPQ-official-brand-live-QA/1.0"},signal:AbortSignal.timeout(16000)
 });
 assert.equal(response.status,200,path+" returned HTTP "+response.status);
 return{response,bytes:Buffer.from(await response.arrayBuffer())};
}
async function verify(){
 const home=(await get("/")).bytes.toString("utf8");
 assert.match(home,/href="\/favicon-48\.png"/,"homepage must link 48px official icon");
 assert.match(home,/href="\/favicon\.ico"/,"homepage must link classic favicon");
 assert.match(home,/https:\/\/cms\.openphuquoc\.com\/assets\/logo-master\.png/,"organization JSON-LD still links full original brand");
 const admin=(await get("/admin/")).bytes.toString("utf8");
 assert.match(admin,/href="\/favicon-48\.png"/,"CMS Admin must share official favicon");
 const p48=(await get("/favicon-48.png")).bytes;
 assert.ok(p48.subarray(0,8).equals(pngMagic),"favicon-48.png must be real PNG, not Cloudflare HTML fallback");
 assert.equal(p48.readUInt32BE(16),48);assert.equal(p48.readUInt32BE(20),48);
 const ico=(await get("/favicon.ico")).bytes;
 assert.equal(ico.readUInt16LE(0),0);assert.equal(ico.readUInt16LE(2),1);
 assert.equal(ico.readUInt16LE(4),4);
 const sizes=[...Array(4)].map((_,i)=>ico[6+i*16]);
 assert.deepEqual(sizes,[16,32,48,64]);
 const match=3,base=6+match*16,len=ico.readUInt32LE(base+8),offset=ico.readUInt32LE(base+12);
 assert.ok(ico.subarray(offset,offset+len).equals(p48),"classic ICO must contain the same approved 48px icon");
 const apple=(await get("/apple-touch-icon.png")).bytes;
 assert.ok(apple.subarray(0,8).equals(pngMagic)&&apple.readUInt32BE(16)===180,"Apple icon must be PNG180");
 const manifest=JSON.parse((await get("/site.webmanifest")).bytes.toString("utf8"));
 assert.deepEqual(manifest.icons.map(x=>x.sizes),["192x192","512x512"]);
 const fallback=(await get("/assets/favicon.svg")).bytes.toString("utf8");
 assert.ok(fallback.includes("data:image/png;base64,")&&!fallback.includes("F2EBDD"),"obsolete old favicon must be replaced");
 console.log("BRAND FAVICON LIVE PASS: Google PNG48, official ICO 16/32/48/64, Apple180, all public and admin metadata, original full Organization logo");
}
let last;
for(let attempt=1;attempt<=15;attempt++){
 try{await verify();process.exit(0)}catch(e){last=e;console.log("Waiting for Cloudflare favicon deploy",attempt+"/15:",String(e.message).slice(0,240));if(attempt<15)await sleep(12000)}
}
console.error("BRAND FAVICON LIVE FAILED:",last?.stack||last);process.exit(1);
