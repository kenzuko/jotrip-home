import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="review-diff-test-key";
const enc=new TextEncoder();
const digest=await webcrypto.subtle.digest("SHA-256",enc.encode(secret));
const key=await webcrypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt"]);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const session={login:"kenzuko",accessToken:"test-token",exp:Date.now()+60000};
const cipher=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(session)));
const token=Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");
const env={CMS_SESSION_SECRET:secret};
const source=fs.readFileSync(path.join(process.cwd(),"functions/api/cms/review-diff.js"),"utf8");
const {onRequest}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const originalFetch=globalThis.fetch;
let calls=[];
const b64=value=>Buffer.from(JSON.stringify(value),"utf8").toString("base64");
globalThis.fetch=async(url)=>{
  const target=String(url);calls.push(target);
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json"))return Response.json({users:[{login:"kenzuko",role:"admin",enabled:true}]});
  if(target.endsWith("/pulls/45"))return Response.json({head:{ref:"cms/draft/kenzuko-1"}});
  if(target.endsWith("/pulls/46"))return Response.json({head:{ref:"feature/unrelated"}});
  if(target.endsWith("/pulls/45/files?per_page=30"))return Response.json([{filename:"data/home-copy.json"}]);
  if(target.endsWith("/contents/data/home-copy.json?ref=main"))return Response.json({content:b64({hero:{title:"Live title",lead:"Same"}})});
  if(target.endsWith("/contents/data/home-copy.json?ref=cms%2Fdraft%2Fkenzuko-1"))return Response.json({content:b64({hero:{title:"Proposed title",lead:"Same"}})});
  throw new Error("Unexpected GitHub request: "+target);
};
const request=(pr,withCookie=true)=>new Request("https://cms.openphuquoc.com/api/cms/review-diff?pr="+pr,{headers:withCookie?{cookie:"openpq_cms="+token}:{}});

try{
  calls=[];
  const noSession=await onRequest({request:request(45,false),env});
  assert.equal(noSession.status,401);
  assert.equal(calls.length,0,"Unauthenticated requests must not reach GitHub");

  const blocked=await onRequest({request:request(46),env});
  assert.equal(blocked.status,403,"Only CMS draft PRs can be inspected");
  const resultResponse=await onRequest({request:request(45),env});
  const result=await resultResponse.json();
  assert.equal(resultResponse.status,200);
  const title=result.fields[0].fields.find(change=>change.field==="hero.title");
  assert.deepEqual(title,{field:"hero.title",before:"Live title",after:"Proposed title"});
  assert.equal(result.fields[0].fields.length,1,"Unchanged fields must not appear");
  console.log("CMS field diff tests passed: authenticated CMS PRs show only changed fields.");
}finally{
  globalThis.fetch=originalFetch;
}
