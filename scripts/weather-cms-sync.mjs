// CMS Weather snapshot builder. No request is made to weather.openphuquoc.com
// or to the Jotrip-Weather Lab repository. The upstream here is the separately
// running JoTrip data engine. CMS owns this adapter, its saved snapshots and UI.
import {readFile,writeFile,mkdir,mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,dirname,resolve} from "node:path";
import {execFileSync} from "node:child_process";
const BASE="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/";
const ENGINE=BASE+"feat/weather-lab-data-engine-v1/weather/";
const LIVE=BASE+"data-weather/data/";
const ROOT=resolve("weather");
const DATA=join(ROOT,"data");
const PY=resolve("scripts/weather-engine");
const args=new Set(process.argv.slice(2));
const STRICT=args.has("--strict");
const warnings=[];
const out=new Map();
const json=(p)=>JSON.parse(p);
const stamp=(value)=>{const n=Date.parse(value||"");return Number.isFinite(n)?n:0};
const age=(value)=>stamp(value)?Math.max(0,(Date.now()-stamp(value))/60000):Infinity;
const date=(value)=>new Date(value).toISOString();
const now=new Date();
const dst=(relative)=>join(ROOT,relative);
async function old(relative){try{return json(await readFile(dst(relative),"utf8"))}catch{return null}}
async function remote(url,optional=false){
 let err;
 for(let n=0;n<3;n++){
  try{
   const response=await fetch(url+(url.includes("?")?"&":"?")+"t="+Date.now(),{
    headers:{accept:"application/json"},signal:AbortSignal.timeout(45000),cache:"no-store"
   });
   if(!response.ok)throw Error("HTTP "+response.status+" "+url);
   const body=await response.text();
   const value=json(body);
   if(!value||typeof value!=="object")throw Error("Invalid JSON object "+url);
   return value;
  }catch(error){err=error;if(n<2)await new Promise(r=>setTimeout(r,500*(n+1)))}
 }
 if(optional){warnings.push("source_unavailable:"+url.split("/").slice(-2).join("/")+" "+err.message);return null}
 throw err;
}
function runPython(module,parameters){
 const env={...process.env,PYTHONPATH:PY+(process.env.PYTHONPATH?":"+process.env.PYTHONPATH:"")};
 execFileSync("python",["-m",module,...parameters],{env,encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:240000});
}
async function writeTmp(tmp,name,payload){
 const p=join(tmp,name);
 await mkdir(dirname(p),{recursive:true});
 await writeFile(p,JSON.stringify(payload)+"\n");
 return p;
}
function schedule(relative,value){out.set(relative,JSON.stringify(value)+"\n")}
function numeric(value){return typeof value==="number"&&Number.isFinite(value)}
function modelHours(dashboard){
 const result={};
 for(const [point,p] of Object.entries(dashboard.points||{})){
  const rows=(p.hours||[]).filter(r=>{
   const t=stamp(r.time_iso);
   return t>=Date.now()-15*60000&&t<=Date.now()+72*3600000;
  }).map(r=>({
   time:r.time_iso,temperature_c:r.temperature??null,wind_kmh:r.wind??null,
   gust_kmh:r.gust??null,rain_3h_mm:r.rain??null,
   wave_hs_m:r.wave??null,wave_hmax_m:r.wave_max??null,period_s:r.period??null,
   data_class:"MODEL_ONLY",reference_mode:"DIRECT_MARINE_SERIES",reference_point:point,
   reference_distance_km:0
  })).filter(r=>r.time&&numeric(r.wind_kmh)&&numeric(r.gust_kmh)&&numeric(r.wave_hs_m));
  if(rows.length)result[point]=rows;
 }
 return result;
}
function currentBundle(local,ground,compact,dashboard,previous){
 const day=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const prior=previous?.today_series?.date===day?(previous.today_series.points||{}):{};
 const series={};
 for(const [point,p] of Object.entries(local.points||{})){
  const priorRows=Array.isArray(prior[point])?prior[point]:[];
  const current={
   time:local.generated_at,temperature_c:p.temperature_c??null,
   wind_kmh:p.wind_kmh??null,rain_rate_mm_h:p.rain?.rain_rate_mm_h??null,
   wave_hs_m:p.wave_hs_m??null,convective_score:p.rain?.convective_score??null,
   data_class:"ESTIMATED_NOW"
  };
  const byBucket=new Map();
  for(const row of [...priorRows,current]){
   const t=stamp(row.time);if(!t)continue;
   const bucket=Math.floor(t/(30*60000));
   if(!byBucket.has(bucket)||stamp(byBucket.get(bucket).time)<t)byBucket.set(bucket,row);
  }
  series[point]=[...byBucket.entries()].sort((a,b)=>a[0]-b[0]).map(x=>x[1]).slice(-48);
 }
 const v=ground.atmosphere?.vvpq;
 const previousActual=previous?.today_series?.date===day?previous.today_series?.actual?.vvpq||[]:[];
 const actual=[...previousActual];
 if(v?.data_class==="ACTUAL"&&v.observed_at)actual.push({time:v.observed_at,wind_kmh:v.wind_speed_kmh,
   temperature_c:v.temperature_c,data_class:"ACTUAL",source:"VVPQ"});
 const seen=new Map(actual.filter(x=>stamp(x.time)).map(x=>[x.time,x]));
 const model=modelHours(dashboard);
 // Keep the last validated hourly marine series when a new model run is incomplete.
 const oldModel=previous?.model_72h?.points||{};
 for(const [point,rows] of Object.entries(oldModel)){
  if(!model[point]&&Array.isArray(rows))model[point]=rows.filter(r=>stamp(r.time)>=Date.now()-15*60000);
 }
 return {
  schema_version:"weather-current-v3",generated_at:local.generated_at,groundtruth:ground,
  local_now:local,nowcast:compact,
  today_series:{date:day,cadence_minutes:30,points:series,actual:{vvpq:[...seen.values()].slice(-70)}},
  model_72h:{
   points:model,references:previous?.model_72h?.references||{},
   note:"CMS-owned series from current model. Wind, gust, rain and Hs are MODEL_ONLY, not actual measurements."
  }
 };
}
function cloudScene(full,previous){
 if(!full?.spatial?.frames?.length)return previous||null;
 const keep=["lat","lon","cloud_top_cold_c","cloud_top_median_c","cloud_top_high_m","cloud_top_median_m","cooling_c_per_20m_proxy","convective_score","convective_level"];
 return {
  status:full.status,generated_at:full.generated_at,sampled_time:full.sampled_time,
  source:full.source,source_type:full.source_type,observation_resolution:full.observation_resolution,
  points:full.points||{},corridor_motion:full.corridor_motion||{},
  spatial:{
   status:full.spatial.status,bounds:full.spatial.bounds,display_grid_deg:full.spatial.display_grid_deg,
   sampling_method:full.spatial.sampling_method,frames:full.spatial.frames.slice(-6).map(f=>({
    sampled_time:f.sampled_time,cells:(f.cells||[]).map(c=>Object.fromEntries(keep.map(k=>[k,c[k]??null])))
   }))
  }
 };
}
function forecastScene(ecmwf,previous){
 if(!ecmwf?.spatial?.frames?.length)return previous||null;
 const fields=["cell_id","lat","lon","valid_time","lead_hours","temperature_c","u10_ms","v10_ms","wind_kmh","wind_direction_deg","gust_kmh","rain_mm","wave_hs_m","wave_direction_deg","wave_period_s"];
 const frames=ecmwf.spatial.frames.filter(f=>{
  const t=stamp(f.valid_time);return t>=Date.now()-4*3600000&&t<=Date.now()+72*3600000;
 }).map(f=>({lead_hours:f.lead_hours,valid_time:f.valid_time,cells:(f.cells||[]).map(c=>
  Object.fromEntries(fields.map(k=>[k,c[k]??null]))
 )}));
 return {
  schema_version:"weather-scene-forecast-v1",product:ecmwf.product,
  generated_at:ecmwf.generated_at,run_time:ecmwf.run_time,
  medium_run_time:ecmwf.medium_run_time,source:ecmwf.source,
  spatial:{
   status:frames.length?"READY":"UNAVAILABLE",requested_grid_deg:ecmwf.spatial.requested_grid_deg,
   short_bounds:ecmwf.spatial.short_bounds,medium_bounds:ecmwf.spatial.medium_bounds,
   display_interpolation:ecmwf.spatial.display_interpolation,short_run_time:ecmwf.spatial.short_run_time,
   frames
  }
 };
}
function assertCore(d){
 if(!d.dashboard?.points||!Object.keys(d.dashboard.points).length)throw Error("No valid forecast dashboard");
 if(!d.ground?.atmosphere||!d.local?.points||!d.compact?.sampled_time)throw Error("Ground, local or satellite compact contract missing");
 for(const [p,rows] of Object.entries(d.bundle.model_72h.points||{})){
  for(const r of rows){
   if(!r.time||r.data_class!=="MODEL_ONLY")throw Error(p+" hourly model has invalid provenance");
   for(const field of ["wind_kmh","gust_kmh","rain_3h_mm","wave_hs_m"]){
    if(r[field]==null)throw Error(p+" missing "+field+" at "+r.time);
   }
  }
 }
}
async function main(){
 const tmp=await mkdtemp(join(tmpdir(),"openpq-weather-"));
 // Dedicated production data engine, not the disposable Weather Lab website.
 const spec=[
  ["dashboard",ENGINE+"dashboard-data.json"],["tide",ENGINE+"tide.json"],
  ["ecmwf",ENGINE+"spatial-ecmwf.json"],["icon",ENGINE+"spatial-icon.json"],
  ["marine",ENGINE+"spatial-marine.json"],["ground",LIVE+"weather-groundtruth/latest.json"],
  ["remoteLocal",LIVE+"weather-groundtruth/local-now.json"],
  ["compact",LIVE+"weather-nowcast/compact-latest.json"],
  ["fullCloud",LIVE+"weather-nowcast/latest.json"],
  ["aqi",LIVE+"weather-aqi/latest.json"],
  ["ensemble",LIVE+"weather-ensemble/latest.json"],
  ["gefsSpatial",LIVE+"weather-ensemble/spatial.json"],
  ["previousBundle",LIVE+"weather-current/latest.json"]
 ];
 const d={};
 for(let i=0;i<spec.length;i+=4){
  const chunk=await Promise.all(spec.slice(i,i+4).map(async([name,url])=>[name,await remote(url,true)]));
  for(const [name,payload] of chunk)d[name]=payload;
 }
 const fallback={
  dashboard:"data/dashboard-data.json",tide:"data/tide.json",
  ecmwf:"spatial-ecmwf.json",icon:"spatial-icon.json",marine:"spatial-marine.json",
  ground:"data/groundtruth.json",remoteLocal:"data/local-now.json",
  compact:"data/nowcast-compact.json",aqi:"data/air-quality.json",
  gefsSpatial:"data/weather-ensemble/spatial.json",previousBundle:"data/current-bundle.json",
  fullCloud:"data/weather-runtime/cloud.json"
 };
 for(const [name,path] of Object.entries(fallback)){
  if(!d[name])d[name]=await old(path);
 }
 if(!d.dashboard?.points||!d.tide||!d.compact||!d.marine){
  throw Error("Missing mandatory data; refusing to overwrite deployed CMS weather assets");
 }
 // CMS-owned ground truth collection: METAR VVPQ and VRain, no site-Lab dependency.
 const groundPath=await writeTmp(tmp,"ground.json",d.ground||{});
 try{
  runPython("weather.collectors.phuquoc_ground_truth",["--output",groundPath,
    "--previous",dst("data/groundtruth.json")]);
  const observed=json(await readFile(groundPath,"utf8"));
  if(observed.status==="READY"&&observed.atmosphere?.vvpq?.qc==="PASS")d.ground=observed;
  else warnings.push("CMS local observation collector returned "+observed.status);
 }catch(e){warnings.push("CMS direct ground truth fallback: "+e.message)}
 if(!d.ground?.atmosphere)throw Error("No verified ground truth available");
 const full=d.fullCloud?.spatial?.frames?.length?d.fullCloud:null;
 if(!full||age(full.sampled_time)>55){
  try{
   const p=join(tmp,"independent-nowcast.json");
   runPython("weather.collectors.himawari_nowcast",["--output",p]);
   const ownCloud=json(await readFile(p,"utf8"));
   if(ownCloud.status==="POINT_NUMERIC_READY"&&stamp(ownCloud.sampled_time)>stamp(full?.sampled_time))
     d.fullCloud=ownCloud;
  }catch(e){warnings.push("CMS direct satellite collector fallback: "+e.message)}
 }
 const fullNow=d.fullCloud?.spatial?.frames?.length?d.fullCloud:null;
 if(fullNow?.sampled_time&&(!d.compact||stamp(fullNow.sampled_time)>stamp(d.compact.sampled_time))){
  // A direct NOAA/JMA sample may be newer than the public data engine's compact.
  const compactOld=d.compact||{};
  d.compact={...compactOld,source:fullNow.source,sampled_time:fullNow.sampled_time,
   generated_at:fullNow.generated_at,status:fullNow.status,points:fullNow.points||compactOld.points,
   corridor_motion:fullNow.corridor_motion||compactOld.corridor_motion};
 }
 // A model cycle remains scientifically valid after the upstream dashboard's
 // 2.5-hour publication TTL. When the upstream scheduler is delayed, revalidate
 // its unchanged numbers against the actual ECMWF spatial source and future
 // timestamps. Never change source_cycles or invent a newer model run.
 const dashboardAge=age(d.dashboard?.generated_at);
 const ecmwfAge=age(d.dashboard?.source_cycles?.ECMWF);
 const spatialCycle=d.ecmwf?.run_time;
 const sameModel=spatialCycle&&stamp(spatialCycle)===stamp(d.dashboard?.source_cycles?.ECMWF);
 const allFuture=Object.values(d.dashboard?.points||{}).length>=8&&
  Object.values(d.dashboard.points).every(p=>(p.hours||[]).filter(r=>
   stamp(r.time_iso)>Date.now()+15*60000&&stamp(r.time_iso)<Date.now()+24*3600000&&
   numeric(r.wind)&&numeric(r.gust)&&numeric(r.rain)&&numeric(r.wave)).length>=2);
 if(dashboardAge>150&&dashboardAge<720&&ecmwfAge<24*60&&sameModel&&allFuture){
  const original=d.dashboard.source_snapshot_generated_at||d.dashboard.generated_at;
  d.dashboard={...d.dashboard,source_snapshot_generated_at:original,
   generated_at:now.toISOString(),revalidation_status:"REVALIDATED_UNCHANGED_MODEL",
   revalidation_note:"Existing forecast values verified against matching ECMWF model cycle; no new model run claimed."};
  warnings.push("forecast_revalidated_unchanged_cycle:original="+original);
 }
 const localFile=join(tmp,"local-now.json");
 const localGround=await writeTmp(tmp,"local-ground.json",d.ground);
 const localDashboard=await writeTmp(tmp,"local-dashboard.json",d.dashboard);
 const localCloud=await writeTmp(tmp,"local-nowcast.json",fullNow||d.compact);
 const localEnsemble=await writeTmp(tmp,"local-ensemble.json",d.ensemble||{});
 try{
  runPython("weather.processing.local_now",["--groundtruth",localGround,
   "--dashboard",localDashboard,"--nowcast",localCloud,
   "--ensemble",localEnsemble,"--output",localFile]);
  d.local=json(await readFile(localFile,"utf8"));
 }catch(e){
  warnings.push("CMS local analysis fallback: "+e.message);
  d.local=d.remoteLocal;
 }
 if(!d.local?.points)throw Error("Cannot create the local weather analysis");
 d.bundle=currentBundle(d.local,d.ground,d.compact,d.dashboard,
   d.previousBundle||await old("data/current-bundle.json"));
 const criticalFile=join(tmp,"critical.json");
 try{
  runPython("weather.pipeline.build_critical_payload",["--dashboard",localDashboard,
   "--local-now",await writeTmp(tmp,"final-local.json",d.local),
   "--groundtruth",localGround,"--aqi",await writeTmp(tmp,"aqi.json",d.aqi||{}),
   "--tide",await writeTmp(tmp,"tide.json",d.tide),
   "--nowcast",localCloud,"--ensemble",localEnsemble,"--output",criticalFile]);
  d.critical=json(await readFile(criticalFile,"utf8"));
 }catch(e){warnings.push("Critical product build failure: "+e.message);d.critical=await old("data/critical.json")}
 if(!d.critical?.points)throw Error("No valid critical product");
 const forecastFile=join(tmp,"jotrip-forecast.json");
 try{
  if(!d.ensemble)throw Error("Ensemble source unavailable");
  runPython("weather.pipeline.build_jotrip_forecast",["--ensemble",localEnsemble,
   "--nowcast",await writeTmp(tmp,"final-compact.json",d.compact),"--output",forecastFile]);
  d.jotripForecast=json(await readFile(forecastFile,"utf8"));
 }catch(e){
  warnings.push("Forecast ensemble fallback: "+e.message);
  d.jotripForecast=await old("data/jotrip-forecast.json");
 }
 if(!d.jotripForecast)throw Error("No forecast product, refusing deploy");
 const prevCloud=await old("data/weather-runtime/cloud.json");
 const prevForecast=await old("data/weather-runtime/forecast.json");
 const cloud=cloudScene(fullNow,prevCloud),forecast=forecastScene(d.ecmwf,prevForecast);
 if(!cloud?.spatial?.frames?.length||!forecast?.spatial?.frames?.length)
  throw Error("Cloud or short-range spatial forecast unavailable; retain existing production");
 if(!d.marine?.wave?.cells?.length)throw Error("Missing marine grid");
 assertCore(d);
 for(const [rel,payload] of [
  ["data/critical.json",d.critical],["data/dashboard-data.json",d.dashboard],
  ["data/tide.json",d.tide],["data/air-quality.json",d.aqi||await old("data/air-quality.json")],
  ["data/groundtruth.json",d.ground],["data/local-now.json",d.local],
  ["data/current-bundle.json",d.bundle],["data/nowcast-compact.json",d.compact],
  ["data/jotrip-forecast.json",d.jotripForecast],
  ["data/weather-runtime/cloud.json",cloud],["data/weather-runtime/forecast.json",forecast],
  ["data/weather-runtime/marine.json",d.marine],["data/weather-runtime/compact.json",d.compact],
  ["data/weather-runtime/current.json",d.bundle],
  ["data/weather-runtime/meta.json",{
   schema_version:"weather-runtime-meta-v1",generated_at:d.dashboard.generated_at,
   source_cycles:d.dashboard.source_cycles||{},sources:d.dashboard.sources||{},
   gaps:d.dashboard.gaps||[],report_status:d.dashboard.report_status
  }],
  ["data/weather-ensemble/spatial.json",d.gefsSpatial],
  ["spatial-ecmwf.json",d.ecmwf],["spatial-icon.json",d.icon],
  ["spatial-marine.json",d.marine]
 ]){if(payload)schedule(rel,payload)}
 const manifest={
  schema_version:"weather-runtime-manifest-v1",generated_at:now.toISOString(),
  pipeline_version:"OPENPQ_CMS_WEATHER_V1",status:"READY",
  policy:{frontend_source:"SAME_ORIGIN_CANONICAL_ONLY",browser_fallback:"DISABLED",legacy_fallback:"DISABLED"},
  files:Object.fromEntries(["cloud","compact","current","forecast","marine","meta"].map(k=>
   [k,"/weather/data/weather-runtime/"+k+".json"])),
  source_times:{cloud_sampled_time:cloud.sampled_time,forecast_run_time:forecast.run_time,
    marine_sampled_time:d.marine.wave.sampled_time}
 };
 const runtimeAuthority={
  schema_version:"openpq-cms-weather-authority-v1",generated_at:now.toISOString(),
  dashboard_snapshot_id:d.dashboard.snapshot_id,groundtruth_generated_at:d.ground.generated_at,
  local_now_generated_at:d.local.generated_at,cloud_sampled_time:cloud.sampled_time,
  marine_sampled_time:d.marine.wave.sampled_time,forecast_run_time:forecast.run_time,
  policy:"FORECAST_MODEL_ONLY_ACTUAL_OBSERVATIONS_SEPARATE"
 };
 const health={
  generated_at:now.toISOString(),upstream:"JOTRIP_DATA_ENGINE_NOT_WEATHER_LAB_WEBSITE",
  source_status:{groundtruth_age_min:age(d.ground.generated_at),cloud_observation_age_min:age(cloud.sampled_time),
   local_now_age_min:age(d.local.generated_at),marine_sample_age_min:age(d.marine.wave.sampled_time),
   forecast_run_age_min:age(forecast.run_time)},
  warnings
 };
 if(STRICT&&(age(cloud.sampled_time)>60||age(d.local.generated_at)>45))
  throw Error("Strict freshness failed: "+JSON.stringify(health.source_status));
 schedule("data/weather-runtime/manifest.json",manifest);
 schedule("data/runtime-authority.json",runtimeAuthority);
 schedule("data/weather-health.json",health);
 out.set("weather-live-config.js",
  "// CMS-owned Weather bootstrap. No disposable Lab host.\n"+
  "window.JOTRIP_WEATHER_LIVE_API_URL = '/api/weather/live';\n"+
  "window.JOTRIP_WEATHER_BOOTSTRAP = "+JSON.stringify(d.dashboard)+";\n");
 // History is mirrored as durable CMS files, never browser-fetched from Lab.
 const catalog=await remote(LIVE+"weather-nowcast/catalog.json",true);
 if(catalog?.dates?.length){
  schedule("data/history/catalog.json",catalog);
  for(const item of catalog.dates.slice(0,14)){
   const day=item.date;if(!/^\d{4}-\d\d-\d\d$/.test(day))continue;
   const summary=await remote(LIVE+"weather-nowcast/summary/"+day+".json",true);
   if(summary)schedule("data/history/summary/"+day+".json",summary);
   try{
    const url=LIVE+"weather-nowcast/history/"+day+"/events.jsonl?t="+Date.now();
    const response=await fetch(url,{signal:AbortSignal.timeout(16000)});
    if(response.ok)out.set("data/history/history/"+day+"/events.jsonl",await response.text());
   }catch(e){warnings.push("historical-events:"+day)}
  }
 }
 // Write only after all required source, provenance and shape checks pass.
 for(const [rel,body] of out){
  const file=dst(rel);await mkdir(dirname(file),{recursive:true});await writeFile(file,body);
 }
 console.log(JSON.stringify({result:"CMS_WEATHER_REFRESH_READY",generated_at:manifest.generated_at,
  source_times:manifest.source_times,files_written:out.size,health,upstream_lab_site_requests:0}));
}
main().catch(e=>{console.error("CMS Weather sync aborted, existing snapshot preserved:",e.stack||String(e));process.exitCode=1});