import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {normalizeEvent,collectTraffic,trafficReport,resolveTrafficPeriod} from "../functions/_shared/traffic-analytics.js";
import {onRequest as ownerRoute} from "../functions/api/cms/traffic.js";
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const sqlite=new DatabaseSync(":memory:");
const db={
 prepare(sql){
  const statement=sqlite.prepare(sql);
  return {
   args:[],bind(...values){this.args=values;return this},
   async run(){return statement.run(...this.args)},
   async first(){return statement.get(...this.args)||null},
   async all(){return {results:statement.all(...this.args)}}
  };
 }
};
const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
const past=n=>new Date(Date.parse(today+"T00:00:00Z")-n*86400000).toISOString().slice(0,10);
const origin="https://cms.openphuquoc.com",endpoint=origin+"/api/cms/traffic";
const env={CMS_DB:db,CMS_SESSION_SECRET:"example-session-secret-for-tests"};
const valid={event:"page_view",path:"/",device:"mobile",referrer:"chatgpt.com"};
const eventReq=(item=valid,from=origin)=>new Request(origin+"/api/traffic/collect",{
 method:"POST",headers:{origin:from,"content-type":"application/json","user-agent":"Mozilla/5.0"},body:JSON.stringify(item)
});
assert.deepEqual(normalizeEvent(valid,"VN"),{event:"page_view",path:"/",device:"mobile",ref_domain:"chatgpt.com",channel:"ai",country:"VN"});
assert.equal(normalizeEvent({...valid,path:"/admin/index.html"}),null);
assert.equal(normalizeEvent({...valid,referrer:"google.com"}).channel,"search");
assert.equal(normalizeEvent({...valid,referrer:"facebook.com"}).channel,"social");
assert.equal(normalizeEvent({...valid,referrer:""}).channel,"direct");
assert.equal(normalizeEvent({...valid,referrer:"openphuquoc.com"}).channel,"internal");
const captured=await collectTraffic(eventReq(),env);
assert.equal(captured.status,204);
assert.equal((await collectTraffic(eventReq(valid,"https://external.example"),env)).status,403);
assert.equal((await collectTraffic(eventReq({...valid,path:"/admin/"}),env)).status,400);
assert.equal((await collectTraffic(new Request(origin+"/api/traffic/collect"),env)).status,405);
assert.equal((await collectTraffic(new Request(origin+"/api/traffic/collect",{
 method:"POST",headers:{origin,"content-type":"application/json","user-agent":"Googlebot"},
 body:JSON.stringify(valid)}),env)).status,204);

