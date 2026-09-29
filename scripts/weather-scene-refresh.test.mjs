import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const scene=readFileSync("weather/weather-scene-v3.js","utf8");
const start=scene.indexOf("function newerRuntimeForecast(");
const end=scene.indexOf("function stamp(",start);
assert(start>0&&end>start,"Scene refresh contract helpers are missing");
const helpers=runInNewContext(scene.slice(start,end)+"\n({newerRuntimeForecast,newerMarineWave,newerDashboard})",{Date,Number,Array});
const t="2026-09-25T00:00:00Z",older="2026-09-24T12:00:00Z";
const frame={valid_time:"2026-09-25T01:00:00Z",cells:[{lat:10.2,lon:104,rain_mm:1}]};
const oldForecast={run_time:older,generated_at:"2026-09-24T12:10:00Z",spatial:{frames:[frame]}};
const freshForecast={run_time:t,generated_at:"2026-09-25T00:10:00Z",spatial:{frames:[frame]}};
assert(helpers.newerRuntimeForecast(freshForecast,oldForecast),"New live cycle must replace unchanged manifest");
assert(!helpers.newerRuntimeForecast(oldForecast,freshForecast),"Never regress to older forecast");
assert(!helpers.newerRuntimeForecast({...freshForecast,spatial:{frames:[]}},oldForecast),"Never accept missing map frames");
assert(!helpers.newerRuntimeForecast({...freshForecast,spatial:{frames:[{valid_time:t,cells:[]}]}},oldForecast),"Never accept empty map cells");
assert(helpers.newerRuntimeForecast({...oldForecast,generated_at:"2026-09-24T12:20:00Z"},oldForecast),"Same-cycle engine rebuild can recover a delayed snapshot");
assert(!helpers.newerRuntimeForecast(oldForecast,oldForecast),"Never churn unchanged snapshots");
const oldMarine={wave:{status:"READY",sampled_time:older,cells:[{wave_hs_m:.9}]}};
const freshMarine={wave:{status:"READY",sampled_time:t,cells:[{wave_hs_m:1.2}]}};
assert(helpers.newerMarineWave(freshMarine,oldMarine),"Fresh marine sample must replace static mirror");
assert(!helpers.newerMarineWave(oldMarine,freshMarine),"Never regress marine observation");
assert(!helpers.newerMarineWave({wave:{status:"STALE",sampled_time:t,cells:[{wave_hs_m:1.2}]}},oldMarine),"Reject non-READY marine");
assert(!helpers.newerMarineWave({wave:{status:"READY",sampled_time:t,cells:[]}},oldMarine),"Reject empty marine observations");
const oldMeta={generated_at:"2026-09-24T12:20:00Z",source_cycles:{ECMWF:older}};
const newMeta={generated_at:"2026-09-25T00:20:00Z",source_cycles:{ECMWF:t}};
assert(helpers.newerDashboard(newMeta,oldMeta,freshForecast),"Accept matching source-cycle metadata");
assert(!helpers.newerDashboard({...newMeta,source_cycles:{ECMWF:"2026-09-25T06:00:00Z"}},oldMeta,freshForecast),"Do not label a forecast with a different future cycle");
assert(!helpers.newerDashboard(oldMeta,newMeta,freshForecast),"Do not regress source cycles");
const fast=scene.slice(scene.indexOf("async function refreshFastRuntime(){"),scene.indexOf("async function refreshCanonicalRuntime(){"));
for(const expr of ["fetchCanonical(URLS.nowcast)","fetchCanonical(URLS.compact)","fetchCanonical(URLS.current)"])
  assert(fast.includes(expr),"Missing fast same-origin refresh: "+expr);
for(const expr of ["URLS.ecmwf","URLS.dashboard","URLS.marine"])
  assert(!fast.includes(expr),"Slow model source leaked into two-minute fast refresh: "+expr);
const slow=scene.slice(scene.indexOf("async function refreshCanonicalRuntime(){"),scene.indexOf("async function boot(){"));
for(const expr of ["fetchCanonical(URLS.manifest)","fetchCanonical(URLS.ecmwf)","fetchCanonical(URLS.dashboard)","fetchCanonical(URLS.marine)","newerRuntimeForecast(forecast.value,state.ecmwf)","newerMarineWave(marine.value,state.marine)"])
  assert(slow.includes(expr),"Missing slow canonical refresh: "+expr);
assert(scene.includes("const SCENE_FAST_REFRESH_MS=2*60*1000"),"Fast Weather Scene cadence must stay at two minutes");
assert(scene.includes("const SCENE_SLOW_REFRESH_MS=10*60*1000"),"Model/marine Weather Scene cadence must be ten minutes");
assert(scene.includes("if(now-lastSceneFastRefreshAt>=SCENE_FAST_REFRESH_MS)refreshFastRuntime()"),"Visibility resume must not force an early fast refresh");
assert(scene.includes("if(now-lastSceneSlowRefreshAt>=SCENE_SLOW_REFRESH_MS)refreshCanonicalRuntime()"),"Visibility resume must not force an early slow refresh");
assert(scene.includes("return state.ecmwf?.run_time||state.ecmwf?.spatial?.short_run_time||cycles.ECMWF"),"Displayed forecast must cite its actual model cycle");
const html=readFileSync("weather/weather-scene-v3.html","utf8");
assert(html.includes("/weather/weather-scene-v3.js?v=20260925-edge-model1"),"Scene JS cache not invalidated");
console.log("CMS Scene: freshness, split-cadence refresh and source-cycle regression assertions PASS");
