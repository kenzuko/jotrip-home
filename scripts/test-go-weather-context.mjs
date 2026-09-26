import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
require("../core/go-geo.js");
const engine=require("../core/go-engine.js");

const start="2026-09-26T09:30+07:00";
const finish="2026-09-26T12:30+07:00";
const eligible=[
  {id:"place_pin",name:"Pin",zone:"zone_south",weather_scope:"outdoor",arrival_at:start,finish_at_local:finish,badge:"POSSIBLE",warnings:[],score:10},
  {id:"place_zone",name:"Anchor",zone:"zone_north",weather_scope:"outdoor",arrival_at:start,finish_at_local:finish,badge:"POSSIBLE",warnings:[],score:20},
  {id:"activity_sea",name:"Sea",zone:"zone_south",weather_scope:"marine",arrival_at:start,finish_at_local:finish,badge:"POSSIBLE",warnings:[],score:30},
  {id:"place_inside",name:"Inside",zone:"zone_south",weather_scope:"indoor",arrival_at:start,finish_at_local:finish,badge:"POSSIBLE",warnings:[],score:40},
  {id:"place_extra",name:"Extra",zone:"zone_south",weather_scope:"outdoor",arrival_at:start,finish_at_local:finish,badge:"POSSIBLE",warnings:[],score:50}
];
const entities=new Map([
  ["place_pin",{id:"place_pin",zone_id:"zone_south",map:{lat:10.01,lon:104.01,precision:"site_centroid"}}],
  ["place_zone",{id:"place_zone",zone_id:"zone_north"}],
  ["place_inside",{id:"place_inside",zone_id:"zone_south"}],
  ["place_extra",{id:"place_extra",zone_id:"zone_south"}]
]);
const config={activities:[
  {entity_id:"place_pin"},
  {entity_id:"place_zone"},
  {entity_id:"activity_sea",marine:true,marine_route:"south"},
  {entity_id:"place_inside"},
  {entity_id:"place_extra"}
]};
const view={eligible,results:eligible.slice(0,3),remaining:eligible.slice(3),eligible_count:eligible.length};
const items=engine.weatherWindowItems(view,config,entities);
assert.equal(items.length,4,"all eligible outdoor/marine candidates are sampled before the three-result UI cap");
assert.equal(items[0].location.precision,"site_centroid","verified site centroid is preserved");
assert.equal(items[1].location.precision,"area_anchor","unknown venue coordinates fall back only to a labelled zone anchor");
assert.equal(items[1].location.lat,10.3759);
assert.equal(items[2].activity_scope,"marine");
assert.equal(items[2].route_id,"south");
assert.equal(items[2].location,undefined,"marine context is route-scoped and does not invent a land point");
assert.equal(items[0].window.from,start);
assert.equal(items[0].window.to,finish);

const payload={source_status:"PARTIAL",items:[
 {entity_id:"place_pin",status:"OK",target:{precision:"site_centroid"},source:{model_run:"2026-09-26T00:00:00Z"},
  temporal_coverage:{status:"IN_WINDOW_FRAMES",frame_cadence_hours:3},frames:[{native_cell:{distance_from_target_km:2.2},valid_at:"2026-09-26T02:00:00Z"}],assessment:null},
 {entity_id:"place_zone",status:"PARTIAL",target:{precision:"area_anchor"},temporal_coverage:{status:"BRACKET_ONLY"},frames:[],assessment:null},
 {entity_id:"activity_sea",status:"UNKNOWN",reason_codes:["ROUTE_SOURCE_UNSUPPORTED"],temporal_coverage:{status:"NOT_EVALUATED"},frames:[],assessment:null}
]};
const updated=engine.applyWeatherContext(view,payload);
assert.equal(updated.results.length,3);
assert.equal(updated.remaining.length,2);
assert.equal(updated.eligible_count,5);
assert.equal(updated.eligible.find(x=>x.id==="place_pin").badge,"CHECK","raw weather context cannot be interpreted as an approved safety assessment");
assert.ok(updated.eligible.find(x=>x.id==="place_pin").warnings.some(x=>x.includes("2.2 km")));
assert.ok(updated.eligible.find(x=>x.id==="place_zone").warnings.some(x=>x.includes("không nội suy")));
assert.equal(updated.eligible.find(x=>x.id==="activity_sea").badge,"CHECK");
assert.equal(updated.eligible.find(x=>x.id==="place_inside").badge,"POSSIBLE","indoor recommendations retain the prior logic");
const unavailable=engine.applyWeatherContext(view,{source_status:"UNAVAILABLE",items:[]});
assert.equal(unavailable.eligible.find(x=>x.id==="place_pin").weather_context.status,"UNAVAILABLE");
console.log("GO Weather Context window and three-result regression tests passed");
