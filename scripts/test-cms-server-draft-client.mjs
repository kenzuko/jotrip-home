import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const source=readFileSync("admin/server-drafts.js","utf8");
const window={};
const calls=[];
let releaseFirst=null;
let holdFirst=true;
const fetch=(url,options={})=>{
  const body=options.body?JSON.parse(options.body):null;
  calls.push({url:String(url),options,body});
  if(holdFirst){
    holdFirst=false;
    return new Promise(resolve=>{
      releaseFirst=()=>resolve(Response.json({ok:true,draft:{path:body?.path||null}}));
    });
  }
  return Promise.resolve(Response.json({ok:true,draft:{path:body?.path||null},history:[]}));
};
vm.runInNewContext(source,{window,fetch,Response,Promise,Map,JSON,String,Boolean,Error,encodeURIComponent});
const api=window.OPQServerDrafts;
assert.ok(api&&typeof api.save==="function"&&typeof api.clear==="function"&&typeof api.load==="function");

const save=api.save({
  moduleId:"stories",path:"data/content.json",baseSha:"a".repeat(40),
  data:{stories:[{id:"one",title:"Draft"}]}
});
const clear=api.clear("data/content.json");
await Promise.resolve();
assert.equal(calls.length,1,"Same-path clear must queue behind an in-flight save");
assert.equal(calls[0].body.action,"save");
assert.equal(calls[0].options.credentials,"include");
releaseFirst();
await save;
await clear;
assert.equal(calls.length,2);
assert.equal(calls[1].body.action,"clear","Publish/reset clear must run after the last queued save");

const loaded=await api.load("data/content.json");
assert.equal(calls.at(-1).options.credentials,"include");
assert.match(calls.at(-1).url,/\/api\/cms\/drafts\?path=data%2Fcontent\.json/);
assert.equal(loaded.ok,true);

const admin=readFileSync("admin/admin.js","utf8");
const html=readFileSync("admin/index.html","utf8");
assert.match(html,/server-drafts\.js\?v=1/);
assert.match(html,/admin\.js\?v=42/);
assert.ok(html.indexOf("server-drafts.js?v=1")<html.indexOf("admin.js?v=42"),
  "Server draft helper must load before admin.js");
assert.match(admin,/SERVER_DRAFT_SYNC_MS=8000/);
assert.match(admin,/if\(dirty\)void syncServerDraft\(\{silent:true\}\)/,
  "A timer from the previous module must not create a clean draft for the next module");
assert.match(admin,/syncServerDraft\(\{checkpoint:true,silent:false\}\)/,
  "Manual save must create a durable checkpoint");
assert.match(admin,/clearServerDraft\(savingModule\.path/,
  "Successful publish must clear the current server draft");
assert.match(admin,/clearServerDraft\(path,\{silent:false\}\)/,
  "Reset must clear the server draft as well as local cache");
assert.match(admin,/localStorage\.setItem/,
  "LocalStorage must remain as immediate/offline fallback");

console.log("CMS server draft client PASS: same-path queue, 8s mirror, manual checkpoint, publish/reset clear and local fallback.");
