// OpenPQ-owned Cloudflare Weather edge. All browser URLs remain same-origin.
// Sources are the independent JoTrip data-engine branches, NEVER the disposable
// weather.openphuquoc.com website or the Jotrip-Weather Lab repository.
const DATA = "https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/";
const LIVE = DATA + "data-weather/data/";
const ENGINE = DATA + "feat/weather-lab-data-engine-v1/weather/";
const PUBLISHED = DATA + "gh-pages/weather/";
const CACHE_SECONDS = 105;
const SOURCES = Object.freeze({
  "/weather/data/critical.json": [PUBLISHED+"data/critical.json","critical"],
  "/weather/data/local-now.json": [LIVE+"weather-groundtruth/local-now.json","local"],
  "/weather/data/groundtruth.json": [LIVE+"weather-groundtruth/latest.json","ground"],
  "/weather/data/current-bundle.json": [LIVE+"weather-current/latest.json","current"],
  "/weather/data/nowcast-compact.json": [LIVE+"weather-nowcast/compact-latest.json","compact"],
  "/weather/data/jotrip-forecast.json": [PUBLISHED+"jotrip-forecast.json","forecast"],
  "/weather/data/air-quality.json": [LIVE+"weather-aqi/latest.json","aqi"],
  "/weather/data/dashboard-data.json": [ENGINE+"dashboard-data.json","dashboard"],
  "/weather/data/tide.json": [ENGINE+"tide.json","tide"],
  "/weather/data/weather-runtime/cloud.json": [LIVE+"weather-nowcast/latest.json","cloud"],
  "/weather/data/weather-runtime/compact.json": [LIVE+"weather-nowcast/compact-latest.json","compact"],
  "/weather/data/weather-runtime/current.json": [LIVE+"weather-current/latest.json","current"],
  "/weather/data/weather-runtime/forecast.json": [ENGINE+"spatial-ecmwf.json","spatial-forecast"],
  "/weather/data/weather-runtime/marine.json": [ENGINE+"spatial-marine.json","marine"],
  "/weather/data/weather-runtime/meta.json": [ENGINE+"dashboard-data.json","meta"],
  "/weather/spatial-ecmwf.json": [ENGINE+"spatial-ecmwf.json","spatial-raw"],
  "/weather/spatial-icon.json": [ENGINE+"spatial-icon.json","spatial-raw"],
  "/weather/spatial-marine.json": [ENGINE+"spatial-marine.json","spatial-raw"]
});
const FIELDS_CLOUD=["lat","lon","cloud_top_cold_c","cloud_top_median_c","cloud_top_high_m",
 "cloud_top_median_m","cooling_c_per_20m_proxy","convective_score","convective_level"];
const FIELDS_FORECAST=["cell_id","lat","lon","valid_time","lead_hours","temperature_c",
 "u10_ms","v10_ms","wind_kmh","wind_direction_deg","gust_kmh","rain_mm","wave_hs_m",
 "wave_direction_deg","wave_period_s"];
