import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("functions/_middleware.js","utf8");
const mod=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

async function run(url,{method="GET",cookie="",nextStatus=200,nextBody="OK"}={}){
  let nextCalls=0;
  const request=new Request(url,{method,headers:cookie?{cookie}:{}});
  const response=await mod.onRequest({
    request,
    next:async()=>{
      nextCalls++;
      return new Response(nextBody,{status:nextStatus,headers:{"Content-Type":"text/plain"}});
    }
  });
  return {response,nextCalls};
}

{
  const {response,nextCalls}=await run("https://cms.openphuquoc.com/");
  assert.equal(response.status,301);
  assert.equal(response.headers.get("location"),"https://openphuquoc.com/");
  assert.equal(nextCalls,0);
}
{
  const {response}=await run("https://cms.openphuquoc.com/places/detail.html?id=abc&x=1");
  assert.equal(response.status,301);
  assert.equal(response.headers.get("location"),"https://openphuquoc.com/places/detail.html?id=abc&x=1");
}
{
  const {response,nextCalls}=await run("https://cms.openphuquoc.com/guide/article.html?id=knowledge_001",{cookie:"foo=1; openpq_cms=sealed-session; bar=2"});
  assert.equal(response.status,200);
  assert.equal(nextCalls,1);
  assert.match(response.headers.get("x-robots-tag")||"",/noindex/);
}
for(const path of [
  "/admin/",
  "/api/cms/auth?action=login",
  "/weather/data/edge-health.json",
  "/data/meta/cms-build.json",
  "/assets/logo-master.png"
]){
  const {response,nextCalls}=await run("https://cms.openphuquoc.com"+path);
  assert.equal(response.status,200,path);
  assert.equal(nextCalls,1,path);
  assert.match(response.headers.get("x-robots-tag")||"",/noindex/,path);
}
{
  const {response,nextCalls}=await run("https://openphuquoc.com/guide/");
  assert.equal(response.status,200);
  assert.equal(nextCalls,1);
}
{
  const {response,nextCalls}=await run("https://cms.openphuquoc.com/some-public-path",{method:"POST"});
  assert.equal(response.status,404);
  assert.equal(nextCalls,0);
}
assert.equal(mod.__test.PUBLIC_ORIGIN,"https://openphuquoc.com");
assert.equal(mod.__test.CMS_HOST,"cms.openphuquoc.com");
console.log("CMS public redirect middleware PASS: anonymous public 301, authenticated inline edit preserved, technical routes stay on CMS");
