import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
const source=readFileSync("functions/api/cms/direct-save.js","utf8")
  .replace("export async function onRequest","async function onRequest")
  .replace("export const DIRECT_SAVE_TEST=","const DIRECT_SAVE_TEST=")
  +"\nthis.onRequest=onRequest;this.helpers=DIRECT_SAVE_TEST;";
const SHA="a".repeat(40),MAIN="f".repeat(40);
const base={stories:[{id:"one",title:"Bài gốc",dek:"Lời giới thiệu",
  intro:"Mở bài",sections:[{heading:"Một",body:"Nội dung gốc"}]}]};
const encode=obj=>Buffer.from(JSON.stringify(obj)).toString("base64");
function harness({role="admin",stale=false,conflict=false,failPatch=false}={}){
  const history=[],blobs=[];
  const session={login:"qa",accessToken:"test-token",exp:Date.now()+3600000};
  const crypto={subtle:{
    digest:async()=>new Uint8Array(32),importKey:async()=>({}),
    decrypt:async()=>new TextEncoder().encode(JSON.stringify(session))
  }};
  const fetch=async(url,opts={})=>{
    const method=opts.method||"GET";
    history.push({url:String(url),method,body:opts.body?JSON.parse(opts.body):null});
    if(url.includes("raw.githubusercontent.com"))return new Response(
      JSON.stringify({users:[{login:"qa",role,enabled:true}]}));
    if(url.endsWith("/git/ref/heads/main")&&method==="GET")
      return new Response(JSON.stringify({object:{sha:MAIN}}));
    if(url.includes("/contents/data/content.json?"))
      return new Response(JSON.stringify({sha:stale?"b".repeat(40):SHA,
        encoding:"base64",content:encode(base)}));
    if(url.includes("/pulls?")){
      return new Response(JSON.stringify(conflict?[{number:4,html_url:"https://github.com/kenzuko/jotrip-home/pull/4"}]:[]));
    }
    if(url.endsWith("/pulls/4/files"))
      return new Response(JSON.stringify([{filename:"data/content.json"}]));
    if(url.endsWith("/git/blobs")&&method==="POST"){
      blobs.push(JSON.parse(opts.body));
      return new Response(JSON.stringify({sha:"b".repeat(40)}));
    }
    if(url.endsWith("/git/commits/"+MAIN))
      return new Response(JSON.stringify({tree:{sha:"c".repeat(40)}}));
    if(url.endsWith("/git/trees")&&method==="POST")
      return new Response(JSON.stringify({sha:"d".repeat(40)}));
    if(url.endsWith("/git/commits")&&method==="POST")
      return new Response(JSON.stringify({sha:"e".repeat(40)}));
    if(url.endsWith("/git/refs/heads/main")&&method==="PATCH")
      return new Response(JSON.stringify(failPatch?{message:"Protected branch"}:{ref:"main"}),
        {status:failPatch?403:200});
    throw Error("Unexpected GitHub request "+method+" "+url);
  };
  const ctx={crypto,fetch,Request,Response,URL,TextEncoder,TextDecoder,atob,
    Uint8Array,Date,JSON,String,Number,Object,Array,Set,Promise,encodeURIComponent};
  vm.runInNewContext(source,ctx);
  const req=(payload,headers={})=>new Request(
    "https://cms.openphuquoc.com/api/cms/direct-save",{
      method:"POST",headers:{cookie:"openpq_cms=AA.AA",
        Origin:"https://cms.openphuquoc.com","Content-Type":"application/json",...headers},
      body:JSON.stringify(payload)
    });
  const payload={path:"data/content.json",record_id:"one",sha:SHA,
    changes:[{field:"sections.0.body",before:"Nội dung gốc",after:"Đoạn vừa sửa"}]};
  return{onRequest:ctx.onRequest,helpers:ctx.helpers,req,payload,history,blobs,
    env:{CMS_SESSION_SECRET:"test-secret"}};
}
const h=harness();
const ok=await h.onRequest({request:h.req(h.payload),env:h.env});
const result=await ok.json();
assert.equal(ok.status,200,JSON.stringify(result));
assert.equal(result.deployment_pending,true);
assert.equal(result.commit,"e".repeat(40));
assert.equal(h.blobs.length,1);
assert.equal(JSON.parse(h.blobs[0].content).stories[0].sections[0].body,"Đoạn vừa sửa");
assert.equal(h.history.filter(x=>x.method==="PATCH").length,1,"one fast-forward main update");
assert.equal(h.history.filter(x=>x.method==="POST"&&x.url.endsWith("/pulls")).length,0);
assert.equal(h.helpers.fieldOK("data/content.json",base.stories[0],"sections.0.body"),true);
assert.equal(h.helpers.fieldOK("data/content.json",base.stories[0],"sections.99.body"),false);
assert.equal(h.helpers.fieldOK("data/content.json",base.stories[0],"__proto__"),false);
const food={ingredients:["Bún"],tips:["Nóng"],ask_staff:["Có tôm?"]};
assert.equal(h.helpers.fieldOK("data/i18n/vi/food.json",food,"tips.0"),true);
assert.equal(h.helpers.fieldOK("data/i18n/vi/food.json",food,"allergen_flags.0"),false);
const guide={title:"Dinh Cậu",editorial:{before_you_go:["Mang mũ"]}};
assert.equal(h.helpers.fieldOK("data/knowledge/objects.json",guide,"editorial.before_you_go.0"),true);
assert.equal(h.helpers.fieldOK("data/knowledge/objects.json",guide,"research.sources.0"),false);
for(const options of [{role:"editor",status:403},{stale:true,status:409},
  {conflict:true,status:409},{failPatch:true,status:403}]){
  const {status,...opts}=options,t=harness(opts);
  const resp=await t.onRequest({request:t.req(t.payload),env:t.env});
  assert.equal(resp.status,status,JSON.stringify(await resp.json()));
  assert.equal(t.history.filter(x=>x.method==="PATCH").length,opts.failPatch?1:0);
}
const invalid=harness();
invalid.payload.changes[0].field="image";
const denied=await invalid.onRequest({request:invalid.req(invalid.payload),env:invalid.env});
assert.equal(denied.status,422,"image and metadata not editable");
const csrf=harness();
assert.equal((await csrf.onRequest({request:csrf.req(csrf.payload,
  {Origin:"https://openphuquoc.com"}),env:csrf.env})).status,403);
console.log("PASS admin direct save: role, same-origin, field whitelist, exact SHA, pending PR, atomic commit, protected branch");
