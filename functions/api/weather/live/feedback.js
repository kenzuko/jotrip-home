// CMS-owned weather feedback. Uses its own D1 when bound; the legacy service
// is a compatibility bridge, never a source for weather predictions.
const asJson=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const dbFromEnv=env=>env.CMS_DB||env.OPENPQ_DB||env.ANALYTICS_DB||env.DATA_DB||env.DB||null;
const POINTS=new Set(["duong_dong","an_thoi","ganh_dau","cua_can","bai_thom","ham_ninh","bai_sao","rach_gia"]);
const CATEGORIES=new Set(["MATCH","RAIN_MORE","RAIN_LESS","WIND_MORE","WIND_LESS","THUNDER"]);
export async function onRequestPost({request,env}){
 if(Number(request.headers.get("content-length")||0)>8000)return asJson({ok:false,error:"too_large"},413);
 let body;try{body=await request.json()}catch{return asJson({ok:false,error:"invalid_json"},400)}
 const point=String(body?.point_id||""),category=String(body?.category||"").toUpperCase();
 if(!POINTS.has(point)||!CATEGORIES.has(category))return asJson({ok:false,error:"invalid_field_feedback"},400);
 const record={
  schema_version:"1.2",id:String(body?.id||crypto.randomUUID()).slice(0,128),
  observed_at:Number.isFinite(Date.parse(body?.observed_at))?body.observed_at:new Date().toISOString(),
  point_id:point,point_name:String(body?.point_name||point).slice(0,90),
  category,category_label:String(body?.category_label||category).slice(0,90),
  evidence_class:"FIELD_FEEDBACK_UNVERIFIED",accepted_as_ground_truth:false,
  estimate:body?.estimate&&typeof body.estimate==="object"?body.estimate:{},
  snapshot_id:String(body?.snapshot_id||"").slice(0,128),
  verdict:String(body?.verdict||"").slice(0,40),
  wind_relation:String(body?.wind_relation||"").slice(0,32),
  rain_relation:String(body?.rain_relation||"").slice(0,32),
  wave_relation:String(body?.wave_relation||"").slice(0,32)
 };
 const db=dbFromEnv(env);
 if(db){
  try{
   await db.prepare("CREATE TABLE IF NOT EXISTS cms_weather_field_feedback (id TEXT PRIMARY KEY,observed_at TEXT NOT NULL,observed_epoch_ms INTEGER NOT NULL,point_id TEXT NOT NULL,category TEXT NOT NULL,payload TEXT NOT NULL,received_at TEXT NOT NULL)").run();
   await db.prepare("INSERT OR IGNORE INTO cms_weather_field_feedback(id,observed_at,observed_epoch_ms,point_id,category,payload,received_at) VALUES (?,?,?,?,?,?,?)")
    .bind(record.id,record.observed_at,Date.parse(record.observed_at),record.point_id,record.category,JSON.stringify(record),new Date().toISOString()).run();
   return asJson({ok:true,id:record.id,storage:"CMS_D1"});
  }catch(e){console.error("CMS Weather D1 feedback failed",e);return asJson({ok:false,error:"storage_unavailable"},503)}
 }
 // Existing independent feedback service remains a migration bridge when no CMS D1 binding exists.
 try{
  const res=await fetch("https://jotrip-weather-live.kenzuko.workers.dev/feedback",{
   method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(record),signal:AbortSignal.timeout(7000)
  });
  const result=await res.json().catch(()=>({ok:res.ok}));
  return asJson(result,res.status);
 }catch{return asJson({ok:false,error:"feedback_unavailable",queued_locally:true},503)}
}