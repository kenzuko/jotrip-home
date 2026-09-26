import assert from "node:assert/strict";
import {handleWeatherWindow} from "../functions/_shared/weather-context.js";

const manifest={
  schema_version:"weather-runtime-manifest-v1",
  status:"READY",
  files:{forecast:"/data/weather-runtime/forecast.json"}
};
const frame=(valid_time,lat=10,lon=104,values={})=>({
  valid_time,lead_hours:15,cells:[{cell_id:"cell-"+valid_time,lat,lon,
    temperature_c:29,u10_ms:1,v10_ms:2,wind_kmh:8,wind_direction_deg:190,
    gust_kmh:null,rain_mm:0.2,wave_hs_m:null,wave_direction_deg:null,wave_period_s:null,...values}]
});
const forecast={
  schema_version:"weather-scene-forecast-v1",product:"JOTRIP_ECMWF_SPATIAL",
  source:"ECMWF_OPEN_DATA_DIRECT",generated_at:"2026-09-26T05:30:00Z",
  run_time:"2026-09-25T18:00:00Z",
  spatial:{status:"READY",display_interpolation:"RENDER_ONLY",frames:[
    frame("2026-09-26T06:00:00Z",9.5,103.5),
    frame("2026-09-26T09:00:00Z",10,104,null),
    frame("2026-09-26T12:00:00Z",10.25,104.25,{rain_mm:1.1})
  ]}
};
const makeRequest=(items,headers={})=>new Request("https://cms.openphuquoc.com/api/context/v1/weather/window",{
  method:"POST",headers:{"content-type":"application/json",...headers},
  body:JSON.stringify({schema_version:"openpq-weather-window-request-v1",items})
});
const item=(from,to,extra={})=>({
  entity_id:"place_test",location:{lat:10,lon:104.01,precision:"verified_point"},
  activity_scope:"outdoor",window:{from,to},...extra
});
const fetchFixture=(manifestValue=manifest,forecastValue=forecast)=>{
 const calls=[];
 const fetchImpl=async url=>{
  calls.push(String(url));
  if(String(url).endsWith("/data/weather-runtime/manifest.json"))
    return new Response(JSON.stringify(manifestValue),{status:200});
  if(String(url).endsWith("/data/weather-runtime/forecast.json"))
    return new Response(JSON.stringify(forecastValue),{status:200});
  throw Error("Unexpected upstream "+url);
 };
 return {fetchImpl,calls};
};

// Sample actual in-window frame only, choose nearest native cell and keep nulls.
{
 const {fetchImpl,calls}=fetchFixture();
 const res=await handleWeatherWindow(makeRequest([
  item("2026-09-26T15:30:00+07:00","2026-09-26T16:30:00+07:00")
 ]),fetchImpl);
 const body=await res.json(),sample=body.items[0];
 assert.equal(res.status,200);
 assert.equal(body.source_status,"OK");
 assert.equal(sample.temporal_coverage.status,"IN_WINDOW_FRAMES");
 assert.equal(sample.temporal_coverage.frame_cadence_hours,null);
 assert.equal(sample.temporal_coverage.interpolation_applied,false);
 assert.equal(sample.frames.length,1);
 assert.equal(sample.frames[0].valid_at,"2026-09-26T09:00:00Z");
 assert.equal(sample.frames[0].native_cell.cell_id,"cell-2026-09-26T09:00:00Z");
 assert.equal(sample.frames[0].native_cell.distance_from_target_km,1.1);
 assert.equal(sample.frames[0].values.rain_mm,0.2);
 assert.equal(sample.frames[0].values.wave_hs_m,null);
 assert.equal(sample.spatial_scope,"NATIVE_GRID_CELL");
 assert.equal(sample.assessment,null);
 assert.equal("cells" in sample.frames[0],false);
 assert.equal(JSON.stringify(body).includes("display_interpolation"),true);
 assert.equal(body.items[0].frames.length,1);
 assert.deepEqual(calls,[
  "https://weather.openphuquoc.com/data/weather-runtime/manifest.json",
  "https://weather.openphuquoc.com/data/weather-runtime/forecast.json"
 ]);
}

// No in-window frame returns only the nearest before/after pair, never a made-up value.
{
 const {fetchImpl}=fetchFixture();
 const res=await handleWeatherWindow(makeRequest([
  item("2026-09-26T17:00:00+07:00","2026-09-26T18:30:00+07:00")
 ]),fetchImpl);
 const body=await res.json(),sample=body.items[0];
 assert.equal(sample.status,"PARTIAL");
 assert.equal(sample.temporal_coverage.status,"BRACKET_ONLY");
 assert.deepEqual(sample.frames.map(x=>x.valid_at),["2026-09-26T09:00:00Z","2026-09-26T12:00:00Z"]);
 assert.equal(sample.reason_codes.includes("TIME_BETWEEN_FRAMES"),true);
 assert.equal(sample.temporal_coverage.frame_cadence_hours,3);
}

// One-sided forecast horizon is not represented as bracket coverage.
{
 const {fetchImpl}=fetchFixture();
 const res=await handleWeatherWindow(makeRequest([
  item("2026-09-26T05:00:00+07:00","2026-09-26T05:30:00+07:00")
 ]),fetchImpl);
 const sample=(await res.json()).items[0];
 assert.equal(sample.temporal_coverage.status,"NO_COVERAGE");
 assert.equal(sample.status,"UNKNOWN");
 assert.equal(sample.frames.length,0);
}

