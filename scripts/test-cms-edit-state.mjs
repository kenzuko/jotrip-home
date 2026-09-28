import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const coreSource=readFileSync("functions/_shared/cms-mutation-core.js","utf8")
  .replace(/export const /g,"const ")
  .replace(/export async function /g,"async function ")
  .replace(/export function /g,"function ");
const policySource=readFileSync("functions/_shared/cms-mutation-policy.js","utf8")
  .replace(/export const /g,"const ")
  .replace(/export function /g,"function ");
const endpointSource=readFileSync("functions/api/cms/edit-state.js","utf8")
  .replace(/^import .*cms-mutation-core\.js";\n/m,"")
  .replace(/^import .*cms-mutation-policy\\.js";\\n/m,"")
  .replace("export async function onRequest","async function onRequest");
const executable=coreSource+"\n"+policySource+"\n"+endpointSource+";\nthis.onRequest=onRequest;";
new Function(executable);
function testEnv(opts={}){
  const calls=[];
  const session={login:"tester",exp:Date.now()+60000,accessToken:"synthetic-token"};
  const crypto={subtle:{
    async digest(){return new Uint8Array(32)},
    async importKey(){return{}},
    async decrypt(){return new TextEncoder().encode(JSON.stringify(session))}
  }};
  const role=opts.role||"editor";
  const pull={number:17,title:"CMS: bài viết đang duyệt",head:{ref:"cms/draft/tester-review"},
    html_url:"https://github.com/kenzuko/jotrip-home/pull/17",user:{login:"tester"},
    updated_at:"2026-09-27T07:00:00Z"};
  const fetch=async (url,options={})=>{
    calls.push({url,method:options.method||"GET"});
    if(url.includes("raw.githubusercontent.com"))return new Response(JSON.stringify({
      users:[{login:"tester",role,enabled:true}]
    }));
    if(url.includes("/git/ref/heads/main"))return new Response(JSON.stringify({object:{sha:"ffffffffffffffffffffffffffffffffffffffff"}}));
    if(url.includes("/contents/"))return new Response(JSON.stringify({sha:"live-sha"}));
    if(url.includes("/pulls?")){
      if(opts.rateLimit)return new Response(JSON.stringify({message:"rate limited"}),{status:429});
      return new Response(JSON.stringify(opts.noPulls?[]:[pull]),{
        headers:opts.nextPage?{Link:'<next>; rel="next"'}:{}
      });
    }
    if(url.includes("/pulls/17/files"))return new Response(JSON.stringify(
      opts.changedFiles||[{filename:"data/content.json"}]));
    throw Error("Unexpected fetch "+url);
  };
  const ctx={crypto,fetch,Response,URL,TextEncoder,TextDecoder,atob,
    Uint8Array,Date,JSON,String,Number,Object,Array,Set,Promise,encodeURIComponent,decodeURIComponent};
  vm.runInNewContext(executable,ctx);
  const request=(path="data/content.json",method="GET",auth=true)=>new Request(
    "https://cms.openphuquoc.com/api/cms/edit-state?path="+encodeURIComponent(path),
    {method,headers:auth?{cookie:"openpq_cms=AQ.AQ"}:{}}
  );
  return{onRequest:ctx.onRequest,request,env:{CMS_SESSION_SECRET:"synthetic-secret"},calls};
}
{
  const h=testEnv();
  const response=await h.onRequest({request:h.request(),env:h.env});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.sha,"live-sha");
  assert.equal(data.complete,true);
  assert.equal(data.conflicts.length,1);
  assert.equal(data.conflicts[0].number,17);
  assert.equal(data.conflicts[0].url,"https://github.com/kenzuko/jotrip-home/pull/17");
  assert.deepEqual(h.calls.map(x=>x.method),["GET","GET","GET","GET","GET"]);
  assert.equal(response.headers.get("cache-control"),"private, no-store");
  assert.doesNotMatch(JSON.stringify(data),/synthetic-token|synthetic-secret/);
}
{
  const h=testEnv({noPulls:true});
  const r=await h.onRequest({request:h.request(),env:h.env});
  const body=await r.json();
  assert.equal(body.conflicts.length,0);
  assert.equal(body.complete,true);
  assert.equal(h.calls.length,4,"no file-list API calls when there are no pending CMS PRs");
}
{
  const h=testEnv({nextPage:true});
  const body=await(await h.onRequest({request:h.request(),env:h.env})).json();
  assert.equal(body.complete,false,"pagination must never be treated as exhaustive");
}
{
  const h=testEnv({role:"viewer"});
  const denied=await h.onRequest({request:h.request("cms/users.json"),env:h.env});
  assert.equal(denied.status,403);
  const noSession=await h.onRequest({request:h.request("data/content.json","GET",false),env:h.env});
  assert.equal(noSession.status,401);
  const invalid=await h.onRequest({request:h.request("../secrets.json"),env:h.env});
  assert.equal(invalid.status,400);
  const post=await h.onRequest({request:h.request("data/content.json","POST"),env:h.env});
  assert.equal(post.status,405);
}
{
  const h=testEnv({rateLimit:true});
  const failed=await h.onRequest({request:h.request(),env:h.env});
  assert.equal(failed.status,502);
  const body=await failed.json();
  assert.equal(body.error,"Không kiểm tra được xung đột");
  assert.equal(body.conflicts,undefined,"API failure must not masquerade as no conflicts");
}
console.log("PASS CMS edit-state GET-only: fresh role, SHA, pending PR conflict, pagination, authorization, API errors");