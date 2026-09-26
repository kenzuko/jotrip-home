import assert from "node:assert/strict";
import {handleGoLive} from "../functions/_shared/go-live.js";

const weatherOrigin="https://weather.openphuquoc.com";
const urls={
  manifest:weatherOrigin+"/data/weather-runtime/manifest.json",
  compact:weatherOrigin+"/data/weather-runtime/compact.json",
  current:weatherOrigin+"/data/weather-runtime/current.json",
  marine:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json"
};
const manifest={
  schema_version:"weather-runtime-manifest-v1",
  status:"READY",
  generated_at:"2026-09-26T10:10:00Z",
  source_times:{forecast_run_time:"2026-09-25T18:00:00Z"},
  files:{
    compact:"/data/weather-runtime/compact.json",
    current:"/data/weather-runtime/current.json"
  }
};
const compact={
  schema_version:"weather-nowcast-compact-v1",
  status:"POINT_NUMERIC_READY",
  sampled_time:"2026-09-26T09:40:20Z",
  generated_at:"2026-09-26T10:05:53Z",
  lightning_observed:{status:"NOT_CONNECTED"},
  points:{
    duong_dong:{level:"ELEVATED"},
    an_thoi:{level:"WATCH"},
    ganh_dau:{level:"LOW"}
  }
};
const current={
  schema_version:"weather-current-v3",
  local_now:{
    generated_at:"2026-09-26T10:05:48Z",
    points:{
      duong_dong:{name:"Dương Đông",rain:{rain_rate_mm_h:0.46,data_class:"ESTIMATED_NOW",ensemble_context:{valid_time:"2026-09-26T12:00:00Z"}}},
      an_thoi:{name:"An Thới",rain:{rain_rate_mm_h:0.22,data_class:"ESTIMATED_NOW"}},
      ganh_dau:{name:"Gành Dầu",rain:{rain_rate_mm_h:0.91,data_class:"ESTIMATED_NOW"}}
    }
  },
  groundtruth:{rainfall:{stations:{
    an_thoi:{station_name:"An Thới",lat:10.018,lon:104.015,observed_at:"2026-09-26T10:05:51Z",qc:"PASS",increment_qc:"WINDOW_TOO_SHORT",rain_observed:null,rain_intensity_mm_h:null}
  }}}
};
const marine={source_date:"26/09/2026",collected_at_vn:"2026-09-26T16:00:00+07:00",categories:{
  cano:{state:"RUNNING"},fast_boat:{state:"RUNNING"},ferry:{state:"RUNNING"}
}};
const req=new Request("https://cms.openphuquoc.com/api/go/live");
const responses=new Map([
  [urls.manifest,manifest],[urls.compact,compact],[urls.current,current],[urls.marine,marine]
]);
const seen=[];
const fetchFixture=async url=>{
  seen.push(String(url));
  if(!responses.has(String(url)))return new Response("unexpected upstream",{status:500});
  return new Response(JSON.stringify(responses.get(String(url))),{status:200});
};

const ok=await handleGoLive(req,fetchFixture);
assert.equal(ok.status,200);
assert.equal(ok.headers.get("cache-control"),"no-store");
assert.deepEqual(seen.sort(),Object.values(urls).sort());
const body=await ok.json();
assert.equal(body.schema_version,"openpq-go-live-v1");
assert.deepEqual(body.source_status,{weather:"OK",marine:"OK"});
assert.equal(body.weather.points.duong_dong.nowcast.sampled_time,compact.sampled_time);
assert.equal(body.weather.generated_at,current.local_now.generated_at);
assert.equal(body.weather.timestamps.model_run,manifest.source_times.forecast_run_time);
assert.equal(body.weather.timestamps.valid_at,current.local_now.points.duong_dong.rain.ensemble_context.valid_time);
assert.notEqual(body.weather.generated_at,body.weather.points.duong_dong.nowcast.sampled_time,
  "Estimate generation and satellite sampling timestamps remain distinct");
assert.equal(body.weather.points.an_thoi.local.rain_class,"ESTIMATED_NOW");
assert.equal(body.weather.points.an_thoi.nowcast.lightning_observed,"NOT_CONNECTED");
assert.equal(body.weather.actual.rain_gauges[0].observed_at,"2026-09-26T10:05:51Z");
assert.equal(JSON.stringify(body).includes("raw.githubusercontent.com/kenzuko/Jotrip-Lab/gh-pages/weather"),false,
  "GO must not consume the legacy critical.json source");

const partial=await handleGoLive(req,async url=>{
  if(String(url)===urls.manifest)throw Error("Weather manifest timeout");
  return new Response(JSON.stringify(marine),{status:200});
});
const partialBody=await partial.json();
assert.equal(partial.status,200);
assert.equal(partialBody.weather,null);
assert.deepEqual(partialBody.source_status,{weather:"UNAVAILABLE",marine:"OK"});

const malformedJson=await handleGoLive(req,async url=>{
  if(String(url)===urls.manifest)return new Response("not-json",{status:200});
  return new Response(JSON.stringify(marine),{status:200});
});
assert.equal((await malformedJson.json()).source_status.weather,"INVALID");

const invalidManifest=await handleGoLive(req,async url=>{
  if(String(url)===urls.manifest)return new Response(JSON.stringify({...manifest,files:{...manifest.files,current:"/legacy/current.json"}}),{status:200});
  return new Response(JSON.stringify(marine),{status:200});
});
assert.equal((await invalidManifest.json()).source_status.weather,"INVALID",
  "Manifest paths outside the canonical runtime must be rejected");

const invalidCurrent=await handleGoLive(req,async url=>{
  if(String(url)===urls.manifest)return new Response(JSON.stringify(manifest),{status:200});
  if(String(url)===urls.compact)return new Response(JSON.stringify(compact),{status:200});
  if(String(url)===urls.current)return new Response(JSON.stringify({...current,schema_version:"legacy-current"}),{status:200});
  return new Response(JSON.stringify(marine),{status:200});
});
assert.equal((await invalidCurrent.json()).source_status.weather,"INVALID",
  "Unrecognized current-runtime schemas must not be normalized");

const partialRuntime=await handleGoLive(req,async url=>{
  if(String(url)===urls.manifest)return new Response(JSON.stringify(manifest),{status:200});
  if(String(url)===urls.compact)return new Response(JSON.stringify({...compact,points:{duong_dong:compact.points.duong_dong}}),{status:200});
  if(String(url)===urls.current)return new Response(JSON.stringify(current),{status:200});
  return new Response(JSON.stringify(marine),{status:200});
});
const partialBody2=await partialRuntime.json();
assert.equal(partialBody2.source_status.weather,"PARTIAL");
assert.deepEqual(partialBody2.weather.points && Object.keys(partialBody2.weather.points),["duong_dong"]);

const bothDown=await handleGoLive(req,async()=>new Response("upstream error",{status:503}));
const downBody=await bothDown.json();
assert.equal(downBody.weather,null);
assert.equal(downBody.marine,null);
assert.deepEqual(downBody.source_status,{weather:"UNAVAILABLE",marine:"UNAVAILABLE"});

const denied=await handleGoLive(new Request(req.url,{method:"POST"}),async()=>{throw Error("must not fetch");});
assert.equal(denied.status,405);
assert.equal(denied.headers.get("allow"),"GET");
console.log("GO live API PASS: canonical Weather runtime allowlist, normalized signal mapping, independent source failures, timestamp provenance.");
