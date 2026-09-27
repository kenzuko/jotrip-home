import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import {normalizeEvent,collectTraffic,trafficReport} from "../functions/_shared/traffic-analytics.js";
import {onRequest as ownerRoute} from "../functions/api/cms/traffic.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const mkDb=()=>{
  const operations=[];
  return{
    operations,
    prepare(sql){
      return{
        args:[],
        bind(...args){this.args=args;return this},
        async run(){operations.push({sql,args:this.args});return{success:true}},
        async all(){
          if(sql.includes("SELECT day,SUM"))return{results:[{day:"2026-09-27",hits:3}]};
          if(sql.includes("SELECT channel"))return{results:[{channel:"ai",hits:1},{channel:"direct",hits:2}]};
          if(sql.includes("SELECT path"))return{results:[{path:"/",hits:3}]};
          return{results:[]};
        }
      };
    }
  };
};
const origin="https://cms.openphuquoc.com",collector=origin+"/api/traffic/collect",report=origin+"/api/cms/traffic";
const db=mkDb(),env={CMS_DB:db,CMS_SESSION_SECRET:"example-session-secret-for-tests"};
const valid={event:"page_view",path:"/",device:"mobile",referrer:"chatgpt.com"};
assert.deepEqual(normalizeEvent(valid,"VN"),{event:"page_view",path:"/",device:"mobile",ref_domain:"chatgpt.com",channel:"ai",country:"VN"});
assert.equal(normalizeEvent({...valid,path:"/admin/index.html"}),null);
assert.equal(normalizeEvent({...valid,path:"/guide/article.html?id=hello",referrer:"user123.unknown.org"}).ref_domain,"other");
assert.equal(normalizeEvent({...valid,path:"/go/?gps=10.0"}),null);
assert.equal(normalizeEvent({...valid,referrer:"google.com"}).channel,"search");
assert.equal(normalizeEvent({...valid,referrer:"facebook.com"}).channel,"social");
assert.equal(normalizeEvent({...valid,referrer:""}).channel,"direct");
assert.equal(normalizeEvent({...valid,referrer:"openphuquoc.com"}).channel,"internal");
const eventReq=(data=valid,originValue=origin)=>new Request(collector,{method:"POST",headers:{origin:originValue,"content-type":"application/json","user-agent":"Mozilla/5.0"},body:JSON.stringify(data)});
const ok=await collectTraffic(eventReq(),env);
assert.equal(ok.status,204);
assert.ok(db.operations.some(o=>o.sql.startsWith("INSERT INTO web_traffic_daily")),"D1 must record approved event");
assert.equal((await collectTraffic(eventReq(valid,"https://external.example"),env)).status,403);
assert.equal((await collectTraffic(eventReq({...valid,path:"/admin/"}),env)).status,400);
assert.equal((await collectTraffic(new Request(collector,{method:"GET"}),env)).status,405);
assert.equal((await collectTraffic(new Request(collector,{method:"POST",headers:{origin,"content-type":"application/json","user-agent":"Googlebot"},body:JSON.stringify(valid)}),env)).status,204);
const results=await trafficReport(new Request(report+"?from=2026-09-20&to=2026-09-27"),env);
assert.equal(results.status,200);assert.equal(results.headers.get("X-Robots-Tag"),"noindex");
const stats=await results.json();
assert.equal(stats.total_page_views,3);assert.equal(stats.channels[0].channel,"ai");
assert.equal((await trafficReport(new Request(report+"?from=2026-01-01&to=2026-09-27"),env)).status,400);
assert.equal((await ownerRoute({request:new Request(report),env})).status,401,"No CMS session must get 401");
assert.equal((await ownerRoute({request:new Request(report,{method:"POST"}),env})).status,405);

async function cookie(login,role){
  const plaintext=JSON.stringify({login,role,exp:Date.now()+3600000});
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env.CMS_SESSION_SECRET));
  const key=await crypto.subtle.importKey("raw",hash,{name:"AES-GCM"},false,["encrypt"]);
  const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(plaintext));
  return "openpq_cms="+Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");
}
const originalFetch=globalThis.fetch;
let ownerEnabled=true;
globalThis.fetch=async url=>{
  if(!String(url).startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json"))throw Error("Unexpected auth network request");
  return new Response(JSON.stringify({users:[{login:"kenzuko",role:"admin",enabled:ownerEnabled}]}),{status:200,headers:{"Content-Type":"application/json"}});
};
try{
  const nonowner=await ownerRoute({request:new Request(report,{headers:{cookie:await cookie("otheradmin","admin")}}),env});
  assert.equal(nonowner.status,403,"Other admins cannot see owner's traffic dashboard");
  const owner=await ownerRoute({request:new Request(report,{headers:{cookie:await cookie("kenzuko","admin")}}),env});
  assert.equal(owner.status,200,"Owner gets aggregate report");
  ownerEnabled=false;
  const revoked=await ownerRoute({request:new Request(report,{headers:{cookie:await cookie("kenzuko","admin")}}),env});
  assert.equal(revoked.status,403,"Live role revocation must block access");
}finally{globalThis.fetch=originalFetch}
const worker=readFileSync("worker.js","utf8"),wrangler=readFileSync("wrangler.jsonc","utf8");
assert.ok(worker.includes('"/api/traffic/collect"')&&worker.includes('"/api/cms/traffic"'));
assert.ok(wrangler.includes('"/api/traffic/collect"')&&wrangler.includes('"/api/cms/traffic"'));
const html=readFileSync("admin/index.html","utf8");
assert.ok(html.includes("traffic-dashboard.js")&&html.includes("traffic-dashboard.css"));
const schema=JSON.parse(readFileSync("cms/schema.json","utf8"));
assert.deepEqual(schema.modules.find(m=>m.id==="traffic").read,["admin"]);
assert.ok(readFileSync("admin/admin.js","utf8").includes('session.login==="kenzuko"&&session.role==="admin"'));
console.log("OWNER TRAFFIC ANALYTICS PASS: anonymous aggregation, origin gate, D1, owner-only access, revocation and both Cloudflare routes");
