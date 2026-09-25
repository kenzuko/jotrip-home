import {readFile,stat} from "node:fs/promises";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
const out=process.env.OPENPQ_DIST||"dist",file=out+"/assets/share-card-phu-quoc-v2.jpg";
const data=await readFile(file);
assert.ok(data.length>75000&&data.length<6000000,"Social preview image size must be 75KB-6MB");
assert.ok(data[0]===0xff&&data[1]===0xd8,"Share preview must be JPEG, not SVG");
for(const path of [out+"/index.html",out+"/go/index.html",out+"/explore/index.html"]){
 const html=await readFile(path,"utf8");
 assert.ok(html.includes('https://cms.openphuquoc.com/assets/share-card-phu-quoc-v2.jpg'),path+" preview URL");
 assert.ok(!html.includes('https://cms.openphuquoc.com/assets/share-card.svg'),path+" must not use SVG preview");
}
const home=await readFile(out+"/index.html","utf8");
assert.ok(home.includes('Phú Quốc, ngay lúc này | Open Phu Quoc'),"Correctly accented homepage title");
assert.ok(home.includes('property="og:image:type" content="image/jpeg"'),"Correct mime");
const provenance=JSON.parse(await readFile(out+"/assets/share-card-provenance.json","utf8"));
assert.ok(provenance.width>=1200&&provenance.height>=600,"Sufficient resolution");
if(existsSync("assets/share-card-approved.jpg")){
 const approved=await readFile("assets/share-card-approved.jpg");
 assert.deepEqual(data,approved,"Published image must match the approved original exactly");
 assert.equal(provenance.source,"Open Phu Quoc approved social card");
}
assert.ok(home.includes('property="og:image:width" content="'+provenance.width+'"'),"Correct preview width");
assert.ok(home.includes('property="og:image:height" content="'+provenance.height+'"'),"Correct preview height");
assert.ok(home.includes("Ảnh chia sẻ:"),"Photo attribution rendered");
console.log("Social preview test PASS",data.length,"bytes",provenance.width+"x"+provenance.height,provenance.source);
