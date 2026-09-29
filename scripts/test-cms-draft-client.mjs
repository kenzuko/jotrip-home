import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const src=readFileSync("core/cms-draft-client.js","utf8");
const calls=[];
let currentDraft={
  module_id:"stories",path:"data/content.json",base_sha:"a".repeat(40),
  data:{stories:[{id:"one",title:"Server"}]},version:"v1",
  updated_at:"2026-09-29T00:00:00.000Z"
};
const fetchMock=async(url,options={})=>{
  const target=String(url),method=options.method||"GET";
  calls.push({target,method,body:options.body?JSON.parse(options.body):null});
  if(method==="GET"){
    return Response.json({draft:currentDraft,history:[],storage:"d1"});
  }
  const body=JSON.parse(options.body||"{}");
  if(body.action==="save"){
    if(body.expected_version!==(currentDraft?.version??null)){
      return Response.json({error:"conflict",draft:currentDraft},{status:409});
    }
    currentDraft={module_id:body.module_id,path:body.path,base_sha:body.base_sha,
      data:body.data,version:"v2",updated_at:"2026-09-29T00:01:00.000Z"};
    return Response.json({ok:true,draft:currentDraft,history:[]});
  }
  if(body.action==="clear"){
    if(body.expected_version!==(currentDraft?.version??null)){
      return Response.json({error:"conflict",draft:currentDraft},{status:409});
    }
    currentDraft=null;
    return Response.json({ok:true,cleared:true,history:[]});
  }
  return Response.json({error:"bad request"},{status:400});
};

const window={};
vm.runInNewContext(src,{window,fetch:fetchMock,Response,Map,JSON,Promise,Error,String,encodeURIComponent});
const store=window.OPQDraftStore;
assert.ok(store);

const server=await store.load("data/content.json");
assert.equal(server.ok,true);
assert.equal(store.token("data/content.json"),"v1");

const cmpSame=store.compare({
  localDraft:{sha:"a".repeat(40),data:currentDraft.data},
  serverDraft:currentDraft,baseSha:"a".repeat(40)
});
assert.equal(cmpSame.state,"same");

const cmpDiverged=store.compare({
  localDraft:{sha:"a".repeat(40),data:{stories:[{id:"one",title:"Local"}]}},
  serverDraft:currentDraft,baseSha:"a".repeat(40)
});
assert.equal(cmpDiverged.state,"diverged");

const saved=await store.save({
  module:"stories",path:"data/content.json",baseSha:"a".repeat(40),
  data:{stories:[{id:"one",title:"Saved"}]}
});
assert.equal(saved.ok,true);
assert.equal(calls.at(-1).body.expected_version,"v1");
assert.equal(store.token("data/content.json"),"v2");

currentDraft={...currentDraft,data:{stories:[{id:"one",title:"Other device"}]},version:"v3"};
const stale=await store.save({
  module:"stories",path:"data/content.json",baseSha:"a".repeat(40),
  data:{stories:[{id:"one",title:"Must not overwrite"}]}
});
assert.equal(stale.ok,false);
assert.equal(stale.status,409);
assert.equal(store.token("data/content.json"),"v3","409 must advance the local token to the current server draft");

const cleared=await store.clear({path:"data/content.json"});
assert.equal(cleared.ok,true);
assert.equal(calls.at(-1).body.expected_version,"v3");
assert.equal(store.token("data/content.json"),null);

const freshWindow={};
let writeCalls=0;
const offlineFetch=async()=>{writeCalls++;throw new Error("offline")};
vm.runInNewContext(src,{window:freshWindow,fetch:offlineFetch,Response,Map,JSON,Promise,Error,String,encodeURIComponent});
const skipped=await freshWindow.OPQDraftStore.save({
  module:"stories",path:"data/content.json",baseSha:"a".repeat(40),data:{stories:[]}
});
assert.equal(skipped.skipped,true,"Client must never blind-write before loading the server draft version");
assert.equal(writeCalls,0);

console.log("PASS CMS draft client: D1 token sync, divergence detection, 409 refresh, guarded clear and no blind writes");
