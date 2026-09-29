import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const code=readFileSync("core/public-data.js","utf8");
const calls=[];
let failOnce=true;
const fetch=async(url,options)=>{
  calls.push({url,options});
  if(url==="/data/retry.json"&&failOnce){
    failOnce=false;
    return {ok:false,status:503,json:async()=>({})};
  }
  return {ok:true,status:200,json:async()=>({url,call:calls.length})};
};
const window={};
vm.runInNewContext(code,{
  window,fetch,Map,URL,Error,
  location:{href:"https://openphuquoc.com/"}
});

const first=window.OpenPQPublicData.json("/data/content.json");
const second=window.OpenPQPublicData.json("/data/content.json");
assert.equal(first,second,"Concurrent consumers must share the same request promise");
const [a,b]=await Promise.all([first,second]);
assert.deepEqual(a,b);
assert.equal(calls.filter(x=>x.url==="/data/content.json").length,1,
  "Shared content must be fetched once per page");
assert.equal(calls[0].options.cache,"default",
  "Static data must honor normal HTTP freshness and validators");

await assert.rejects(window.OpenPQPublicData.json("/data/retry.json"),/HTTP 503/);
const retried=await window.OpenPQPublicData.json("/data/retry.json");
assert.equal(retried.url,"/data/retry.json");
assert.equal(calls.filter(x=>x.url==="/data/retry.json").length,2,
  "A failed request must leave the cache so a later retry can recover");

console.log("Public data cache PASS: concurrent dedupe, browser cache and failure recovery");
