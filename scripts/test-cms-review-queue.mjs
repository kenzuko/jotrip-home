import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="test-only-cms-review-queue";
const encoder=new TextEncoder();
const digest=await webcrypto.subtle.digest("SHA-256",encoder.encode(secret));
const key=await webcrypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt"]);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const payload={login:"kenzuko",role:"admin",accessToken:"private-token",exp:Date.now()+60000};
const cipher=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode(JSON.stringify(payload)));
const token=Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");
const env={CMS_SESSION_SECRET:secret};
const request=()=>new Request("https://cms.openphuquoc.com/api/cms/reviews",{headers:{cookie:"openpq_cms="+token}});
const source=fs.readFileSync(path.join(process.cwd(),"functions/api/cms/reviews.js"),"utf8");
const {onRequest}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const originalFetch=globalThis.fetch;
let requested="";
globalThis.fetch=async url=>{
  const target=String(url);
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json")){
    return Response.json({users:[{login:"kenzuko",role:"admin",enabled:true}]});
  }
  if(target.includes("/pulls?")&&target.endsWith("state=open")){
    requested=target;
    return Response.json([
      {number:8,title:"CMS draft",html_url:"https://github.com/kenzuko/jotrip-home/pull/8",draft:true,user:{login:"kenzuko"},head:{ref:"cms/draft/kenzuko-1"},created_at:"2026-09-23T09:00:00Z",updated_at:"2026-09-23T09:05:00Z",changed_files:1,additions:3,deletions:1,body:"must not be returned"},
      {number:9,title:"Other PR",html_url:"https://github.com/kenzuko/jotrip-home/pull/9",draft:false,user:{login:"kenzuko"},head:{ref:"feature/other"},changed_files:1}
    ]);
  }
  if(target.includes("/pulls?")&&target.endsWith("state=closed")){
    return Response.json([
      {number:7,title:"CMS published",html_url:"https://github.com/kenzuko/jotrip-home/pull/7",user:{login:"kenzuko"},head:{ref:"cms/draft/kenzuko-old"},merged_at:"2026-09-22T09:00:00Z",changed_files:1},
      {number:6,title:"Old unrelated",head:{ref:"feature/old"},merged_at:"2026-09-22T08:00:00Z"}
    ]);
  }
  throw new Error("Unexpected request "+target);
};

try{
  const anonymous=await onRequest({request:new Request("https://cms.openphuquoc.com/api/cms/reviews"),env});
  assert.equal(anonymous.status,401,"Anonymous queue access must be denied");

  const response=await onRequest({request:request(),env});
  const result=await response.json();
  assert.equal(response.status,200);
  assert.match(requested,/state=open/);
  assert.equal(result.count,1,"Only CMS proposal branches belong in the review queue");
  assert.equal(result.items[0].number,8);
  assert.equal(result.items[0].draft,true);
  assert.equal(result.history.length,1,"Only merged CMS drafts belong in recent history");
  assert.equal(result.history[0].number,7);
  assert.equal(result.history[0].can_rollback,true);
  assert.equal("body" in result.items[0],false,"The queue should expose metadata only, not proposal contents");
  assert.equal(JSON.stringify(result).includes("private-token"),false,"The session token must never be returned");
  console.log("CMS review queue tests passed: authenticated, CMS draft branches only, metadata-only response");
}finally{
  globalThis.fetch=originalFetch;
}