// Marine must not be approximated from the island point forecast.
{
 let called=0;
 const request=makeRequest([{
  entity_id:"activity_boat",activity_scope:"marine",route_id:"an-thoi-islands",
  window:{from:"2026-09-26T15:00:00+07:00",to:"2026-09-26T17:00:00+07:00"}
 }]);
 const res=await handleWeatherWindow(request,async()=>{called++;throw Error("must not fetch")});
 const body=await res.json();
 assert.equal(body.items[0].status,"UNKNOWN");
 assert.deepEqual(body.items[0].reason_codes,["ROUTE_SOURCE_UNSUPPORTED"]);
 assert.equal(body.items[0].temporal_coverage.status,"NOT_EVALUATED");
 assert.equal(called,0);
}

// Reject malformed/oversized input and cross-origin browser posts.
{
 const malformed=await handleWeatherWindow(makeRequest([item("tomorrow","2026-09-26T16:00:00+07:00")]),fetchFixture().fetchImpl);
 assert.equal(malformed.status,400);
 const tooLong=await handleWeatherWindow(makeRequest([
  item("2026-09-26T00:00:00+07:00","2026-09-27T00:01:00+07:00")
 ]),fetchFixture().fetchImpl);
 assert.equal(tooLong.status,400);
 const cross=await handleWeatherWindow(makeRequest([
  item("2026-09-26T15:30:00+07:00","2026-09-26T16:00:00+07:00")
 ],{origin:"https://evil.example"}),fetchFixture().fetchImpl);
 assert.equal(cross.status,403);
 const badType=await handleWeatherWindow(new Request("https://cms.openphuquoc.com/api/context/v1/weather/window",{method:"POST",body:"{}"}),fetchFixture().fetchImpl);
 assert.equal(badType.status,415);
 const wrongMethod=await handleWeatherWindow(new Request("https://cms.openphuquoc.com/api/context/v1/weather/window"),fetchFixture().fetchImpl);
 assert.equal(wrongMethod.status,405);
}

// Enforce byte caps on streamed bodies even when Content-Length is absent.
{
 const oversizedBody=new ReadableStream({
  start(controller){controller.enqueue(new Uint8Array(24_001));controller.close()}
 });
 const streamedRequest=new Request("https://cms.openphuquoc.com/api/context/v1/weather/window",{
  method:"POST",headers:{"content-type":"application/json"},body:oversizedBody,duplex:"half"
 });
 const requestResponse=await handleWeatherWindow(streamedRequest,fetchFixture().fetchImpl);
 assert.equal(requestResponse.status,413);

 const oversizedForecast=new ReadableStream({
  start(controller){controller.enqueue(new Uint8Array(10_000_001));controller.close()}
 });
 const forecastResponse=await handleWeatherWindow(makeRequest([
  item("2026-09-26T15:30:00+07:00","2026-09-26T16:00:00+07:00")
 ]),async url=>String(url).endsWith("/data/weather-runtime/manifest.json")
   ?new Response(JSON.stringify(manifest),{status:200})
   :new Response(oversizedForecast,{status:200}));
 const body=await forecastResponse.json();
 assert.equal(body.source_status,"INVALID");
 assert.equal(body.items[0].reason_codes[0],"WEATHER_SCHEMA_INVALID");

 const declaredOversize=await handleWeatherWindow(makeRequest([
  item("2026-09-26T15:30:00+07:00","2026-09-26T16:00:00+07:00")
 ]),async url=>String(url).endsWith("/data/weather-runtime/manifest.json")
   ?new Response(JSON.stringify(manifest),{status:200})
   :new Response("{}",{status:200,headers:{"content-length":"10000001"}}));
 const declaredBody=await declaredOversize.json();
 assert.equal(declaredBody.source_status,"INVALID");
 assert.equal(declaredBody.items[0].reason_codes[0],"WEATHER_SCHEMA_INVALID");
}

// Manifest allowlisting blocks untrusted forecast paths.
{
 let calls=0;
 const badManifest={...manifest,files:{forecast:"/unexpected/forecast.json"}};
 const response=await handleWeatherWindow(makeRequest([
  item("2026-09-26T15:30:00+07:00","2026-09-26T16:00:00+07:00")
 ]),async url=>{
  calls++;
  return new Response(JSON.stringify(badManifest),{status:200});
 });
 const body=await response.json();
 assert.equal(body.source_status,"INVALID");
 assert.equal(body.items[0].reason_codes[0],"WEATHER_SCHEMA_INVALID");
 assert.equal(calls,1);
}

// Malformed frame shape invalidates the source instead of being silently skipped.
{
 const malformedForecast={...forecast,spatial:{...forecast.spatial,frames:[null]}};
 const response=await handleWeatherWindow(makeRequest([
  item("2026-09-26T15:30:00+07:00","2026-09-26T16:00:00+07:00")
 ]),fetchFixture(manifest,malformedForecast).fetchImpl);
 const body=await response.json();
 assert.equal(body.source_status,"INVALID");
 assert.equal(body.items[0].reason_codes[0],"WEATHER_SCHEMA_INVALID");
}

// Source outage degrades only context; it does not throw into the Worker.
{
 const response=await handleWeatherWindow(makeRequest([
  item("2026-09-26T15:30:00+07:00","2026-09-26T16:00:00+07:00")
 ]),async()=>{throw Error("offline")});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.source_status,"UNAVAILABLE");
 assert.equal(body.items[0].status,"UNAVAILABLE");
 assert.equal(body.items[0].temporal_coverage.status,"NOT_EVALUATED");
 assert.equal(body.items[0].assessment,null);
}

console.log("shared weather context API tests passed");
