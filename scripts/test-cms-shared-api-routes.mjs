import assert from "node:assert/strict";
import {onRequest as weatherContextRoute} from "../functions/api/context/v1/weather/window.js";
import {onRequest as goLiveRoute} from "../functions/api/go/live.js";

const weatherUrl="https://cms.openphuquoc.com/api/context/v1/weather/window";
const goUrl="https://cms.openphuquoc.com/api/go/live";

const weatherMethod=await weatherContextRoute({request:new Request(weatherUrl)});
assert.equal(weatherMethod.status,405);
assert.equal(weatherMethod.headers.get("allow"),"POST");

const goMethod=await goLiveRoute({request:new Request(goUrl,{method:"POST"})});
assert.equal(goMethod.status,405);
assert.equal(goMethod.headers.get("allow"),"GET");

const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response("upstream unavailable",{status:503});
try{
  const weatherResponse=await weatherContextRoute({request:new Request(weatherUrl,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      schema_version:"openpq-weather-window-request-v1",
      items:[{
        entity_id:"place_test",
        location:{lat:10.216,lon:103.96,precision:"verified_point"},
        activity_scope:"outdoor",
        window:{from:"2026-09-27T01:00:00+07:00",to:"2026-09-27T02:00:00+07:00"}
      }]
    })
  })});
  assert.equal(weatherResponse.status,200);
  const weatherBody=await weatherResponse.json();
  assert.equal(weatherBody.schema_version,"openpq-weather-window-context-v1");
  assert.equal(weatherBody.source_status,"UNAVAILABLE");

  const goResponse=await goLiveRoute({request:new Request(goUrl)});
  assert.equal(goResponse.status,200);
  const goBody=await goResponse.json();
  assert.equal(goBody.schema_version,"openpq-go-live-v1");
  assert.deepEqual(goBody.source_status,{weather:"UNAVAILABLE",marine:"UNAVAILABLE"});
}finally{
  globalThis.fetch=originalFetch;
}

console.log("CMS Pages GO and Weather Context route tests passed");
