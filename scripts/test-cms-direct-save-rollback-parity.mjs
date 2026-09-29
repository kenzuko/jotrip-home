import assert from "node:assert/strict";
import fs from "node:fs";

const policy=fs.readFileSync(new URL("../functions/_shared/cms-mutation-policy.js",import.meta.url),"utf8")
  .replace(/export const /g,"const ").replace(/export function /g,"function ");
let endpoint=fs.readFileSync(new URL("../functions/api/cms/rollback.js",import.meta.url),"utf8")
  .replace(/^import .*\n/gm,"")
  .replace("export async function onRequest","async function onRequest")
  .replace("export const ROLLBACK_TEST=","const ROLLBACK_TEST=");
const prefix=`
const CMS_REPO_API="https://api.github.com/repos/kenzuko/jotrip-home";
async function githubJson(url,token,options={}){const response=await fetch(url,options);let value={};try{value=await response.json()}catch{}return{response,value};}
async function readCmsSession(){return{login:"kenzuko",accessToken:"token"};}
async function readCurrentCmsRole(){return "admin";}
function sameOrigin(request,{allowMissing=true}={}){const o=request.headers.get("origin"),expected=new URL(request.url).origin;return allowMissing?(!o||o===expected):o===expected;}
function createCmsMutationAudit(x={}){return{schema:"openpq-cms-mutation-v1",operation:x.operation,actor:x.actor,role:x.role,base_main_sha:x.baseMainSha,paths:x.paths||[],before_file_shas:x.beforeFileShas||{},after_file_shas:x.afterFileShas||{},changed_fields:x.changedFields||[],record_id:x.recordId||null,branch:x.branch||null,mutation_commit_sha:x.mutationCommitSha||null};}
function formatCmsMutationAudit(a){return "## CMS mutation metadata\\n"+JSON.stringify(a);}
`;
const code=prefix+"\n"+policy+"\n"+endpoint+"\nexport {onRequest,ROLLBACK_TEST};";
const mod=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const {onRequest,ROLLBACK_TEST}=mod;
const SOURCE="1".repeat(40),PARENT="2".repeat(40),MAIN="3".repeat(40),TREE="4".repeat(40),NEW_TREE="5".repeat(40),ROLLBACK="6".repeat(40);
const FOOD="data/i18n/vi/food.json",MIRROR="data/food.json";
const AFTER_FOOD="a".repeat(40),AFTER_MIRROR="b".repeat(40),BLOB_FOOD="c".repeat(40),BLOB_MIRROR="d".repeat(40),BEFORE_FOOD="e".repeat(40),BEFORE_MIRROR="f".repeat(40);
const beforeFood={locale:"vi",dishes:[{id:"bun",name:"Cũ"}]};
const beforeMirror={dishes:[{id:"bun",name:"Cũ"}]};
const b64=x=>Buffer.from(JSON.stringify(x,null,2)+"\n").toString("base64");
function trailers(){return [
 "cms(admin): sửa chữ trực tiếp bun",
 "",
 "OpenPQ-CMS-Mutation: v1",
 "CMS-Operation: direct-save",
 "CMS-Actor: kenzuko",
 "CMS-Role: admin",
 "CMS-Base-Main-SHA: "+PARENT,
 "CMS-Paths: "+FOOD+","+MIRROR,
 "CMS-Before-File-SHAs: "+FOOD+"="+BEFORE_FOOD+";"+MIRROR+"="+BEFORE_MIRROR,
 "CMS-After-File-SHAs: "+FOOD+"="+AFTER_FOOD+";"+MIRROR+"="+AFTER_MIRROR,
 "CMS-Changed-Fields: intro,tips.0",
 "CMS-Record-ID: bun"
].join("\n")}
function request({origin="https://cms.openphuquoc.com"}={}){const headers={"content-type":"application/json"};if(origin!==null)headers.origin=origin;return new Request("https://cms.openphuquoc.com/api/cms/rollback",{method:"POST",headers,body:JSON.stringify({direct_save_commit:SOURCE})})}
function harness({changedPath=null,ancestry="ahead",sourcePaths=[FOOD,MIRROR],sourceStatus="modified",sourceAfterMismatch=null,beforeMismatch=null,parentCount=1}={}){
 const calls=[],blobShas=[BLOB_FOOD,BLOB_MIRROR];let blobIndex=0;
 globalThis.fetch=async(url,options={})=>{
  const target=String(url),method=options.method||"GET";calls.push({target,method,body:options.body?JSON.parse(options.body):null});
  if(target.endsWith("/commits/"+SOURCE))return Response.json({commit:{message:trailers()},parents:Array.from({length:parentCount},(_,i)=>({sha:i===0?PARENT:"7".repeat(40)})),files:sourcePaths.map(path=>({filename:path,status:sourceStatus,sha:path===sourceAfterMismatch?"7".repeat(40):(path===FOOD?AFTER_FOOD:AFTER_MIRROR)}))});
  if(target.endsWith("/pulls?state=open&per_page=100"))return Response.json([]);
  if(target.endsWith("/git/ref/heads/main"))return Response.json({object:{sha:MAIN}});
  if(target.endsWith("/compare/"+SOURCE+"..."+MAIN))return Response.json({status:ancestry});
  if(target.includes("/contents/"+FOOD+"?ref="+MAIN))return Response.json({sha:changedPath===FOOD?"9".repeat(40):AFTER_FOOD});
  if(target.includes("/contents/"+MIRROR+"?ref="+MAIN))return Response.json({sha:changedPath===MIRROR?"8".repeat(40):AFTER_MIRROR});
  if(target.includes("/contents/"+FOOD+"?ref="+PARENT))return Response.json({sha:beforeMismatch===FOOD?"7".repeat(40):BEFORE_FOOD,encoding:"base64",content:b64(beforeFood)});
  if(target.includes("/contents/"+MIRROR+"?ref="+PARENT))return Response.json({sha:beforeMismatch===MIRROR?"7".repeat(40):BEFORE_MIRROR,encoding:"base64",content:b64(beforeMirror)});
  if(target.endsWith("/git/commits/"+MAIN))return Response.json({tree:{sha:TREE}});
  if(target.endsWith("/git/blobs")&&method==="POST")return Response.json({sha:blobShas[blobIndex++]});
  if(target.endsWith("/git/trees")&&method==="POST")return Response.json({sha:NEW_TREE});
  if(target.endsWith("/git/commits")&&method==="POST")return Response.json({sha:ROLLBACK});
  if(target.endsWith("/git/refs")&&method==="POST")return Response.json({ref:"ok"});
  if(target.endsWith("/pulls")&&method==="POST")return Response.json({number:31,html_url:"https://github.com/kenzuko/jotrip-home/pull/31"},{status:201});
  throw new Error("Unexpected "+method+" "+target);
 };
 return calls;
}

