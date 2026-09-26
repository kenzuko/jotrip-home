const WEATHER_ORIGIN="https://weather.openphuquoc.com";
const MANIFEST_PATH="/data/weather-runtime/manifest.json";
const FORECAST_PATH="/data/weather-runtime/forecast.json";
const MAX_BODY_BYTES=24000;
const MAX_ITEMS=20;
const MAX_WINDOW_MS=24*60*60*1000;
const MAX_FORECAST_BYTES=10_000_000;
const VALUE_FIELDS=[
  "temperature_c","u10_ms","v10_ms","wind_kmh","wind_direction_deg",
  "gust_kmh","rain_mm","wave_hs_m","wave_direction_deg","wave_period_s"
];
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
const explicitTime=s=>typeof s==="string"&&/(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const iso=t=>new Date(t).toISOString();
async function readTextLimited(stream,maxBytes,tooLargeError){
  if(!stream)return "";
  const reader=stream.getReader(),chunks=[];
  let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes){
        await reader.cancel();
        throw new Error(tooLargeError);
      }
      chunks.push(value);
    }
  }finally{
    reader.releaseLock();
  }
  const bytes=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}
const clampNumber=x=>finite(x)?x:null;

function parseRequestItem(item,index){
  if(!isRecord(item)||typeof item.entity_id!=="string"||item.entity_id.length<1||item.entity_id.length>120)
    throw new Error("INVALID_ITEM_"+index);
  if(!isRecord(item.window)||!explicitTime(item.window.from)||!explicitTime(item.window.to))
    throw new Error("INVALID_WINDOW_"+index);
  const from=Date.parse(item.window.from),to=Date.parse(item.window.to);
  if(to<=from||to-from>MAX_WINDOW_MS)throw new Error("INVALID_WINDOW_RANGE_"+index);
  const scope=item.activity_scope||"outdoor";
  if(!["indoor","outdoor","marine"].includes(scope))throw new Error("INVALID_SCOPE_"+index);
  if(scope==="marine")return{
    entity_id:item.entity_id,activity_scope:scope,route_id:typeof item.route_id==="string"?item.route_id:null,
    from,to,location:null,precision:null
  };
  const point=item.location;
  if(!isRecord(point)||!finite(point.lat)||!finite(point.lon)||point.lat < -90||point.lat > 90||point.lon < -180||point.lon > 180)
    throw new Error("INVALID_LOCATION_"+index);
  const precision=String(point.precision||"unknown");
  if(!["verified_point","site_centroid","area_anchor","user_selected","unknown"].includes(precision))
    throw new Error("INVALID_PRECISION_"+index);
  return{
    entity_id:item.entity_id,activity_scope:scope,from,to,
    location:{lat:point.lat,lon:point.lon},precision
  };
}
function validateManifest(value){
  return isRecord(value)&&value.schema_version==="weather-runtime-manifest-v1"&&
    value.status==="READY"&&isRecord(value.files)&&value.files.forecast===FORECAST_PATH;
}
function validateForecast(value){
  return isRecord(value)&&value.schema_version==="weather-scene-forecast-v1"&&
    explicitTime(value.generated_at)&&explicitTime(value.run_time)&&
    isRecord(value.spatial)&&value.spatial.status==="READY"&&Array.isArray(value.spatial.frames)&&
    value.spatial.frames.length>0&&value.spatial.frames.length<=200&&
    value.spatial.frames.every(frame=>isRecord(frame)&&explicitTime(frame.valid_time)&&Array.isArray(frame.cells));
}
async function readJson(fetchImpl,url,signal){
  const response=await fetchImpl(url,{headers:{accept:"application/json"},signal});
  if(!response.ok)throw new Error("UPSTREAM_UNAVAILABLE");
  const length=Number(response.headers.get("content-length")||0);
  if(length>MAX_FORECAST_BYTES)throw new Error("UPSTREAM_INVALID_SIZE");
  let raw;
  try{raw=await readTextLimited(response.body,MAX_FORECAST_BYTES,"UPSTREAM_INVALID_SIZE")}
  catch(error){
    if(error.message==="UPSTREAM_INVALID_SIZE")throw error;
    throw new Error("UPSTREAM_INVALID_BODY");
  }
  try{return JSON.parse(raw)}catch{throw new Error("UPSTREAM_INVALID_JSON")}
}
async function readCanonicalForecast(fetchImpl){
  const signal=AbortSignal.timeout(10000);
  const manifest=await readJson(fetchImpl,WEATHER_ORIGIN+MANIFEST_PATH,signal);
  if(!validateManifest(manifest))throw new Error("UPSTREAM_INVALID_MANIFEST");
  const forecast=await readJson(fetchImpl,WEATHER_ORIGIN+manifest.files.forecast,signal);
  if(!validateForecast(forecast))throw new Error("UPSTREAM_INVALID_FORECAST");
  return forecast;
}
const rad=x=>x*Math.PI/180;
function distanceKm(a,b){
  const earth=6371,lat1=rad(a.lat),lat2=rad(b.lat);
  const dLat=lat2-lat1,dLon=rad(b.lon-a.lon);
  const h=Math.max(0,Math.min(1,
    Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2));
  return earth*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function nearestCell(cells,location){
  let best=null;
  for(const cell of cells||[]){
    if(!isRecord(cell)||!finite(cell.lat)||!finite(cell.lon)||cell.lat < -90||cell.lat > 90||cell.lon < -180||cell.lon > 180)continue;
    const distance=distanceKm(location,{lat:cell.lat,lon:cell.lon});
    if(!best||distance<best.distance)best={cell,distance};
  }
  return best;
}
function cadenceHours(frames){
  const times=frames.map(f=>Date.parse(f.valid_time)).filter(Number.isFinite).sort((a,b)=>a-b);
  const gaps=[];
  for(let i=1;i<times.length;i++){
    const gap=(times[i]-times[i-1])/3600000;
    if(gap>0)gaps.push(gap);
  }
  if(!gaps.length)return null;
  const counts=new Map();
  for(const gap of gaps){const key=Number(gap.toFixed(4));counts.set(key,(counts.get(key)||0)+1);}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0][0];
}
function normalizedFrame(frame,item){
  const nearest=nearestCell(frame.cells,item.location);
  if(!nearest)return null;
  const cell=nearest.cell;
  const values=Object.fromEntries(VALUE_FIELDS.map(key=>[key,clampNumber(cell[key])]));
  return{
    valid_at:frame.valid_time,
    lead_hours:finite(frame.lead_hours)?frame.lead_hours:null,
    native_cell:{
      cell_id:typeof cell.cell_id==="string"?cell.cell_id:null,
      lat:cell.lat,lon:cell.lon,
      distance_from_target_km:Number(nearest.distance.toFixed(2))
    },
    values
  };
}
const noCoverage=(item,reason,status="UNKNOWN",coverageStatus="NO_COVERAGE")=>({
  entity_id:item.entity_id,status,reason_codes:[reason],
  target:item.location?{...item.location,precision:item.precision}:null,
  source:null,temporal_coverage:{
    requested_from:iso(item.from),requested_to:iso(item.to),
    status:coverageStatus,frame_cadence_hours:null,interpolation_applied:false
  },frames:[],spatial_scope:null,assessment:null
});
function sampleItem(forecast,item){
  if(item.activity_scope==="marine")
    return noCoverage(item,"ROUTE_SOURCE_UNSUPPORTED","UNKNOWN","NOT_EVALUATED");
  const validFrames=forecast.spatial.frames.filter(frame=>
    isRecord(frame)&&explicitTime(frame.valid_time)&&Array.isArray(frame.cells));
  const inWindow=validFrames.filter(frame=>{
    const at=Date.parse(frame.valid_time);return at>=item.from&&at<=item.to;
  });
  let selected=inWindow;
  let temporalStatus="IN_WINDOW_FRAMES";
  if(!selected.length){
    const before=validFrames.filter(f=>Date.parse(f.valid_time)<item.from)
      .sort((a,b)=>Date.parse(b.valid_time)-Date.parse(a.valid_time))[0];
    const after=validFrames.filter(f=>Date.parse(f.valid_time)>item.to)
      .sort((a,b)=>Date.parse(a.valid_time)-Date.parse(b.valid_time))[0];
    selected=before&&after?[before,after]:[];
    temporalStatus=selected.length===2?"BRACKET_ONLY":"NO_COVERAGE";
  }
  const frames=selected.map(frame=>normalizedFrame(frame,item)).filter(Boolean);
  const reasons=[];
  let status="OK";
  if(!inWindow.length){
    reasons.push(temporalStatus==="BRACKET_ONLY"?"TIME_BETWEEN_FRAMES":"NO_IN_WINDOW_FRAME");
    if(temporalStatus==="BRACKET_ONLY")status="PARTIAL";
  }
  if(selected.length&&!frames.length){reasons.push("NO_NATIVE_CELL");status="UNKNOWN";}
  else if(selected.length!==frames.length){reasons.push("FRAME_CELL_MISSING");status="PARTIAL";}
  if(!selected.length)status="UNKNOWN";
  const target={...item.location,precision:item.precision};
  return{
    entity_id:item.entity_id,status,reason_codes:reasons,target,
    source:{
      product:forecast.product||null,upstream_schema:forecast.schema_version,
      source:forecast.source||null,model_run:forecast.run_time,
      generated_at:forecast.generated_at,
      display_interpolation:forecast.spatial.display_interpolation||null
    },
    temporal_coverage:{
      requested_from:iso(item.from),requested_to:iso(item.to),
      status:temporalStatus,frame_cadence_hours:cadenceHours(selected),
      interpolation_applied:false
    },
    frames,spatial_scope:frames.length?"NATIVE_GRID_CELL":null,assessment:null
  };
}
function unavailableItem(item,reason,status){
  const result=noCoverage(item,reason,status,"NOT_EVALUATED");
  result.source_status=status;
  return result;
}
export async function handleWeatherWindow(request,fetchImpl=fetch){
  if(request.method!=="POST")return json({error:"METHOD_NOT_ALLOWED"},405,{allow:"POST"});
  const origin=request.headers.get("origin");
  if(origin&&origin!==new URL(request.url).origin)return json({error:"CROSS_ORIGIN_NOT_ALLOWED"},403);
  if(!(request.headers.get("content-type")||"").toLowerCase().includes("application/json"))
    return json({error:"JSON_REQUIRED"},415);
  const declared=Number(request.headers.get("content-length")||0);
  if(declared>MAX_BODY_BYTES)return json({error:"PAYLOAD_TOO_LARGE"},413);
  let body,raw;
  try{raw=await readTextLimited(request.body,MAX_BODY_BYTES,"PAYLOAD_TOO_LARGE")}
  catch(error){
    return error.message==="PAYLOAD_TOO_LARGE"
      ?json({error:"PAYLOAD_TOO_LARGE"},413)
      :json({error:"INVALID_JSON"},400);
  }
  try{body=JSON.parse(raw)}catch{return json({error:"INVALID_JSON"},400)}
  if(!isRecord(body)||body.schema_version!=="openpq-weather-window-request-v1"||
    !Array.isArray(body.items)||body.items.length<1||body.items.length>MAX_ITEMS)
    return json({error:"INVALID_REQUEST"},400);
  let items;
  try{items=body.items.map(parseRequestItem)}catch(error){
    return json({error:String(error.message||"INVALID_REQUEST")},400);
  }
  if(items.every(item=>item.activity_scope==="marine")){
    return json({schema_version:"openpq-weather-window-context-v1",checked_at:new Date().toISOString(),
      source_status:"PARTIAL",items:items.map(item=>sampleItem(null,item))});
  }
  let forecast;
  try{forecast=await readCanonicalForecast(fetchImpl)}catch(error){
    const reason=String(error.message||"").startsWith("UPSTREAM_INVALID")?"WEATHER_SCHEMA_INVALID":"WEATHER_UPSTREAM_UNAVAILABLE";
    const status=reason==="WEATHER_SCHEMA_INVALID"?"INVALID":"UNAVAILABLE";
    return json({schema_version:"openpq-weather-window-context-v1",checked_at:new Date().toISOString(),
      source_status:status,items:items.map(item=>item.activity_scope==="marine"
        ?sampleItem(null,item):unavailableItem(item,reason,status))});
  }
  return json({
    schema_version:"openpq-weather-window-context-v1",checked_at:new Date().toISOString(),
    source_status:items.some(item=>item.activity_scope==="marine")?"PARTIAL":"OK",
    items:items.map(item=>sampleItem(forecast,item))
  });
}
