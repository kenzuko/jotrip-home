import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {webcrypto} from "node:crypto";

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const secret="rollback-test-key",enc=new TextEncoder();
const digest=await webcrypto.subtle.digest("SHA-256",enc.encode(secret));
const key=await webcrypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt"]);
const iv=webcrypto.getRandomValues(new Uint8Array(12));
const payload={login:"kenzuko",accessToken:"test-token",exp:Date.now()+60000};
const cipher=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,enc.encode(JSON.stringify(payload)));
const token=Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");
const env={CMS_SESSION_SECRET:secret};
const source=fs.readFileSync(path.join(process.cwd(),"functions/api/cms/rollback.js"),"utf8");
const {onRequest}=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
const originalFetch=globalThis.fetch;
const previous={hero:{title:"Previous",lead:"Lead"}};
let liveSha="target-final-blob",calls=[];
const toB64=value=>Buffer.from(value,"utf8").toString("base64");
globalThis.fetch=async(url,options={})=>{
  const target=String(url),method=options.method||"GET";calls.push({target,method,body:options.body});
  if(target.startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json"))return Response.json({users:[{login:"kenzuko",role:"admin",enabled:true}]});
  if(target.endsWith("/pulls/17"))return Response.json({merged:true,head:{ref:"cms/draft/kenzuko-17"},merge_commit_sha:"merge-sha"});
  if(target.endsWith("/pulls?state=open&per_page=100"))return Response.json([]);
  if(target.endsWith("/pulls/17/files?per_page=10"))return Response.json([{filename:"data/home-copy.json",status:"modified",sha:"target-final-blob"}]);
  if(target.endsWith("/commits/merge-sha"))return Response.json({parents:[{sha:"parent-sha"}]});
  if(target.endsWith("/git/ref/heads/main"))return Response.json({object:{sha:"main-head"}});
  if(target.endsWith("/contents/data/home-copy.json?ref=main-head"))return Response.json({sha:liveSha});
  if(target.endsWith("/contents/data/home-copy.json?ref=parent-sha"))return Response.json({encoding:"base64",content:toB64(JSON.stringify(previous,null,2)+"\n")});
  if(target.endsWith("/git/refs")&&method==="POST"){
    assert.match(JSON.parse(options.body).ref,/^refs\/heads\/cms\/draft\/rollback-17-/);
    return Response.json({ref:"created"});
  }
  if(target.endsWith("/contents/data/home-copy.json")&&method==="PUT"){
    const body=JSON.parse(options.body);
    assert.equal(body.sha,"target-final-blob");
    assert.match(body.branch,/^cms\/draft\/rollback-17-/);
    assert.equal(Buffer.from(body.content,"base64").toString("utf8"),JSON.stringify(previous,null,2)+"\n");
    return Response.json({commit:{sha:"rollback-commit"}});
  }
  if(target.endsWith("/pulls")&&method==="POST"){
    const body=JSON.parse(options.body);
    assert.equal(body.draft,false);
    assert.equal(body.base,"main");
    assert.match(body.title,/rollback #17/);
    return Response.json({number:27,html_url:"https://github.com/kenzuko/jotrip-home/pull/27"},{status:201});
  }
  throw new Error("Unexpected GitHub request: "+method+" "+target);
};
const request=()=>new Request("https://cms.openphuquoc.com/api/cms/rollback",{method:"POST",headers:{cookie:"openpq_cms="+token,origin:"https://cms.openphuquoc.com","content-type":"application/json"},body:JSON.stringify({pr_number:17})});

try{
  calls=[];liveSha="later-change";
  const conflict=await onRequest({request:request(),env});
  assert.equal(conflict.status,409,"Later edits to the same file must block automatic rollback");
  assert.equal(calls.some(x=>x.method==="POST"||x.method==="PUT"),false,"A conflict must not create a branch or write");

  calls=[];liveSha="target-final-blob";
  const response=await onRequest({request:request(),env});
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.pull_request.number,27);
  assert.ok(calls.some(x=>x.method==="PUT"),"Rollback must restore content on a separate branch");
  assert.ok(calls.some(x=>x.method==="POST"&&x.target.endsWith("/pulls")),"Rollback must stay behind a new PR");
  console.log("CMS rollback tests passed: later edits conflict; safe rollback opens a review PR.");
}finally{globalThis.fetch=originalFetch}
