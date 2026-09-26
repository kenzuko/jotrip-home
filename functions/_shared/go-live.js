const WEATHER_ORIGIN="https://weather.openphuquoc.com";
const WEATHER_PATHS=Object.freeze({
  manifest:"/data/weather-runtime/manifest.json",
  compact:"/data/weather-runtime/compact.json",
  current:"/data/weather-runtime/current.json"
});
const MARINE_URL="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json";
const jsonHeaders={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const isRecord=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const CORE_POINTS=["duong_dong","an_thoi","ganh_dau"];
const MARINE_CATEGORIES=["cano","fast_boat","ferry"];

function sourceStatus(result,validate){
  if(result.status==="fulfilled")return validate(result.value);
  return ["UPSTREAM_INVALID_JSON","WEATHER_SCHEMA_INVALID"].includes(result.reason?.code)?"INVALID":"UNAVAILABLE";
}
async function readJson(fetchImpl,url){
  const response=await fetchImpl(url,{
    headers:{accept:"application/json"},
    cf:{cacheTtl:30,cacheEverything:true}
  });
  if(!response.ok)throw new Error("UPSTREAM_HTTP_"+response.status);
  try{return await response.json();}
  catch{
    const error=new Error("UPSTREAM_INVALID_JSON");
    error.code="UPSTREAM_INVALID_JSON";
    throw error;
  }
}
function validateManifest(value){
  if(!isRecord(value)||value.schema_version!=="weather-runtime-manifest-v1"||
    value.status!=="READY"||!isRecord(value.files))return false;
  return ["compact","current"].every(key=>value.files[key]===WEATHER_PATHS[key]);
}
function weatherStatus(value){
  if(!isRecord(value)||!isRecord(value.points)||
    typeof value.generated_at!=="string"||typeof value.local_generated_at!=="string")return "INVALID";
  const present=CORE_POINTS.filter(key=>isRecord(value.points[key])&&isRecord(value.points[key].nowcast)).length;
  return present===CORE_POINTS.length?"OK":present?"PARTIAL":"INVALID";
}
function marineStatus(value){
  if(!isRecord(value)||!isRecord(value.categories)||typeof value.source_date!=="string"||
    !(typeof value.collected_at_vn==="string"||typeof value.generated_at==="string"))return "INVALID";
  const present=MARINE_CATEGORIES.filter(key=>isRecord(value.categories[key])).length;
  return present===MARINE_CATEGORIES.length?"OK":present?"PARTIAL":"INVALID";
}
function normalizeWeatherRuntime(compact,current,manifest){
  if(!isRecord(compact)||compact.schema_version!=="weather-nowcast-compact-v1"||
    !isRecord(compact.points)||typeof compact.sampled_time!=="string"||
    !isRecord(current)||current.schema_version!=="weather-current-v3"||
    !isRecord(current.local_now)||!isRecord(current.local_now.points))return null;
  const points={};
  for(const key of CORE_POINTS){
    const nowcast=compact.points[key],estimate=current.local_now.points[key];
    if(!isRecord(nowcast)||!isRecord(estimate))continue;
    const rain=estimate.rain?.rain_rate_mm_h;
    points[key]={
      name:estimate.name||key,
      local:{
        available:typeof rain==="number"&&Number.isFinite(rain),
        rain_rate_mm_h:typeof rain==="number"&&Number.isFinite(rain)?rain:null,
        rain_class:estimate.rain?.data_class||"UNKNOWN"
      },
      nowcast:{
        status:compact.status==="POINT_NUMERIC_READY"?"POINT_NUMERIC_READY":"UNAVAILABLE",
        sampled_time:compact.sampled_time,
        convective_level:nowcast.level||"UNKNOWN",
        lightning_observed:compact.lightning_observed?.status||"UNKNOWN"
      }
    };
  }
  const stations=current.groundtruth?.rainfall?.stations;
  const rain_gauges=isRecord(stations)?Object.values(stations).map(station=>({
    name:station.station_name,
    lat:station.lat,
    lon:station.lon,
    observed_at:station.observed_at,
    qc:station.qc,
    increment_qc:station.increment_qc,
    rain_observed:station.rain_observed,
    rain_intensity_mm_h:station.rain_intensity_mm_h
  })):[];

  return {
    schema_version:"openpq-go-weather-signal-v1",
    generated_at:current.local_now.generated_at,
    local_generated_at:current.local_now.generated_at,
    timestamps:{
      estimate_generated_at:current.local_now.generated_at,
      nowcast_sampled_at:compact.sampled_time,
      model_run:manifest.source_times?.forecast_run_time||null,
      valid_at:current.local_now.points.duong_dong?.rain?.ensemble_context?.valid_time||null
    },
    points,
    actual:{rain_gauges}
  };
}
async function readWeatherRuntime(fetchImpl){
  const manifest=await readJson(fetchImpl,WEATHER_ORIGIN+WEATHER_PATHS.manifest);
  if(!validateManifest(manifest)){
    const error=new Error("WEATHER_MANIFEST_INVALID");
    error.code="WEATHER_SCHEMA_INVALID";
    throw error;
  }
  const [compact,current]=await Promise.all([
    readJson(fetchImpl,WEATHER_ORIGIN+manifest.files.compact),
    readJson(fetchImpl,WEATHER_ORIGIN+manifest.files.current)
  ]);
  const normalized=normalizeWeatherRuntime(compact,current,manifest);
  if(!normalized){
    const error=new Error("WEATHER_RUNTIME_SCHEMA_INVALID");
    error.code="WEATHER_SCHEMA_INVALID";
    throw error;
  }
  return normalized;
}
async function readMarineOps(fetchImpl){
  return readJson(fetchImpl,MARINE_URL);
}

export async function handleGoLive(request,fetchImpl=fetch){
  if(request.method!=="GET"){
    return new Response(JSON.stringify({error:"METHOD_NOT_ALLOWED"}),{
      status:405,headers:{...jsonHeaders,allow:"GET"}
    });
  }
  const [weatherResult,marineResult]=await Promise.allSettled([
    readWeatherRuntime(fetchImpl),readMarineOps(fetchImpl)
  ]);
  const weather=weatherResult.status==="fulfilled"?weatherResult.value:null;
  const marine=marineResult.status==="fulfilled"?marineResult.value:null;
  const source_status={
    weather:sourceStatus(weatherResult,value=>weatherStatus(value)),
    marine:sourceStatus(marineResult,marineStatus)
  };
  return new Response(JSON.stringify({
    schema_version:"openpq-go-live-v1",
    checked_at:new Date().toISOString(),
    weather,marine,source_status
  }),{status:200,headers:jsonHeaders});
}
