import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="test-only-cms-session-key";
const encoder=new TextEncoder();
const digest=await webcrypto.subtle.digest("SHA-256",encoder.encode(secret));
const key=await webcrypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt"]);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const payload={login:"kenzuko",role:"admin",accessToken:"test-token",exp:Date.now()+60000};
const cipher=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode(JSON.stringify(payload)));
const token=Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");
const env={CMS_SESSION_SECRET:secret};
const request=body=>new Request("https://cms.openphuquoc.com/api/cms/publish",{
  method:"POST",
  headers:{cookie:"openpq_cms="+token,origin:"https://cms.openphuquoc.com","content-type":"application/json"},
  body:JSON.stringify(body)
});
const fileContent={hero:{title:"Test",lead:"Test lead"}};
const base={path:"data/home-copy.json",sha:"expected-file-sha",content:fileContent,message:"update home"};
const source=fs.readFileSync(path.join(process.cwd(),"functions/api/cms/publish.js"),"utf8");
const {onRequest}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const originalFetch=globalThis.fetch;
let liveSha="expected-file-sha";
let calls=[];
globalThis.fetch=async(url,options={})=>{
  const target=String(url);
  calls.push({url:target,method:options.method||"GET",body:options.body});
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json")){
    return Response.json({users:[{login:"kenzuko",role:"admin",enabled:true}]});
  }
  if(target==="https://api.github.com/repos/kenzuko/jotrip-home/contents/data/home-copy.json?ref=main"){
    return Response.json({sha:liveSha});
  }
  if(target==="https://api.github.com/repos/kenzuko/jotrip-home/git/ref/heads/main"){
    return Response.json({object:{sha:"main-head-sha"}});
  }
  if(target==="https://api.github.com/repos/kenzuko/jotrip-home/git/refs"&&options.method==="POST"){
    return Response.json({ref:JSON.parse(options.body).ref},{status:201});
  }
  if(target==="https://api.github.com/repos/kenzuko/jotrip-home/contents/data/home-copy.json"&&options.method==="PUT"){
    const data=JSON.parse(options.body);
    assert.match(data.branch,/^cms\/draft\/kenzuko-/);
    assert.equal(data.sha,"expected-file-sha");
    return Response.json({content:{sha:"new-file-sha"},commit:{sha:"content-commit-sha"}});
  }
  if(target==="https://api.github.com/repos/kenzuko/jotrip-home/pulls"&&options.method==="POST"){
    const pr=JSON.parse(options.body);
    assert.equal(pr.base,"main");
    assert.equal(pr.draft,false,"The owner should receive a PR ready to review");
    assert.match(pr.head,/^cms\/draft\/kenzuko-/);
    return Response.json({number:91,html_url:"https://github.com/kenzuko/jotrip-home/pull/91",draft:true},{status:201});
  }
  throw new Error("Unexpected GitHub request: "+options.method+" "+target);
};

try{
  liveSha="newer-live-sha";
  calls=[];
  const conflict=await onRequest({request:request(base),env});
  assert.equal(conflict.status,409,"Stale base SHA must be rejected");
  assert.equal(calls.some(x=>x.method==="POST"||x.method==="PUT"),false,"Stale edits must not create a branch or PR");

  liveSha="expected-file-sha";
  calls=[];
  const proposed=await onRequest({request:request(base),env});
  const result=await proposed.json();
  assert.equal(proposed.status,200);
  assert.equal(result.pull_request?.number,91);
  assert.equal(result.pull_request?.draft,true);
  assert.ok(calls.some(x=>x.method==="POST"&&x.url.endsWith("/pulls")),"A valid edit must open a owner-review PR");
  assert.equal(calls.some(x=>x.method==="PUT"&&x.url.endsWith("/contents/data/home-copy.json")&&!JSON.parse(x.body).branch),false,
    "CMS proposals must never write directly to main");
  console.log("CMS draft review tests passed: stale SHA blocked; valid content saved to a draft PR");
}finally{
  globalThis.fetch=originalFetch;
}
