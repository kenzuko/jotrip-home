import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const areaSource=fs.readFileSync("core/location-context.js","utf8");
const saved=new Map(),events=[];
const win={
  sessionStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},
  dispatchEvent:event=>events.push(event),
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}
};
vm.runInNewContext(areaSource,{window:win,URLSearchParams,console});
const A=win.OpenPQArea;
assert.ok(A,"Location module must load");
assert.equal(A.get(),"all","Default is the whole island, not a guessed position");
assert.equal(A.zone("all"),null,"All island must not silently choose GO's origin");
assert.equal(A.zone("place_sunset_town"),"zone_south","GO accepts the parent South Island zone");
assert.equal(A.explore("place_sunset_town"),"zone_south","Explore receives a supported zone");
assert.equal(A.set("zone_south"),"zone_south");
assert.equal(A.get(),"zone_south");
assert.equal(saved.get(A.KEY),"zone_south");
assert.equal(events.at(-1).detail.area,"zone_south");
assert.equal(A.fromQuery("area","?area=zone_north"),"zone_north");
assert.equal(A.fromQuery("area","?area=all"),"all","Explicit all overrides remembered region");
assert.equal(A.fromQuery("area","?category=ATM"),"zone_south");
assert.equal(A.set("untrusted-invented-zone"),"zone_south","Reject unknown area IDs");
assert.equal(A.nearest(10.0191,104.0150),"zone_south");
assert.equal(A.nearest(10.2172,103.9593),"zone_central_west");
assert.equal(A.nearest(10.3759,103.90),"zone_north");
assert.equal(A.nearest(9.20,102.10),null,"Outside-island GPS may not claim a local region");
assert.equal(A.set("place_sunset_town"),"place_sunset_town");
assert.equal(A.zone(A.get()),"zone_south");

const privateWin={sessionStorage:{getItem(){throw Error("Safari private storage");},setItem(){throw Error("Safari private storage");}}};
vm.runInNewContext(areaSource,{window:privateWin,URLSearchParams});
assert.equal(privateWin.OpenPQArea.set("zone_north"),"zone_north");
assert.equal(privateWin.OpenPQArea.get(),"zone_north","Still works in-memory with blocked storage");
assert.equal(privateWin.OpenPQArea.set("all"),"all");
assert.equal(privateWin.OpenPQArea.get(),"all","Clearing to whole island works even without sessionStorage");

const index=fs.readFileSync("index.html","utf8"),go=fs.readFileSync("go/index.html","utf8"),
  near=fs.readFileSync("nearme/index.html","utf8"),explore=fs.readFileSync("explore/index.html","utf8");
assert.ok(index.indexOf('class="brand"')<index.indexOf('id="siteAreaButton"') &&
  index.indexOf('id="siteAreaButton"')<index.indexOf('id="primary-nav"'),
  "Location picker must sit beside the logo on the same top bar");
assert.match(index,/Chọn khu vực để nhận gợi ý thông minh hơn\./);
assert.match(index,/aria-expanded="false" aria-controls="siteAreaPanel"/);
assert.match(index,/id="siteAreaLocate"/,"GPS is present but opt-in");
assert.ok(index.indexOf("core/location-context.js")<index.indexOf("home-nearme-v2.js"));
for(const [page,app] of [[go,"go.js"],[near,"nearme.js"],[explore,"app.js"]]){
  assert.ok(page.includes("core/location-context.js"));
  assert.ok(page.indexOf("core/location-context.js")<page.lastIndexOf(app),
    "Load shared context before the page logic");
}
const homeNear=fs.readFileSync("home-nearme-v2.js","utf8");
const goJs=fs.readFileSync("go/go.js","utf8");
const nearJs=fs.readFileSync("nearme/nearme.js","utf8");
const exploreJs=fs.readFileSync("explore/app.js","utf8");
for(const src of [homeNear,goJs,nearJs,exploreJs])
  assert.match(src,/OpenPQArea/,"Every product must consume shared area");
assert.match(homeNear,/openpq:area-changed/,"Homepage Near Me updates on area change");
assert.match(goJs,/context\?\.zone\(context\.get\(\)\)/);
assert.match(nearJs,/initialParams\.has\("area"\)/);
assert.match(exploreJs,/params\.has\("zone"\)/);
assert.doesNotMatch(areaSource,/localStorage|document\.cookie/,
  "Only session memory allowed");
