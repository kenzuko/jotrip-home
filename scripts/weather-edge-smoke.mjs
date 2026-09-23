import {readFileSync} from "node:fs";
import {handleWeatherData,WEATHER_EDGE_SOURCES} from "../functions/_shared/weather-edge.js";
const check=(x,m)=>{if(!x)throw Error("Weather edge QA: "+m)};
const now=new Date().toISOString(),future=new Date(Date.now()+3600000).toISOString();
let hits=0;
const fixture={
 critical:{points:{duong_dong:{}},default_point:"duong_dong",generated_at:now},
 local:{points:{duong_dong:{temperature_c:30}},generated_at:now},
 ground:{atmosphere:{vvpq:{data_class:"ACTUAL"}},generated_at:now},
 current:{local_now:{points:{duong_dong:{}},generated_at:now},groundtruth:{atmosphere:{}},model_72h:{points:{duong_dong:[{time:future,data_class:"MODEL_ONLY",wind_kmh:12,gust_kmh:20,rain_3h_mm:0.2,wave_hs_m:0.5}]}}},
 compact:{points:{duong_dong:{convective_signal:"LOW"}},sampled_time:now,generated_at:now},
 cloud:{status:"POINT_NUMERIC_READY",sampled_time:now,generated_at:now,spatial:{status:"READY",frames:[{sampled_time:now,cells:[{lat:10.2,lon:104,cloud_top_cold_c:-42,convective_score:20,unused:"do-not-leak"}]}]}},
 forecast:{regions:{north:{}},generated_at:now},
 aqi:{status:"READY",generated_at:now},
 dashboard:{points:{duong_dong:{}},source_cycles:{ECMWF:now},generated_at:now},
 tide:{status:"READY",generated_at:now},
 marine:{wave:{cells:[{lat:10,lon:104}],sampled_time:now}},
 spatial:{product:"ECMWF",run_time:now,generated_at:now,spatial:{frames:[{valid_time:future,lead_hours:1,cells:[{cell_id:"test",lat:10,lon:104,wind_kmh:12,rain_mm:0.2,unused:"do-not-leak"}]}]}},
 icon:{status:"READY",generated_at:now}
};
function source(u){
 const p=new URL(u).pathname;
 if(p.endsWith("/data/critical.json"))return fixture.critical;
 if(p.endsWith("/weather-groundtruth/local-now.json"))return fixture.local;
 if(p.endsWith("/weather-groundtruth/latest.json"))return fixture.ground;
 if(p.endsWith("/weather-current/latest.json"))return fixture.current;
 if(p.endsWith("/weather-nowcast/compact-latest.json"))return fixture.compact;
 if(p.endsWith("/weather-nowcast/latest.json"))return fixture.cloud;
 if(p.endsWith("/jotrip-forecast.json"))return fixture.forecast;
 if(p.endsWith("/weather-aqi/latest.json"))return fixture.aqi;
 if(p.endsWith("/dashboard-data.json"))return fixture.dashboard;
 if(p.endsWith("/tide.json"))return fixture.tide;
 if(p.endsWith("/spatial-ecmwf.json"))return fixture.spatial;
 if(p.endsWith("/spatial-icon.json"))return fixture.icon;
 if(p.endsWith("/spatial-marine.json"))return fixture.marine;
 throw Error("Unknown upstream "+p);
}
globalThis.fetch=async input=>{hits++;return new Response(JSON.stringify(source(String(input))),{headers:{"content-type":"application/json"}})};
const memo=new Map();
globalThis.caches={default:{match:async key=>memo.get(key.url)?.clone()||null,put:async(key,response)=>memo.set(key.url,response.clone())}};
const call=(path,waitUntil=undefined)=>handleWeatherData(new Request("https://cms.openphuquoc.com"+path+"?v="+Date.now()),
 ()=>new Response('{"source":"snapshot"}',{headers:{"content-type":"application/json"}}),waitUntil);
check(WEATHER_EDGE_SOURCES.length>=17,"all relevant data routes must be explicit");
const local=await call("/weather/data/local-now.json");
check(local.status===200&&local.headers.get("x-openpq-weather-edge")==="ENGINE_DIRECT","local source must use independent engine");
check((await local.json()).points.duong_dong.temperature_c===30,"cached response cloning must preserve live response body");
const prior=hits;
const again=await call("/weather/data/local-now.json");
check(again.headers.get("x-openpq-weather-edge")==="EDGE_CACHE"&&hits===prior,"repeat same-origin requests share Cloudflare cache");
const cloud=await (await call("/weather/data/weather-runtime/cloud.json")).json();
check(cloud.spatial.frames.length===1&&!JSON.stringify(cloud).includes("do-not-leak"),"cloud reduces 4MB source to scene fields");
const forecast=await(await call("/weather/data/weather-runtime/forecast.json")).json();
check(forecast.spatial.frames.length===1&&!JSON.stringify(forecast).includes("do-not-leak"),"forecast maps spatial frame contract");
const current=await(await call("/weather/data/current-bundle.json")).json();
check(current.model_72h.points.duong_dong[0].data_class==="MODEL_ONLY","models retain their provenance");
const health=await(await call("/weather/data/edge-health.json")).json();
check(health.schema_version==="openpq-weather-edge-health-v1"&&health.status==="READY"&&health.results.length===4,"health audits measured source sample ages");
const bad=await call("/weather/data/unknown.json");
check(bad.headers.get("x-openpq-weather-edge")===null&&bad.status===200,"unknown routes fall through to CMS static assets");
globalThis.fetch=async()=>{throw Error("upstream_offline")};
memo.clear();
const fallback=await call("/weather/data/local-now.json");
check(fallback.headers.get("x-openpq-weather-edge")==="STATIC_FALLBACK","stale snapshots must be marked");
const html=readFileSync("weather/index.html","utf8");
const routes=JSON.parse(readFileSync("scripts/routes.json","utf8"));
const wrangler=JSON.parse(readFileSync("wrangler.jsonc","utf8"));
check(html.includes("/ecosystem-shell.css")&&html.includes("/assets/logo-master.png"),"Weather must use OpenPQ shared branding");
check(html.includes("weather-module-nav")&&html.includes("weatherEdgeState"),"Weather must expose module navigation and diagnostics");
check(routes.include.includes("/weather/data/*")&&wrangler.assets.run_worker_first.includes("/weather/data/*"),"Cloudflare Worker and Pages must intercept live data");
check(wrangler.triggers.crons.includes("*/10 * * * *"),"Cloudflare Worker must have independent scheduled prewarming");
console.log(JSON.stringify({result:"PASS",edge:"SAME_ORIGIN_CLOUDFLARE",routes:WEATHER_EDGE_SOURCES.length,cloud_frames:cloud.spatial.frames.length,forecast_frames:forecast.spatial.frames.length,health:health.status,snapshot_fallback:"EXPLICIT",brand:"OPENPQ",cache:"PASS",lab_website_requests:0}));
