import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const ctx={window:{},console};
vm.createContext(ctx);
for(const file of ["core/decision-signals.js","core/go-geo.js","core/go-engine.js","go/live-adapter.js"]){
  vm.runInContext(fs.readFileSync(file,"utf8"),ctx,{filename:file});
}
const S=ctx.window.OpenPQDecisionSignals,E=ctx.window.OpenPQGoEngine,A=ctx.window.OpenPQGoLive;
assert.ok(S&&E&&A,"Shared signals, GO engine and adapter must load");
const NOW="2026-09-26T11:00:00+07:00",now=new Date(NOW),stamp="2026-09-26T10:45:00+07:00";
const weather=(south="LOW",central="LOW",north="LOW")=>({
  generated_at:"2026-09-26T10:50:00+07:00",
  points:Object.fromEntries([["duong_dong",central],["an_thoi",south],["ganh_dau",north]]
    .map(([k,risk])=>[k,{name:k,local:{available:true,rain_rate_mm_h:0,rain_class:"ESTIMATED_NOW"},
      nowcast:{status:"POINT_NUMERIC_READY",sampled_time:stamp,convective_level:risk}}])),
  actual:{rain_gauges:[]}
});
const wx=weather("HIGH","LOW","LOW");
assert.equal(S.pointWeather(wx,"zone_south",now).status,"watch");
assert.equal(S.pointWeather(wx,"zone_central_west",now).status,"normal");
assert.equal(S.islandWeather(wx,now).status,"watch");
assert.equal(A.weatherState(wx,"zone_south",now).status,"watch");
assert.equal(A.weatherState(wx,"zone_central_west",now).status,"normal");
assert.equal(A.weatherState(wx,"wrong-zone",now).status,"unknown",
  "Unknown place must never silently fall back to Dương Đông");
const elevated=weather("ELEVATED");
assert.equal(S.pointWeather(weather("MODERATE"),"zone_south",now).status,"advisory");
assert.equal(S.pointWeather(elevated,"zone_south",now).status,"advisory",
  "Elevated convection is not normal");
const stalePoint=weather("HIGH");
stalePoint.points.an_thoi.nowcast.sampled_time="2026-09-26T07:00:00+07:00";
assert.equal(S.pointWeather(stalePoint,"zone_south",now).status,"unknown",
  "A fresh snapshot must not revive an old high-risk satellite sample");
assert.equal(S.islandWeather(stalePoint,now).status,"unknown",
  "One incomplete primary point must not establish island-wide normal");
const rainForecast=weather("LOW");
rainForecast.points.an_thoi.local.rain_rate_mm_h=3.2;
assert.equal(S.pointWeather(rainForecast,"zone_south",now).status,"advisory");
assert.equal(S.pointWeather(rainForecast,"zone_central_west",now).status,"normal");
const gauges=weather("LOW");
gauges.actual.rain_gauges=[{qc:"PASS",increment_qc:"PASS",observed_at:"2026-09-26T10:50:00+07:00",rain_observed:true}];
assert.equal(S.islandWeather(gauges,now).status,"advisory");
gauges.actual.rain_gauges[0].observed_at="2026-09-26T07:00:00+07:00";
assert.equal(S.islandWeather(gauges,now).status,"normal","Old gauge rain is not current rain");

const marine=()=>({source_date:"26/09/2026",collected_at_vn:"2026-09-26T10:55:00+07:00",
  categories:{
    cano:{state:"SUSPENDED",evidence:[{source:"JOTRIP_FIELD_CONFIRMATION",confirmed_at_text:"26/09/2026 10:55"}]},
    fast_boat:{state:"DIRECT_CONFIRMED",evidence:[{source:"PORT_CLEARANCE_KGG",issued_at_text:"26/09/2026 10:40"}]},
    ferry:{state:"RUNNING",evidence:[{source:"OPERATOR",observed_at:"2026-09-26T10:50:00+07:00"}]}
  }});
