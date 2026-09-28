import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source=readFileSync("functions/_middleware.js","utf8");
const mod=await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));

const run=async (url,{cookie="",method="GET"}={})=>{
  let nextCalls=0;
  const headers=new Headers({Accept:"text/html"});
  if(cookie)headers.set("Cookie",cookie);
  const request=new Request(url,{method,headers});
  const response=await mod.onRequest({
    request,
    next:async()=>{
      nextCalls++;
      return new Response("<html>mirror</html>",{status:200,headers:{"Content-Type":"text/html"}});
    }
  });
  return {response,nextCalls};
};

{
  const {response,nextCalls}=await run("https://cms.openphuquoc.com/guide/article.html?id=knowledge_014_bai-sao");
  assert.equal(response.status,301);
  assert.equal(response.headers.get("location"),"https://openphuquoc.com/guide/article.html?id=knowledge_014_bai-sao");
  assert.equal(nextCalls,0);
}
{
  const {response}=await run("https://cms.openphuquoc.com/?from=old-bookmark");
  assert.equal(response.status,301);
  assert.equal(response.headers.get("location"),"https://openphuquoc.com/?from=old-bookmark");
}
{
  const {response,nextCalls}=await run("https://cms.openphuquoc.com/admin/");
  assert.equal(response.status,200);
  assert.equal(nextCalls,1);
}
{
  const {response,nextCalls}=await run("https://cms.openphuquoc.com/api/cms/me");
  assert.equal(response.status,200);
  assert.equal(nextCalls,1);
}
{
  const {response,nextCalls}=await run("https://cms.openphuquoc.com/stories/article.html?id=x",{cookie:"foo=1; openpq_cms=session-token"});
  assert.equal(response.status,200);
  assert.equal(nextCalls,1);
  assert.equal(response.headers.get("x-robots-tag"),"noindex, nofollow, noarchive");
}
{
  const {response,nextCalls}=await run("https://cms.openphuquoc.com/weather/weather-v2.js");
  assert.equal(response.status,200);
  assert.equal(nextCalls,1);
}
{
  const {response,nextCalls}=await run("https://preview.jotrip-home.pages.dev/");
  assert.equal(response.status,200);
  assert.equal(nextCalls,1);
}
console.log("CMS public redirect PASS: anonymous public traffic -> openphuquoc.com; admin/editor mirror preserved");