const parsed=ROLLBACK_TEST.parseDirectSaveAudit(trailers());
assert.deepEqual([...parsed.paths],[FOOD,MIRROR]);
assert.equal(parsed.base_main_sha,PARENT);
assert.equal(parsed.after_file_shas[FOOD],AFTER_FOOD);
assert.equal(ROLLBACK_TEST.parseDirectSaveAudit("CMS-Operation: direct-save"),null);
assert.equal(ROLLBACK_TEST.parseDirectSaveAudit(trailers().replace("CMS-Paths: "+FOOD+","+MIRROR,"CMS-Paths: "+FOOD+","+FOOD+","+MIRROR)),null,"Duplicate audit paths must be rejected");

let calls=harness();
let response=await onRequest({request:request(),env:{CMS_SESSION_SECRET:"x"}}),body=await response.json();
assert.equal(response.status,200,JSON.stringify(body));
assert.equal(body.pull_request.number,31);
assert.deepEqual([...body.files],[FOOD,MIRROR]);
assert.equal(body.audit.operation,"direct-save-rollback-proposal");
assert.equal(body.rollback_commit,ROLLBACK);
assert.equal(calls.filter(x=>x.target.endsWith("/git/blobs")&&x.method==="POST").length,2);
const treeCall=calls.find(x=>x.target.endsWith("/git/trees")&&x.method==="POST");
assert.equal(treeCall.body.tree.length,2,"Food rollback must restore both blobs in one Git tree");
assert.deepEqual(treeCall.body.tree.map(x=>x.path),[FOOD,MIRROR]);
assert.ok(calls.some(x=>x.target.endsWith("/pulls")&&x.method==="POST"),"Safe direct-save rollback stays behind a PR");

for(const changedPath of [FOOD,MIRROR]){
 calls=harness({changedPath});
 response=await onRequest({request:request(),env:{CMS_SESSION_SECRET:"x"}});body=await response.json();
 assert.equal(response.status,409,changedPath);
 assert.equal(calls.some(x=>x.method==="POST"&&(/\/git\/(blobs|trees|commits|refs)$/.test(x.target)||x.target.endsWith("/pulls"))),false,
   "Any later edit must block all rollback writes: "+changedPath);
}

calls=harness({ancestry:"diverged"});
response=await onRequest({request:request(),env:{CMS_SESSION_SECRET:"x"}});
assert.equal(response.status,409,"Source direct-save must still be an ancestor of main");
assert.equal(calls.some(x=>x.method==="POST"),false);
for(const bad of [
 {sourcePaths:[FOOD],label:"forged audit path set"},
 {sourceAfterMismatch:FOOD,label:"forged post-save blob"},
 {beforeMismatch:MIRROR,label:"forged pre-save blob"},
 {parentCount:2,label:"merge commit pretending to be direct-save"}
]){
 calls=harness(bad);response=await onRequest({request:request(),env:{CMS_SESSION_SECRET:"x"}});body=await response.json();
 assert.equal(response.status,409,bad.label+": "+JSON.stringify(body));
 assert.equal(calls.some(x=>x.method==="POST"),false,bad.label+" must not create rollback objects");
}

calls=harness();
response=await onRequest({request:request({origin:null}),env:{CMS_SESSION_SECRET:"x"}});
assert.equal(response.status,403,"Rollback POST requires explicit same-origin Origin header");
assert.equal(calls.some(x=>x.method==="POST"),false);

console.log("PASS P2.4 hardened direct-save rollback: atomic Food unit, audit/file integrity, ancestry, later-edit and same-origin guards");