assert.doesNotMatch(areaSource,/setItem\([^,]+,\s*JSON\.stringify/,
  "Never store raw GPS objects");
const css=fs.readFileSync("styles.css","utf8");
assert.match(css,/\.site-area-button\{[\s\S]*?min-height:44px/);
assert.match(css,/@media\(max-width:350px\)/);
console.log("Shared region QA PASS: same-row 44px selector, session privacy, explicit route precedence, Sunset Town parent-zone, GPS opt-in, Safari fallback and four product handoffs.");

const coreContext={globalThis:{},window:undefined};
vm.createContext(coreContext);
vm.runInContext(fs.readFileSync("core/go-engine.js","utf8"),coreContext);
const E=coreContext.globalThis.OpenPQGoEngine;
const config=JSON.parse(fs.readFileSync("data/go-config.json","utf8"));
const entities=JSON.parse(fs.readFileSync("data/entities/activities.json","utf8")).entities;
const honThom=entities.find(x=>x.id==="activity_hon_thom");
const fishing=entities.find(x=>x.id==="activity_big_game_fishing");
const hCfg=config.activities.find(x=>x.entity_id===honThom.id);
const fCfg=config.activities.find(x=>x.entity_id===fishing.id);
assert.deepEqual(honThom.opening_hours.windows.map(x=>[x.start,x.end]),
  [["09:30","11:30"],["13:30","14:00"],["15:30","17:30"]]);
assert.deepEqual(fishing.opening_hours.windows.map(x=>[x.start,x.end]),
  [["05:00","14:00"],["14:00","21:00"]]);
assert.equal(fishing.official_url,"https://phuquocfishingtours.com/");
assert.equal(fCfg.route,fishing.official_url);
assert.equal(hCfg.split_return_schedule,true);
assert.equal(fCfg.schedule_exact_window,true);
const plan=(id,cfg,now,available="full")=>E.plan({
  now,originZone:"zone_south",available,interest:"all",
  config:{activities:[cfg]},entities:entities.filter(x=>x.id===id),notices:[],live:{}
});
const morning=plan(fishing.id,fCfg,"2026-09-26T03:45:00+07:00");
assert.equal(morning.results[0]?.starts_at,"05:00","Morning fishing departs at its confirmed 05:00 window");
assert.equal(morning.results[0]?.finish_at,"14:00");
const evening=plan(fishing.id,fCfg,"2026-09-26T12:25:00+07:00");
assert.equal(evening.results[0]?.starts_at,"14:00","Afternoon fishing uses its actual 7h duration");
assert.equal(evening.results[0]?.finish_at,"21:00");
assert.equal(evening.results[0]?.badge,"CHECK","Confirmed timetable is not proof a boat sails today");
const h=plan(honThom.id,hCfg,"2026-09-26T08:00:00+07:00");
assert.equal(h.results[0]?.starts_at,"09:30");
assert.equal(h.results[0]?.finish_at,"14:00",
  "Take morning cable, remain four hours, return at 13:45 in operator's second window");
assert.match(h.results[0]?.timing||"",/cáp về 13:45/);
assert.equal(plan(honThom.id,hCfg,"2026-09-26T08:00:00+07:00","half").results.length,0,
  "Half day is not long enough for four-hour Hòn Thơm visit and return");
assert.equal(plan(honThom.id,hCfg,"2026-09-26T12:30:00+07:00").results.length,0,
  "Do not assume cable remains open after last published 17:30 return");
const goPage=fs.readFileSync("go/go.js","utf8");
const detail=fs.readFileSync("places/detail.js","utf8");
assert.match(goPage,/Xem tour câu cá JoTrip/);
const handoffStart=goPage.indexOf("function nearmeHandoffRoute(category){");
const handoffEnd=goPage.indexOf("\n  function mapRows(){",handoffStart);
const nearmeHandoff=handoffStart>=0&&handoffEnd>handoffStart?goPage.slice(handoffStart,handoffEnd):"";
assert.ok(nearmeHandoff.includes('area:state.originZone||"all"'),
  "GO map venue links must preserve the selected coarse area, defaulting explicitly to all-island");
assert.doesNotMatch(nearmeHandoff,/state\.position|latitude|longitude/,
  "Never put raw GPS coordinates into a Near Me URL");
assert.match(nearmeHandoff,/area:state\\.originZone\\|\\|"all"/,
  "GO map venue links must preserve the selected coarse area, defaulting explicitly to all-island");
assert.doesNotMatch(nearmeHandoff,/state\\.position|latitude|longitude/,
  "Never put raw GPS coordinates into a Near Me URL");
assert.match(detail,/phuquocfishingtours\.com/);
console.log("Operator schedule QA PASS: exact two fishing departures, all three cable windows and correct separate return slot; fishing website linked.");