const m=marine();
assert.equal(S.marineCategory(m,"cano",now).state,"SUSPENDED");
assert.equal(S.marineCategory(m,"fast_boat",now).state,"DIRECT_CONFIRMED");
assert.equal(S.marineCategory(m,"ferry",now).state,"RUNNING");
assert.equal(S.marineCategory(m,"charter_boat",now).state,"UNKNOWN",
  "Cano/fast ferry permits never confirm a separate fishing charter");
const wrongDay=marine();wrongDay.source_date="25/09/2026";
assert.equal(S.marineCategory(wrongDay,"cano",now).state,"UNKNOWN");
const staleFeed=marine();staleFeed.collected_at_vn="2026-09-25T22:00:00+07:00";
assert.equal(S.marineCategory(staleFeed,"cano",now).state,"UNKNOWN");
const unevidenced=marine();unevidenced.categories.cano.evidence=[];
assert.equal(S.marineCategory(unevidenced,"cano",now).state,"UNKNOWN");
const oldEvidence=marine();oldEvidence.categories.cano.evidence[0].confirmed_at_text="25/09/2026 10:55";
assert.equal(S.marineCategory(oldEvidence,"cano",now).state,"UNKNOWN",
  "Today's rebuilt snapshot cannot revive yesterday's operator evidence");
const noTimeEvidence=marine();noTimeEvidence.categories.cano.evidence[0]={source:"JOTRIP_FIELD_CONFIRMATION"};
assert.equal(S.marineCategory(noTimeEvidence,"cano",now).state,"UNKNOWN",
  "Evidence without its own timestamp cannot confirm today's operation");
const future=marine();future.collected_at_vn="2026-09-26T16:00:00+07:00";
assert.equal(S.marineCategory(future,"cano",now).state,"UNKNOWN");

const opening={state:"PUBLISHED_SCHEDULE",schedule_type:"DAILY",
  verified_at:"2026-09-26",windows:[{start:"06:00",end:"23:00"}]};
const charter={id:"activity_big_game_fishing",name:"Câu cá lớn",zone_id:"zone_south",
  opening_hours:opening,duration:"2 giờ"};
const canoe={id:"activity_tour_3_islands",name:"Tour cano",zone_id:"zone_south",
  opening_hours:opening,duration:"2 giờ"};
const walk={id:"place_south_walk",name:"Đi chơi An Thới",zone_id:"zone_south",
  opening_hours:opening,duration:"45 phút"};
const northWalk={id:"place_north_walk",name:"Đi Bắc đảo",zone_id:"zone_north",
  opening_hours:opening,duration:"45 phút"};
const cfg=(id,opts={})=>({entity_id:id,minimum_visit_min:60,entry_buffer_min:10,
  environment:"outdoor",...opts});
const input=(entities,activities,live)=>({
  now:NOW,originZone:"zone_central_west",available:"full",interest:"all",
  entities,config:{activities},live,notices:[]
});
const weather_by_zone=Object.fromEntries(
  ["zone_central_west","zone_south","zone_north"]
    .map(z=>[z,S.pointWeather(wx,z,now)]));
const live={cano:S.marineCategory(m,"cano",now),
  fast_boat:S.marineCategory(m,"fast_boat",now),
  ferry:S.marineCategory(m,"ferry",now),
  charter_boat:S.marineCategory(m,"charter_boat",now),
  weather:weather_by_zone.zone_central_west,weather_by_zone,marine_route:{}};
const charterCfg=cfg(charter.id,{marine:true,environment:"marine",
  operational_binding:"charter_boat",marine_route:"an_thoi_offshore"});
const charterPlan=E.plan(input([charter],[charterCfg],live));
assert.equal(charterPlan.results[0]?.badge,"CHECK",
  "Suspended canoe cannot cancel a distinct charter, which still needs its own confirmation");
assert.ok(charterPlan.results[0].warnings.some(x=>x.includes("tàu câu cá")),
  "The charter must show missing charter confirmation");
assert.ok(charterPlan.results[0].warnings.some(x=>x.includes("theo tuyến")),
  "Offshore route conditions must never be inferred from An Thới land point");
