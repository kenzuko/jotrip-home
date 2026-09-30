import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

// Regression: preserve all actionable departure changes on busy days, while
// keeping arrival baggage-belt notifications out of Operation Watch.
 // Both homepage and Airport must derive the same count from identical data.
const airport=readFileSync(new URL("../airport/app.js",import.meta.url),"utf8");
const home=readFileSync(new URL("../home-live-v3.js",import.meta.url),"utf8");
function section(src,begin,end){
  const i=src.indexOf(begin),j=src.indexOf(end,i);
  assert.ok(i>=0&&j>i,`Missing runtime function: ${begin}`);
  return src.slice(i,j);
}
const upsert=section(airport,"function fidsEventId(e){","function captureFidsSnapshotChanges(");
const watch=section(airport,"function buildOperationWatchItems(){","function renderSummary()");
const homeWatch=section(home,"  function buildAirportWatchSummary(","  const localeUiReady");
const clock=15*60+3;
const minutes=value=>{
  const match=String(value||"").match(/(\d{1,2}):(\d{2})/);
  return match?Number(match[1])*60+Number(match[2]):null;
};
const arrivals=Array.from({length:61},(_,i)=>({
  direction:"arrival",operating_flight_number:`VJ${5000+i}`,
  scheduled_time:"18:00",actual_time:null,status_code:"ON_TIME",
  status:"ĐÚNG GIỜ",station:"HÀ NỘI",belt:"2"
}));
const departures=Array.from({length:61},(_,i)=>({
  direction:"departure",operating_flight_number:`VJ${6000+i}`,
  scheduled_time:"18:00",actual_time:null,status_code:"ON_TIME",
  status:"ĐÚNG GIỜ",station:"TP.HCM",gate:"2"
}));
const records=[...arrivals,...departures];
const events=records.map(r=>({
  type:"CHANGED",at:"2026-09-30T09:00:00+07:00",
  direction:r.direction,flight_number:r.operating_flight_number,
  changes:r.direction==="arrival"?{belt:{from:"1",to:"2"}}:{gate:{from:"1",to:"2"}}
}));
const state={fidsEvents:[],latest:{
  records,collected_at_vn:"2026-09-30T15:03:00+07:00"
}};
const fields={
  gate:{current:"gate"},checkin_row:{current:"checkin_row"},belt:{current:"belt"}
};
const internal=new Function(
  "state","window","FIDS_FIELDS","nowMinutes","ageInfo","foldText",
  "mins","todayVn","flightKey","cleanFidsValue","stationLabel",
  "scheduledTime","scheduleDeviation","isDelayed","displayStatusLabel","uiStatus",
  upsert+"\n"+watch+"\nreturn {upsertFidsEvent,buildOperationWatchItems}"
)(
  state,{},fields,()=>clock,()=>({level:"good"}),
  text=>String(text||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase(),
  minutes,()=>"2026-09-30",
  r=>`${r.direction}|${r.operating_flight_number}`,
  value=>String(value??"").trim(),value=>value,
  r=>r.scheduled_time,()=>({delta:null}),()=>false,
  r=>r.status,value=>value
);
for(const e of events){
  internal.upsertFidsEvent({
    at:e.at,flightKey:`${e.direction}|${e.flight_number}`,
    flightNumber:e.flight_number,direction:e.direction,
    field:e.direction==="arrival"?"belt":"gate",from:"1",to:"2",source:"history"
  });
}
// Duplicate identical event must not create an additional watch item.
internal.upsertFidsEvent({
  at:events[0].at,flightKey:`arrival|${events[0].flight_number}`,
  field:"belt",from:"1",to:"2",source:"history"
});
const homepage=new Function(
  "vnClockParts","vnDateKey",homeWatch+"\nreturn buildAirportWatchSummary"
)(()=>({minutes:clock}),()=>"2026-09-30");
const homeCount=homepage({records},events.map(e=>JSON.stringify(e)).join("\n")).count;
const innerCount=internal.buildOperationWatchItems().filter(x=>x.kind!=="data").length;
assert.equal(state.fidsEvents.length,122,"Retain history without a last-40 cap");
assert.equal(homeCount,61,"Ignore 61 arrival belt events; keep 61 departure gate events");
assert.equal(innerCount,homeCount,"Homepage and Airport must agree for identical data");
assert.match(airport,/state\.fidsHistoryDate!==boardDate/,"Reload history on board-day rollover");
console.log("Airport watch regression PASS (61 arrival belts ignored; 61 departure gates retained; counts agree)");
