import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(path,"utf8");
const airport=read("airport/app.js");
assert(airport.includes("const VERSION_CHECK_MS=15*1000"),"Airport near-live version cadence changed");
assert(airport.includes("const FALLBACK_REFRESH_MS=5*60*1000"),"Airport full fallback refresh must be throttled");
assert(airport.includes("document.visibilityState==='visible'&&Date.now()-state.lastFetchAt>=FALLBACK_REFRESH_MS"),"Airport hidden tabs must not full-refresh");
assert(!airport.includes("setInterval(()=>load(),AUTO_REFRESH_MS)"),"Legacy unconditional Airport full poll returned");

const scene=read("weather/weather-scene-v3.js");
assert(scene.includes("const SCENE_FAST_REFRESH_MS=2*60*1000"),"Weather Scene fast cadence missing");
assert(scene.includes("const SCENE_SLOW_REFRESH_MS=10*60*1000"),"Weather Scene slow cadence missing");
assert(scene.includes("async function refreshFastRuntime()"),"Weather Scene fast refresh missing");
assert(scene.includes("if(sceneFastRefreshBusy||document.visibilityState===\"hidden\")return"),"Weather Scene hidden-tab guard missing");
assert(scene.includes("if(now-lastSceneFastRefreshAt>=SCENE_FAST_REFRESH_MS)refreshFastRuntime()"),"Weather Scene visibility fast gate missing");
assert(scene.includes("if(now-lastSceneSlowRefreshAt>=SCENE_SLOW_REFRESH_MS)refreshCanonicalRuntime()"),"Weather Scene visibility slow gate missing");

const spatial=read("weather/spatial-lab.js");
assert(spatial.includes("const RUNTIME_REFRESH_MS=2*60*1000"),"Spatial Lab refresh cadence missing");
assert(spatial.includes("if(state.runtimeRefreshing||document.visibilityState===\"hidden\")return"),"Spatial Lab hidden-tab guard missing");
assert(spatial.includes("Date.now()-state.lastRuntimeRefreshAt>=RUNTIME_REFRESH_MS"),"Spatial Lab visibility age gate missing");

const traffic=read("core/traffic.js");
const trafficApi=read("functions/_shared/traffic-analytics.js");
const routes=JSON.parse(read("scripts/routes.json"));
assert(traffic.includes('location.hostname!=="openphuquoc.com"'),"Traffic tracker must run only on canonical public host");
assert(!traffic.includes('location.hostname!=="cms.openphuquoc.com"'),"Legacy CMS traffic tracker host returned");
assert(trafficApi.includes('const BASE_HOST="openphuquoc.com"'),"Traffic collector canonical origin missing");
assert(!routes.include.includes("/api/traffic/collect"),"CMS Pages must not receive canonical traffic collection");

const weather=read("weather/weather-v2.js");
assert(weather.includes('const shareUrl="https://openphuquoc.com/weather/"'),"Weather share URL must be canonical");
assert(!weather.includes('const shareUrl="https://cms.openphuquoc.com/weather/"'),"Legacy Weather share URL returned");

const middleware=read("functions/_middleware.js");
assert(middleware.includes('const LEGACY_PAGES_HOST="jotrip-home.pages.dev"'),"Legacy Pages host redirect missing");
assert(middleware.includes("host===LEGACY_PAGES_HOST&&isPublicPage(url.pathname)"),"Legacy Pages public redirect gate missing");

console.log("RUNTIME REQUEST BUDGET PASS: Weather, Airport, Pages and analytics guards are locked");