const canoePlan=E.plan(input([canoe],[cfg(canoe.id,{marine:true,environment:"marine",
  operational_binding:"cano"})],live));
assert.equal(canoePlan.results.length,0,"Fresh suspended canoe blocks its own activity");
assert.equal(canoePlan.excluded[0]?.id,canoe.id);
const walkPlan=E.plan(input([walk],[cfg(walk.id)],live));
assert.equal(walkPlan.results[0]?.badge,"CHECK",
  "Normal origin weather must not hide hazardous weather at destination");
const northPlan=E.plan(input([northWalk],[cfg(northWalk.id)],live));
assert.equal(northPlan.results[0]?.badge,"POSSIBLE",
  "An Thới alert must not automatically taint a separately sampled Bắc đảo point");
const charterCleared=marine();
charterCleared.categories.charter_boat={
  state:"DIRECT_CONFIRMED",evidence:[{source:"JOTRIP_FIELD_CHARTER_CONFIRMATION",confirmed_at_text:"26/09/2026 10:55"}]};
const allQuiet=weather();
const approvedByZone=Object.fromEntries(Object.keys(weather_by_zone)
  .map(z=>[z,S.pointWeather(allQuiet,z,now)]));
const confirmed=E.plan(input([charter],[charterCfg],{
  ...live,charter_boat:S.marineCategory(charterCleared,"charter_boat",now),
  weather_by_zone:approvedByZone,
  marine_route:{an_thoi_offshore:{status:"normal",freshness:"fresh",
    source_updated_at:"2026-09-26T10:45:00+07:00"}}
}));
assert.equal(confirmed.results[0]?.badge,"POSSIBLE",
  "An individually confirmed charter with route evidence can be considered without a canoe permit");
const staleCano={...live.cano,source_updated_at:"2026-09-25T07:00:00+07:00",
  freshness:"stale"};
const stalePlan=E.plan(input([canoe],[cfg(canoe.id,{marine:true,environment:"marine",
  operational_binding:"cano"})],{...live,cano:staleCano}));
assert.equal(stalePlan.results[0]?.badge,"CHECK",
  "Yesterday's suspension must not be copied as today's operating prohibition");
const unbound=E.plan(input([charter],[cfg(charter.id,{marine:true,environment:"marine"})],live));
assert.equal(unbound.results[0]?.badge,"CHECK",
  "Marine activity without a named vessel feed cannot be marked ready");
const ferryPermit=E.plan(input([canoe],[cfg(canoe.id,{operational_binding:"ferry"})],live));
assert.equal(ferryPermit.results[0]?.badge,"CHECK",
  "A confirmed ferry departure cannot confirm a different scheduled journey");
const ferryOnly=E.plan(input([canoe],[cfg(canoe.id,{operational_binding:"ferry"})],{
  ...live,ferry:{...live.ferry,state:"SUSPENDED"}
}));
assert.equal(ferryOnly.results.length,0,"Only an explicitly ferry-bound trip is blocked by ferry suspension");

const config=JSON.parse(fs.readFileSync("data/go-config.json","utf8"));
assert.equal(config.activities.find(x=>x.entity_id==="activity_big_game_fishing")?.operational_binding,
  "charter_boat");
assert.equal(config.activities.find(x=>x.entity_id==="activity_hon_thom")?.operational_binding,
  "cable_car");
const home=fs.readFileSync("home-live-v3.js","utf8"),homepage=fs.readFileSync("index.html","utf8"),
  go=fs.readFileSync("go/index.html","utf8");
assert.match(home,/islandDecision\.status/);
assert.match(home,/decisionSignals\?\.marineCategory/);
assert.match(home,/Đã ghi nhận chuyến rời cảng/);
assert.match(home,/transitRunning/);
assert.ok(homepage.indexOf('src="core/decision-signals.js?')<
  homepage.indexOf('src="home-live-v3.js?'));
assert.ok(go.indexOf('src="../core/decision-signals.js?')<
  go.indexOf('src="live-adapter.js?'));
console.log("Decision core PASS: per-zone weather, fresh observations, independent canoe/charter/ferry states, route caution and regression bindings.");
