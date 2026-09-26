import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const client=require("../core/weather-context-client.js");

const requestItem={entity_id:"place_test",activity_scope:"outdoor",
  location:{lat:10.2,lon:103.95,precision:"site_centroid"},
  window:{from:"2026-09-26T09:00:00+07:00",to:"2026-09-26T12:00:00+07:00"}};
const response={schema_version:"openpq-weather-window-context-v1",checked_at:"2026-09-26T02:00:00Z",
  source_status:"OK",items:[{entity_id:"place_test",status:"OK",reason_codes:[],
    temporal_coverage:{status:"IN_WINDOW_FRAMES",frame_cadence_hours:3,interpolation_applied:false},
    frames:[],assessment:null}]};
let captured=null;
const result=await client.requestWindows([requestItem],{fetchImpl:async(url,init)=>{
  captured={url,init};
  return {ok:true,json:async()=>response};
}});
assert.equal(captured.url,"/api/context/v1/weather/window");
assert.equal(captured.init.method,"POST");
assert.equal(captured.init.cache,"no-store");
assert.equal(JSON.parse(captured.init.body).schema_version,"openpq-weather-window-request-v1");
assert.equal(result.items[0].status,"OK","valid shared response passes through without remapping");

const unavailable=await client.requestWindows([requestItem],{fetchImpl:async()=>({ok:true,json:async()=>({
  ...response,source_status:"UNAVAILABLE",items:[{...response.items[0],status:"UNAVAILABLE",
    temporal_coverage:{status:"NOT_EVALUATED"},assessment:null}]
})})});
assert.equal(unavailable.items[0].status,"UNAVAILABLE","unknown states are preserved");

await assert.rejects(client.requestWindows([requestItem],{fetchImpl:async()=>({ok:false,status:503})}),/HTTP_ERROR/);
await assert.rejects(client.requestWindows([requestItem],{fetchImpl:async()=>({ok:true,json:async()=>({...response,items:[]})})}),/RESPONSE_INVALID/);
await assert.rejects(client.requestWindows([{...requestItem},{...requestItem}],{fetchImpl:async()=>{throw Error("must not fetch")}}),/ENTITY_ID_INVALID/);
await assert.rejects(client.requestWindows([requestItem],{fetchImpl:async()=>({ok:true,json:async()=>({
  ...response,items:[{...response.items[0],assessment:{status:"safe"}}]
})})}),/ITEM_INVALID/);
console.log("weather context browser client tests passed");
