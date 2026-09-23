import {readFile,access} from "node:fs/promises";
import {join} from "node:path";
const file=p=>readFile(join("weather",p),"utf8");
const load=async p=>JSON.parse(await file(p));
const exists=async p=>{try{await access(join("weather",p));return true}catch{return false}};
const assert=(v,m)=>{if(!v)throw Error("CMS Weather contract: "+m)};
const required=["index.html","weather-v2.css","weather-v2.js","weather-scene-v3.html",
 "weather-scene-v3.css","weather-scene-v3.js","weather-scene-render-v2.js",
 "weather-runtime-config.js","weather-history.html","weather-history.js",
 "spatial-lab.html","spatial-lab.css","spatial-lab.js","weather-app-icon.svg",
 "data/critical.json","data/dashboard-data.json","data/current-bundle.json",
 "data/groundtruth.json","data/local-now.json","data/nowcast-compact.json",
 "data/tide.json","data/jotrip-forecast.json","data/weather-runtime/manifest.json",
 "data/weather-runtime/cloud.json","data/weather-runtime/compact.json",
 "data/weather-runtime/current.json","data/weather-runtime/forecast.json",
 "data/weather-runtime/marine.json","data/weather-runtime/meta.json"];
const time=x=>Date.parse(x||"");
for(const path of required)assert(await exists(path),path+" missing");
const manifest=await load("data/weather-runtime/manifest.json");
const cloud=await load("data/weather-runtime/cloud.json");
const marine=await load("data/weather-runtime/marine.json");
const current=await load("data/current-bundle.json");
const forecast=await load("data/weather-runtime/forecast.json");
const critical=await load("data/critical.json");
const actual=await load("data/groundtruth.json");
const html=await file("index.html");
const js=await file("weather-v2.js");
const scene=await file("weather-scene-v3.js");
const spatial=await file("spatial-lab.js");
const history=await file("weather-history.js");
assert(manifest.status==="READY","manifest not ready");
assert(manifest.policy.frontend_source==="SAME_ORIGIN_CANONICAL_ONLY","same-origin lock absent");
for(const [name,path] of Object.entries(manifest.files||{})){
 assert(path==="/weather/data/weather-runtime/"+name+".json","runtime URL wrongly points outside CMS: "+name);
}
assert(cloud.spatial?.frames?.length>=1,"no locally served Himawari map frames");
assert(marine.wave?.cells?.length>0,"marine model missing");
assert(forecast.spatial?.frames?.length>0,"forecast frames missing");
assert(current.schema_version==="weather-current-v3","wrong local bundle schema");
assert(actual.atmosphere?.vvpq?.data_class==="ACTUAL","VVPQ not actual");
assert(critical.points&&critical.points.duong_dong,"critical model points unavailable");
assert(current.local_now.data_class==="ESTIMATED_NOW","local now provenance changed");
assert(current.model_72h?.points,"72-hour model missing");
for(const point of ["duong_dong","an_thoi","ganh_dau","cua_can","bai_thom","ham_ninh","bai_sao","rach_gia"]){
 const rows=current.model_72h.points[point];
 assert(Array.isArray(rows)&&rows.length>0,point+" missing 72-hour series");
 for(const row of rows){
  assert(row.data_class==="MODEL_ONLY",point+" model mislabeled as observation");
  for(const k of ["time","wind_kmh","gust_kmh","rain_3h_mm","wave_hs_m"])
   assert(row[k]!=null,point+": "+k+" missing at "+row.time);
 }
}
assert(time(manifest.source_times.cloud_sampled_time)>0,"satellite sample time missing");
assert(time(manifest.source_times.marine_sampled_time)>0,"marine sample time missing");
assert(time(manifest.source_times.forecast_run_time)>0,"forecast model cycle missing");
assert(!/jotrip-weather-fresh|weather\.openphuquoc\.com/.test(js+scene+spatial+history),
 "public frontend still depends on the disposable Lab website or gateway");
assert(!/raw\.githubusercontent\.com/.test(js+scene+spatial+history),
 "weather browser code still calls GitHub directly");
assert(html.includes("/weather/weather-v2.js")&&html.includes("/weather/weather-v2.css"),
 "homepage assets not scoped under CMS /weather/");
assert(html.includes("/weather/data/critical.json"),
 "homepage still preloads the Lab site");
assert(js.includes("/weather/data/current-bundle.json"),
 "current bundle not read same-origin");
assert(scene.includes("SAME_ORIGIN")||scene.includes("JOTRIP_WEATHER_RUNTIME"),
 "scene does not use canonical runtime registry");
assert(history.includes("/weather/data/history"),
 "weather history is not served from CMS");
console.log(JSON.stringify({result:"PASS",pages:3,points:8,cloud_frames:cloud.spatial.frames.length,
 marine_cells:marine.wave.cells.length,forecast_frames:forecast.spatial.frames.length,
 source_times:manifest.source_times,lab_website_requests:0}));
