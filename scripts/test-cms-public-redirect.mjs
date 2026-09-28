import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {onRequest,__test} from "../functions/_middleware.js";

async function run(url,{method="GET",cookie="",nextStatus=200}={}){
  let nextCalls=0;
  const request=new Request(url,{method,headers:cookie?{cookie}:{}});
  const result=await onRequest({
    request,
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
    cookie:"foo=1; openpq_cms=sealed-session; bar=2"
  });
  assert.equal(result.status,200);
  assert.equal(nextCalls,1);
  assert.match(result.headers.get("x-robots-tag")||"",/noindex/);
  assert.match(result.headers.get("cache-control")||"",/no-store/);
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
for(const required of ["/","/airport/*","/guide/*","/stories/*","/weather/*"]){
  assert.ok(routes.include.includes(required),"Missing Pages Functions route "+required);
}

console.log("CMS public redirect contract PASS");
