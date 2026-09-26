import assert from "node:assert/strict";
import {handleGoLive} from "../functions/_shared/go-live.js";

const urlWeather="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/gh-pages/weather/data/critical.json";
const urlMarine="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json";
const weather={generated_at:"2026-09-26T09:00:00Z",points:{duong_dong:{name:"Dương Đông"},an_thoi:{name:"An Thới"},ganh_dau:{name:"Gành Dầu"}}};
const marine={source_date:"26/09/2026",collected_at_vn:"2026-09-26T16:00:00+07:00",categories:{cano:{state:"RUNNING"},fast_boat:{state:"RUNNING"},ferry:{state:"RUNNING"}}};
const req=new Request("https://cms.openphuquoc.com/api/go/live");
const seen=[];
const ok=await handleGoLive(req,async url=>{
  seen.push(url);
  return new Response(JSON.stringify(url===urlWeather?weather:marine),{status:200});
});
assert.equal(ok.status,200);
assert.equal(ok.headers.get("cache-control"),"no-store");
assert.deepEqual(seen.sort(),[urlMarine,urlWeather].sort());
const body=await ok.json();
assert.equal(body.schema_version,"openpq-go-live-v1");
assert.deepEqual(body.weather,weather);
assert.deepEqual(body.marine,marine);
assert.deepEqual(body.source_status,{weather:"OK",marine:"OK"});

const partial=await handleGoLive(req,async url=>{
  if(url===urlWeather)throw Error("upstream timeout");
  return new Response(JSON.stringify(marine),{status:200});
});
const partialBody=await partial.json();
assert.equal(partial.status,200);
assert.equal(partialBody.weather,null);
assert.deepEqual(partialBody.marine,marine);
assert.deepEqual(partialBody.source_status,{weather:"UNAVAILABLE",marine:"OK"});

const malformed=await handleGoLive(req,async url=>new Response(url===urlWeather?"{}":JSON.stringify(marine),{status:200}));
const malformedBody=await malformed.json();
assert.deepEqual(malformedBody.source_status,{weather:"INVALID",marine:"OK"});

const partialSchema=await handleGoLive(req,async url=>new Response(JSON.stringify(url===urlWeather?
  {generated_at:weather.generated_at,points:{an_thoi:weather.points.an_thoi}}:marine),{status:200}));
const partialSchemaBody=await partialSchema.json();
assert.deepEqual(partialSchemaBody.source_status,{weather:"PARTIAL",marine:"OK"});

const invalidJson=await handleGoLive(req,async url=>new Response(url===urlWeather?"not-json":JSON.stringify(marine),{status:200}));
const invalidJsonBody=await invalidJson.json();
assert.equal(invalidJsonBody.weather,null);
assert.deepEqual(invalidJsonBody.source_status,{weather:"INVALID",marine:"OK"});

const bothDown=await handleGoLive(req,async()=>new Response("upstream error",{status:503}));
const downBody=await bothDown.json();
assert.equal(downBody.weather,null);
assert.equal(downBody.marine,null);
assert.deepEqual(downBody.source_status,{weather:"UNAVAILABLE",marine:"UNAVAILABLE"});

const denied=await handleGoLive(new Request(req.url,{method:"POST"}),async()=>{throw Error("must not fetch");});
assert.equal(denied.status,405);
assert.equal(denied.headers.get("allow"),"GET");
console.log("GO live API PASS: allow-listed upstreams, same-origin response, independent partial failures, no browser secrets.");
