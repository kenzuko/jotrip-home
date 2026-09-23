import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="quality-test-key",enc=new TextEncoder();
const digest=await webcrypto.subtle.digest("SHA-256",enc.encode(secret));
const key=await webcrypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt"]);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const payload={login:"kenzuko",exp:Date.now()+60000};
const cipher=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(payload)));
const token=Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");
const env={CMS_SESSION_SECRET:secret};
const source=fs.readFileSync(path.join(process.cwd(),"functions/api/cms/quality.js"),"utf8");
const {onRequest}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const originalFetch=globalThis.fetch;
const calls=[];
globalThis.fetch=async url=>{
  const target=String(url);calls.push(target);
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json"))return Response.json({users:[{login:"kenzuko",role:"admin",enabled:true}]});
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/data/entities/destination-venues.json"))return Response.json({entities:[
    {id:"venue_a",name:"Điểm A",category:"ATTRACTION",status:"ACTIVE",latitude:10,longitude:104,source_ref:"src-a",verified_at:"2026-09-22"},
    {id:"venue_b",name:"Điểm B",category:"ATTRACTION",status:"REVIEW",latitude:null,longitude:104}
  ]});
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/data/entities/food.json"))return Response.json({entities:[
    {id:"food_ghe",legacy_id:"ghe-ham-ninh",name:"Ghẹ Hàm Ninh"}
  ]});
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/data/food.json"))return Response.json({dishes:[]});
  throw new Error("Unexpected request "+target);
};
const request=withCookie=>new Request("https://cms.openphuquoc.com/api/cms/quality",withCookie?{headers:{cookie:"openpq_cms="+token}}:{});
try{
  calls.length=0;
  const anon=await onRequest({request:request(false),env});
  assert.equal(anon.status,401);
  assert.equal(calls.length,0,"Anonymous requests must not load CMS data");
  const response=await onRequest({request:request(true),env});
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.storage,"computed-from-main");
  const keys=result.tasks.map(x=>x.rule_id+"|"+x.entity_id+"|"+x.field);
  assert.equal(new Set(keys).size,keys.length,"Tasks should be deduplicated by record and field");
  assert.ok(result.tasks.some(x=>x.rule_id==="VENUE_COORDINATE_PRECISION_MISSING"&&x.entity_id==="venue_a"));
  assert.ok(result.tasks.some(x=>x.rule_id==="VENUE_COORDINATE_MISSING"&&x.entity_id==="venue_b"));
  assert.ok(result.tasks.some(x=>x.rule_id==="FOOD_ARTICLE_GAP"&&x.entity_id==="food_ghe"));
  assert.ok(result.tasks.some(x=>x.rule_id==="FOOD_PILOT_NO_VERIFIED_VENUES"));
  assert.ok(result.tasks.every(x=>x.owner==="kenzuko"&&x.status==="open"&&x.persistence==="computed"));
  assert.match(result.note,/chưa có trạng thái nhận việc/);
  console.log("CMS quality queue tests passed: authenticated, deduplicated and evidence-backed tasks.");
}finally{globalThis.fetch=originalFetch}