// A true SQLite engine exercises SQL syntax and report semantics, including
// old data from well before the former destructive 180-day retention limit.
const insert=sqlite.prepare("INSERT INTO web_traffic_daily(day,event,path,channel,ref_domain,country,device,hits) VALUES(?,?,?,?,?,?,?,?)");
const add=(days,event,path,channel,ref,country,device,hits)=>insert.run(past(days),event,path,channel,ref,country,device,hits);
add(1080,"page_view","/","direct","","VN","mobile",3);
add(850,"page_view","/stories/article.html?id=long-history","search","google.com","RU","desktop",7);
add(210,"page_view","/guide/article.html?id=older","search","google.com","VN","mobile",11);
add(60,"page_view","/guide/article.html?id=month","social","facebook.com","KR","tablet",9);
add(12,"page_view","/","search","google.com","VN","mobile",4);
add(4,"page_view","/","direct","","VN","desktop",6);
add(2,"page_view","/guide/article.html?id=fresh","ai","chatgpt.com","VN","mobile",5);
add(2,"go_open","/go/","ai","chatgpt.com","VN","mobile",8);
add(1,"feedback_open","/guide/article.html?id=fresh","ai","chatgpt.com","VN","mobile",2);
const query=async qs=>trafficReport(new Request(endpoint+"?"+qs),env);
const weeklyResponse=await query("period=7d");
assert.equal(weeklyResponse.status,200);
const weekly=await weeklyResponse.json();
assert.equal(weekly.total_page_views,12); // 6 direct + 5 AI + 1 anonymous collector
assert.equal(weekly.total_actions,10);
assert.equal(weekly.first_day,past(1080));
assert.equal(weekly.grain,"day");
assert.equal(weekly.comparison.available,true);
assert.equal(weekly.comparison.page_views,4);
assert.equal(weekly.comparison.page_views_change_pct,200);
assert.ok(weekly.trend.every(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.period)));
const old=(await(await query("period=all")).json());
assert.equal(old.first_day,past(1080));
assert.equal(old.grain,"year");
assert.equal(old.total_page_views,46);
assert.ok(old.trend.length>=2,"All-time history must aggregate across years");
assert.equal(old.comparison,null);
const year=(await(await query("period=365d")).json());
assert.equal(year.grain,"month");
assert.equal(year.total_page_views,36); // All but the 1080-day and 850-day rows
assert.ok(year.trend.every(row=>/^\d{4}-\d{2}$/.test(row.period)));
const filtered=(await(await query("period=all&channel=ai&country=VN&device=mobile&page_group=guide&action=feedback_open&sort=hits_asc&q=fresh")).json());
assert.equal(filtered.total_page_views,5);
assert.deepEqual(filtered.pages,[{path:"/guide/article.html?id=fresh",hits:5}]);
assert.deepEqual(filtered.actions,[{event:"feedback_open",hits:2}]);
const ascending=(await(await query("period=all&sort=hits_asc")).json());
assert.equal(ascending.pages[0].path,"/guide/article.html?id=fresh");
assert.equal(ascending.pages[0].hits,5);
const reportName=(await(await query("period=all&sort=name_asc")).json());
assert.ok(reportName.pages[0].path.localeCompare(reportName.pages.at(-1).path)<=0);
const search=(await(await query("period=all&q=older")).json());
assert.equal(search.total_page_views,11);
assert.equal((await query("period=all&group=day")).status,400,"Guard against unbounded daily charts");
assert.equal((await query("period=365d&group=day")).status,200);
for(const invalid of ["period=900d","sort=DROP_TABLE","country=VNN","period=custom&from=2026-02-30&to=2026-03-01","period=custom&from=2024-12-31&to=2024-01-01","period=all&group=monthly"]){
 assert.equal((await query(invalid)).status,400,invalid);
}
assert.equal(resolveTrafficPeriod(new URLSearchParams("period=all"),today,past(1080)).from,past(1080));
const exportResponse=await query("period=all&format=csv");
assert.equal(exportResponse.status,200);
assert.match(exportResponse.headers.get("Content-Type"),/text\/csv/);
assert.match(exportResponse.headers.get("Content-Disposition"),/attachment/);
const csv=await exportResponse.text();
assert.ok(csv.startsWith("\uFEFF"),"CSV must be Excel UTF-8 compatible");
assert.match(csv,/long-history/);
assert.match(csv,/feedback_open/);
assert.match(csv,/"day","event","path","channel","ref_domain","country","device","hits"/);
assert.ok(!readFileSync("worker.js","utf8").includes("cleanupTraffic"),"Scheduled deletions of analytics must be removed");
assert.ok(readFileSync("admin/traffic-dashboard.js","utf8").includes("data-traffic-period"));
assert.ok(readFileSync("admin/traffic-dashboard.js","utf8").includes("Xuất CSV"));

assert.equal((await ownerRoute({request:new Request(endpoint),env})).status,401);
assert.equal((await ownerRoute({request:new Request(endpoint,{method:"POST"}),env})).status,405);
async function cookie(login,role){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(env.CMS_SESSION_SECRET));
 const key=await crypto.subtle.importKey("raw",hash,{name:"AES-GCM"},false,["encrypt"]);
 const payload=JSON.stringify({login,role,exp:Date.now()+3600000});
 const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(payload));
 return "openpq_cms="+Buffer.from(iv).toString("base64url")+"."+Buffer.from(cipher).toString("base64url");
}
const originalFetch=globalThis.fetch;
let ownerEnabled=true;
globalThis.fetch=async url=>{
 if(!String(url).startsWith("https://raw.githubusercontent.com/kenzuko/jotrip-home/main/cms/users.json"))throw Error("Unexpected auth request");
 return new Response(JSON.stringify({users:[{login:"kenzuko",role:"admin",enabled:ownerEnabled}]}),{status:200,headers:{"content-type":"application/json"}});
};
try{
 const outsider=await ownerRoute({request:new Request(endpoint+"?period=all&format=csv",{headers:{cookie:await cookie("otheradmin","admin")}}),env});
 assert.equal(outsider.status,403,"CSV must be owner-only, even for other admins");
 const owner=await ownerRoute({request:new Request(endpoint+"?period=all&format=csv",{headers:{cookie:await cookie("kenzuko","admin")}}),env});
 assert.equal(owner.status,200);assert.match(owner.headers.get("content-type"),/csv/);
 ownerEnabled=false;
 assert.equal((await ownerRoute({request:new Request(endpoint,{headers:{cookie:await cookie("kenzuko","admin")}}),env})).status,403);
}finally{globalThis.fetch=originalFetch;sqlite.close()}
console.log("LONG-TERM TRAFFIC PASS: real SQLite history, monthly/yearly, owner CSV, filters, sort, comparison, and disabled retention deletion");
