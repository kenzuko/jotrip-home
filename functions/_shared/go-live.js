const SOURCES=Object.freeze({
  weather:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/gh-pages/weather/data/critical.json",
  marine:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json"
});
const jsonHeaders={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const isRecord=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const CORE_POINTS=["duong_dong","an_thoi","ganh_dau"];
const MARINE_CATEGORIES=["cano","fast_boat","ferry"];

function weatherStatus(value){
  if(!isRecord(value)||!isRecord(value.points)||
    !(typeof value.generated_at==="string"||typeof value.local_generated_at==="string"))return "INVALID";
  const present=CORE_POINTS.filter(key=>isRecord(value.points[key])).length;
  return present===CORE_POINTS.length?"OK":present?"PARTIAL":"INVALID";
}
function marineStatus(value){
  if(!isRecord(value)||!isRecord(value.categories)||typeof value.source_date!=="string"||
    !(typeof value.collected_at_vn==="string"||typeof value.generated_at==="string"))return "INVALID";
  const present=MARINE_CATEGORIES.filter(key=>isRecord(value.categories[key])).length;
  return present===MARINE_CATEGORIES.length?"OK":present?"PARTIAL":"INVALID";
}
function sourceStatus(result,validate){
  if(result.status==="fulfilled")return validate(result.value);
  return result.reason?.code==="UPSTREAM_INVALID_JSON"?"INVALID":"UNAVAILABLE";
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

export async function handleGoLive(request,fetchImpl=fetch){
  if(request.method!=="GET"){
    return new Response(JSON.stringify({error:"METHOD_NOT_ALLOWED"}),{
      status:405,headers:{...jsonHeaders,allow:"GET"}
    });
  }
  const [weatherResult,marineResult]=await Promise.allSettled([
    readJson(fetchImpl,SOURCES.weather),readJson(fetchImpl,SOURCES.marine)
  ]);
  const weather=weatherResult.status==="fulfilled"?weatherResult.value:null;
  const marine=marineResult.status==="fulfilled"?marineResult.value:null;
  const source_status={
    weather:sourceStatus(weatherResult,weatherStatus),
    marine:sourceStatus(marineResult,marineStatus)
  };
  return new Response(JSON.stringify({
    schema_version:"openpq-go-live-v1",
    checked_at:new Date().toISOString(),
    weather,marine,source_status
  }),{status:200,headers:jsonHeaders});
}
