import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {onRequest,__test} from "../functions/_middleware.js";
const TEST_SECRET="test-only-non-production-secret-20260930";
async function sessionCookie(login="test-operator",exp=Date.now()+60_000){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(TEST_SECRET));
  const key=await crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt"]);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const body=new TextEncoder().encode(JSON.stringify({login,exp}));
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,body);
  return "openpq_cms="+Buffer.from(iv).toString("base64url")+"."+Buffer.from(encrypted).toString("base64url");
}


async function run(url,{method="GET",cookie="",nextStatus=200}={}){
  let nextCalls=0;
  const request=new Request(url,{method,headers:cookie?{cookie}:{}});
  const result=await onRequest({
    request,
    env:{CMS_SESSION_SECRET:TEST_SECRET},
    next:async()=>{
      nextCalls++;
      return new Response("<html>cms</html>",{
        status:nextStatus,
        headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=60"}
      });
    }
  });
  return {result,nextCalls};
}

{
  const {result,nextCalls}=await run("https://cms.openphuquoc.com/");
  assert.equal(result.status,301);
  assert.equal(result.headers.get("location"),"https://openphuquoc.com/");
  assert.equal(nextCalls,0);
}
{
  const {result}=await run("https://cms.openphuquoc.com/guide/article.html?id=knowledge_001&x=1");
  assert.equal(result.status,301);
  assert.equal(result.headers.get("location"),"https://openphuquoc.com/guide/article.html?id=knowledge_001&x=1");
}
{
  const {result}=await run("https://cms.openphuquoc.com/weather/");
  assert.equal(result.status,301);
  assert.equal(result.headers.get("location"),"https://openphuquoc.com/weather/");
}
{
  const {result,nextCalls}=await run("https://cms.openphuquoc.com/stories/article.html?id=abc",{
    cookie:"foo=1; "+await sessionCookie()+"; bar=2"
  });
  assert.equal(result.status,200);
  assert.equal(nextCalls,1);
  assert.match(result.headers.get("x-robots-tag")||"",/noindex/);
  assert.match(result.headers.get("cache-control")||"",/no-store/);
}
for(const cookie of [
  "foo=1; openpq_cms=sealed-session; bar=2",
  await sessionCookie("test-operator",Date.now()-30_000),
  "openpq_cms="+(await sessionCookie()).split("=")[1].slice(0,-7)+"tampered"
]){
  const {result,nextCalls}=await run("https://cms.openphuquoc.com/stories/article.html?id=abc",{cookie});
  assert.equal(result.status,301,"Forged/expired session must redirect");
  assert.equal(nextCalls,0,"Invalid session cannot enter CMS editing surface");
}
for(const path of [
  "/admin/","/api/cms/session","/assets/logo-master.png","/core/cms-inline-edit.js",
  "/data/content.json","/cms/schema.json","/.well-known/example",
  "/weather/data/weather-runtime/manifest.json"
]){
  const {result,nextCalls}=await run("https://cms.openphuquoc.com"+path);
  assert.equal(nextCalls,1,path+" must remain on CMS");
  assert.equal(result.status,200,path);
}
{
  const {result,nextCalls}=await run("https://jotrip-home.pages.dev/guide/article.html?id=x");
  assert.equal(nextCalls,1);
  assert.equal(result.status,200);
}
{
  const {result,nextCalls}=await run("https://cms.openphuquoc.com/guide/article.html?id=x",{method:"POST"});
  assert.equal(nextCalls,1);
  assert.equal(result.status,200);
}

assert.equal(__test.isPublicPage("/"),true);
assert.equal(__test.isPublicPage("/airport/"),true);
assert.equal(__test.isPublicPage("/weather/data/x.json"),false);
assert.equal(__test.isPublicPage("/admin/"),false);

const routes=JSON.parse(await readFile(new URL("./routes.json",import.meta.url),"utf8"));
for(const required of [
  "/","/index.html","/airport/","/airport/index.html",
  "/guide/","/guide/article.html","/stories/article.html",
  "/weather/","/weather/index.html","/weather/weather-history.html",
  "/weather/data/*","/weather/spatial-ecmwf.json",
  "/api/cms/*","/api/weather/live/*"
]){
  assert.ok(routes.include.includes(required),"Missing Pages Functions route "+required);
}
for(const forbidden of [
  "/about/*","/airport/*","/bus/*","/cano/*","/currency/*","/explore/*",
  "/ferry/*","/food/*","/go/*","/guide/*","/hotels/*","/nearme/*",
  "/news/*","/places/*","/stories/*","/transit/*","/utilities/*","/weather/*"
]){
  assert.ok(!routes.include.includes(forbidden),"Broad public wildcard would invoke Pages Functions for static assets: "+forbidden);
}
assert.ok(routes.include.length<=100,"Cloudflare Pages _routes.json must stay within the route rule limit");
const routeCovers=(rule,path)=>rule.endsWith("*")?path.startsWith(rule.slice(0,-1)):rule===path;
assert.ok(!routes.include.some(rule=>routeCovers(rule,"/weather/weather-v2.js")),"Static Weather JS must bypass Pages Functions");
assert.ok(routes.include.some(rule=>routeCovers(rule,"/weather/data/critical.json")),"CMS live Weather data must keep its dedicated Pages Function route");

console.log("CMS public redirect contract PASS");