const jsonResponse=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
 status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}
});
const parsedTime=s=>{const t=Date.parse(s||"");return Number.isFinite(t)?t:0};
const ageMinutes=s=>parsedTime(s)?Math.max(0,Math.round((Date.now()-parsedTime(s))/60000)):null;
function validate(value,kind){
 if(!value||typeof value!=="object")return false;
 switch(kind){
  case "critical":return Boolean(value.points?.duong_dong&&value.default_point);
  case "local":return Boolean(value.points?.duong_dong&&parsedTime(value.generated_at));
  case "ground":return Boolean(value.atmosphere?.vvpq&&parsedTime(value.generated_at));
  case "current":return Boolean(value.local_now?.points?.duong_dong&&value.groundtruth&&parsedTime(value.local_now.generated_at));
  case "compact":return Boolean(value.points?.duong_dong&&parsedTime(value.sampled_time));
  case "forecast":return Boolean(value.regions&&parsedTime(value.generated_at));
  case "cloud":return Boolean(value.spatial?.frames?.length&&parsedTime(value.sampled_time));
  case "spatial-forecast":return Boolean(value.spatial?.frames?.length&&parsedTime(value.run_time));
  case "marine":return Boolean(value.wave?.cells?.length);
  case "meta":case "dashboard":return Boolean(value.points?.duong_dong&&value.source_cycles);
  default:return !Array.isArray(value);
 }
}
function cloudRuntime(raw){
 const frames=raw.spatial.frames.slice(-6).map(f=>({
  sampled_time:f.sampled_time,
  cells:(f.cells||[]).map(cell=>Object.fromEntries(FIELDS_CLOUD.map(k=>[k,cell[k]??null])))
 }));
 return {
  status:raw.status,generated_at:raw.generated_at,sampled_time:raw.sampled_time,
  source:raw.source,source_type:raw.source_type,
  observation_resolution:raw.observation_resolution,points:raw.points||{},
  corridor_motion:raw.corridor_motion||{},
  spatial:{status:raw.spatial.status,bounds:raw.spatial.bounds,
   display_grid_deg:raw.spatial.display_grid_deg,
   sampling_method:raw.spatial.sampling_method,frames}
 };
}
function forecastRuntime(raw){
 const now=Date.now(),end=now+72*3600000;
 const frames=raw.spatial.frames
  .filter(f=>{const t=parsedTime(f.valid_time);return t>=now-4*3600000&&t<=end})
  .map(f=>({lead_hours:f.lead_hours,valid_time:f.valid_time,
   cells:(f.cells||[]).map(c=>Object.fromEntries(FIELDS_FORECAST.map(k=>[k,c[k]??null])))}));
 if(!frames.length)throw new Error("No forecast frames in current window");
 return {
  schema_version:"weather-scene-forecast-v1",product:raw.product,
  generated_at:raw.generated_at,run_time:raw.run_time,
  medium_run_time:raw.medium_run_time,source:raw.source,
  spatial:{status:"READY",requested_grid_deg:raw.spatial.requested_grid_deg,
   short_bounds:raw.spatial.short_bounds,medium_bounds:raw.spatial.medium_bounds,
   display_interpolation:raw.spatial.display_interpolation,
   short_run_time:raw.spatial.short_run_time,frames}
 };
}
function metaRuntime(raw){
 return {
  schema_version:"weather-runtime-meta-v1",generated_at:raw.generated_at,
  source_cycles:raw.source_cycles||{},sources:raw.sources||{},
  gaps:raw.gaps||[],report_status:raw.report_status
 };
}
const getCache=()=>typeof caches!=="undefined"&&caches.default?caches.default:null;
async function loadUpstream(url,kind){
 // Query bucketing bypasses GitHub raw's default multi-minute CDN caching.
 const bucket=Math.floor(Date.now()/(2*60000));
 const response=await fetch(url+(url.includes("?")?"&":"?")+"openpq_edge="+bucket,{
  headers:{accept:"application/json"},signal:AbortSignal.timeout(14000)
 });
 if(!response.ok)throw new Error("Engine source HTTP "+response.status);
 const length=Number(response.headers.get("content-length")||0);
 if(length>9500000)throw new Error("Unexpectedly large Weather source");
 const raw=await response.json();
 if(!validate(raw,kind))throw new Error("Invalid Weather source contract: "+kind);
 const value=kind==="cloud"?cloudRuntime(raw):kind==="spatial-forecast"?forecastRuntime(raw):
  kind==="meta"?metaRuntime(raw):raw;
 const sourceTime=kind==="cloud"||kind==="compact"?raw.sampled_time:
  kind==="current"?raw.local_now.generated_at:
  kind==="spatial-forecast"||kind==="spatial-raw"?raw.run_time:
  kind==="marine"?raw.wave?.sampled_time:raw.generated_at||raw.sampled_time||null;
 return {value,sourceTime,kind};
}
async function liveAsset(request,waitUntil=undefined){
 const path=new URL(request.url).pathname;
 const [url,kind]=SOURCES[path];
 const canonical=new URL(request.url);canonical.search="";
 const key=new Request(canonical.toString(),{method:"GET"});
 const cache=getCache();
 try{
  if(cache){
   const hit=await cache.match(key);
   if(hit)return new Response(hit.body,{status:hit.status,headers:{...Object.fromEntries(hit.headers),"x-openpq-weather-edge":"EDGE_CACHE"}});
  }
  const source=await loadUpstream(url,kind);
  const response=jsonResponse(source.value,200,{
   "cache-control":"public, max-age=0, must-revalidate",
   "x-openpq-weather-edge":"ENGINE_DIRECT",
   "x-openpq-weather-source-time":source.sourceTime||"",
   "x-openpq-weather-source-age-min":String(ageMinutes(source.sourceTime)??"unknown"),
   "x-openpq-weather-kind":kind,
   "x-openpq-weather-version":"cms-weather-edge-1"
  });
  if(cache){
   const forCache=response.clone();
   forCache.headers.set("cache-control","public, max-age="+CACHE_SECONDS);
   const p=cache.put(key,forCache.clone());
   if(waitUntil)waitUntil(p.catch(e=>console.warn("Weather cache put",e)));
   else await p.catch(()=>{});
   // A cached response is never returned directly with its browser cache-control.
   return response;
  }
  return response;
 }catch(error){
  console.warn("Weather live edge upstream",kind,error.message);
  return null;
 }
}
async function health(request,waitUntil){
 const targets=[
  "/weather/data/local-now.json",
  "/weather/data/nowcast-compact.json",
  "/weather/data/groundtruth.json",
  "/weather/data/weather-runtime/marine.json"
 ];
 const base=new URL(request.url);
 const results=await Promise.all(targets.map(async path=>{
  const url=new URL(path,base);
  const response=await liveAsset(new Request(url.toString()),waitUntil);
  if(!response)return {path,status:"UNAVAILABLE"};
  const at=response.headers.get("x-openpq-weather-source-time");
  const age=ageMinutes(at);
  return {path,status:age===null?"UNKNOWN":age>({[targets[0]]:45,[targets[1]]:35,[targets[2]]:60,[targets[3]]:210}[path]||60)?"STALE":"READY",
    source_time:at,age_minutes:age,via:response.headers.get("x-openpq-weather-edge")};
 }));
 return jsonResponse({
  schema_version:"openpq-weather-edge-health-v1",checked_at:new Date().toISOString(),
  status:results.every(x=>x.status==="READY")?"READY":"DEGRADED",
  engine:"JOTRIP_DATA_ENGINE",lab_website_dependency:false,cloudflare_edge:true,results
 });
}
export async function handleWeatherData(request,fallback,waitUntil){
 const path=new URL(request.url).pathname;
 if(!["GET","HEAD"].includes(request.method))return fallback();
 // The CMS snapshot builder revalidates the unchanged ECMWF cycle and writes
 // dashboard-data.json into deployed assets. Do not shadow that file with the
 // older upstream dashboard at Cloudflare's edge (the source of stale UI).
 if(path==="/weather/data/dashboard-data.json"){
  const asset=await fallback();
  const headers=new Headers(asset.headers);
  headers.set("cache-control","no-store");
  headers.set("x-openpq-weather-edge","CMS_VERIFIED_SNAPSHOT");
  return new Response(request.method==="HEAD"?null:asset.body,{status:asset.status,headers});
 }
 if(path==="/weather/data/edge-health.json")return health(request,waitUntil);
 if(!Object.prototype.hasOwnProperty.call(SOURCES,path))return fallback();
 const result=await liveAsset(request,waitUntil);
 if(result)return request.method==="HEAD"?new Response(null,{status:result.status,headers:result.headers}):result;
 const staticResponse=await fallback();
 const headers=new Headers(staticResponse.headers);
 headers.set("x-openpq-weather-edge","STATIC_FALLBACK");
 headers.set("cache-control","no-store");
 return new Response(request.method==="HEAD"?null:staticResponse.body,{status:staticResponse.status,headers});
}
export async function prewarmWeatherEdge(origin,waitUntil){
 const paths=["/weather/data/critical.json","/weather/data/local-now.json",
  "/weather/data/current-bundle.json","/weather/data/nowcast-compact.json",
  "/weather/data/weather-runtime/cloud.json","/weather/data/weather-runtime/forecast.json"];
 const results=await Promise.allSettled(paths.map(path=>liveAsset(
  new Request(new URL(path,origin)),waitUntil
 )));
 console.log("OpenPQ Weather edge prewarm",
  results.map((r,i)=>[paths[i],r.status==="fulfilled"&&r.value?.ok?"OK":"FALLBACK"]));
}
export const WEATHER_EDGE_SOURCES=Object.keys(SOURCES);
