const asJson=(payload,status=200)=>new Response(JSON.stringify(payload),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const dbFromEnv=env=>env.CMS_DB||env.OPENPQ_DB||env.ANALYTICS_DB||env.DATA_DB||env.DB||null;
export async function onRequestGet({request,env}){
 const url=new URL(request.url);
 const minutes=Math.min(1440,Math.max(1,Number(url.searchParams.get("minutes")||90)||90));
 const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||30)||30));
 const db=dbFromEnv(env);
 if(db){
  try{
   await db.prepare("CREATE TABLE IF NOT EXISTS cms_weather_field_feedback (id TEXT PRIMARY KEY,observed_at TEXT NOT NULL,observed_epoch_ms INTEGER NOT NULL,point_id TEXT NOT NULL,category TEXT NOT NULL,payload TEXT NOT NULL,received_at TEXT NOT NULL)").run();
   const results=await db.prepare("SELECT payload FROM cms_weather_field_feedback WHERE observed_epoch_ms>=? ORDER BY observed_epoch_ms DESC LIMIT ?")
    .bind(Date.now()-minutes*60000,limit).all();
   const items=(results.results||[]).map(r=>{try{return JSON.parse(r.payload)}catch{return null}}).filter(Boolean);
   return asJson({ok:true,items,count:items.length,storage:"CMS_D1"});
  }catch(e){console.error("CMS Weather D1 history failed",e);return asJson({ok:false,items:[],error:"storage_unavailable"},503)}
 }
 try{
  const response=await fetch("https://jotrip-weather-live.kenzuko.workers.dev/feedback/recent?minutes="+minutes+"&limit="+limit,{signal:AbortSignal.timeout(7000)});
  return asJson(await response.json(),response.status);
 }catch{return asJson({ok:false,items:[],error:"feedback_unavailable"},503)}
}