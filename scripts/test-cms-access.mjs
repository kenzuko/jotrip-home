import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;

const secret="test-only-cms-session-key";
const text=new TextEncoder();
const keyBytes=await webcrypto.subtle.digest("SHA-256",text.encode(secret));
const key=await webcrypto.subtle.importKey("raw",keyBytes,{name:"AES-GCM"},false,["encrypt"]);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const payload={login:"kenzuko",role:"admin",exp:Date.now()+60000};
const ciphertext=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,text.encode(JSON.stringify(payload)));
const b64=v=>Buffer.from(v).toString("base64url");
const token=b64(iv)+"."+b64(ciphertext);
const request=pathName=>new Request("https://cms.openphuquoc.com"+pathName,{
  headers:{cookie:"openpq_cms="+token}
});
const env={CMS_SESSION_SECRET:secret};

async function loadApi(filename){
  const source=fs.readFileSync(path.join(process.cwd(),"functions/api/cms",filename),"utf8");
  return import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
}
const [session,content,analytics]=await Promise.all([
  loadApi("session.js"),loadApi("content.js"),loadApi("analytics.js")
]);
let liveRole="viewer";
let liveEnabled=true;
let sourceAvailable=true;
let reads=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async url=>{
  reads++;
  if(!String(url).startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json")){
    throw new Error("Unexpected external request: "+String(url));
  }
  if(!sourceAvailable)return new Response("Unavailable",{status:503});
  return new Response(JSON.stringify({
    users:[{login:"kenzuko",role:liveRole,enabled:liveEnabled}]
  }),{status:200,headers:{"Content-Type":"application/json"}});
};

try{
  const live=await session.onRequest({request:request("/api/cms/session"),env});
  assert.equal(live.status,200,"Valid token with active account must work");
  assert.equal((await live.json()).role,"viewer","Current role must override stale admin cookie");

  const deniedContent=await content.onRequest({
    request:request("/api/cms/content?path=cms%2Fusers.json"),env
  });
  assert.equal(deniedContent.status,403,"Demoted admin cannot read admin-only CMS data");

  const deniedAnalytics=await analytics.onRequest({request:request("/api/cms/analytics"),env});
  assert.equal(deniedAnalytics.status,403,"Demoted admin cannot read D1 analytics");

  liveEnabled=false;
  assert.equal((await session.onRequest({request:request("/api/cms/session"),env})).status,401);
  assert.equal((await content.onRequest({
    request:request("/api/cms/content?path=cms%2Fusers.json"),env
  })).status,403);
  assert.equal((await analytics.onRequest({request:request("/api/cms/analytics"),env})).status,403);

  liveEnabled=true;
  sourceAvailable=false;
  assert.notEqual((await session.onRequest({request:request("/api/cms/session"),env})).status,200,
    "Permission source outages must fail closed");
  assert.notEqual((await content.onRequest({
    request:request("/api/cms/content?path=cms%2Fusers.json"),env
  })).status,200);
  assert.notEqual((await analytics.onRequest({request:request("/api/cms/analytics"),env})).status,200);

  const anonymous=new Request("https://cms.openphuquoc.com/api/cms/session");
  assert.equal((await session.onRequest({request:anonymous,env})).status,401);
  assert.ok(reads>=6,"Every protected request must check the current permissions");
  console.log("CMS role regression tests passed: demotion, disable, source outage and anonymous requests");
}finally{
  globalThis.fetch=originalFetch;
}
