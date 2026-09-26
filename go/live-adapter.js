/* GO reads live evidence through the same-origin Cloudflare Worker route.
   The Worker allow-lists upstreams; this browser adapter only normalizes signals. */
(function(root){
 "use strict";
 const SIGNALS=root.OpenPQDecisionSignals;
 const ENDPOINT="/api/go/live";
 const abortable=async(url,ms)=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
   try{
     const r=await fetch(url+(url.includes("?")?"&":"?")+"t="+Math.floor(Date.now()/30000),
       {cache:"no-store",signal:controller.signal,headers:{accept:"application/json"}});
     if(!r.ok)throw Error("HTTP "+r.status);
     return await r.json();
   }finally{clearTimeout(timer);}
 };
 const fallbackWeather=()=>({status:"unknown",freshness:"unknown",source_updated_at:null,
   source_class:"ESTIMATED_NOW/MODEL",scope:"POINT",reason:"ADAPTER_UNAVAILABLE"});
 const fallbackMarine=(kind)=>({state:"UNKNOWN",freshness:"unknown",source_updated_at:null,
   source_class:"DIRECT_OPERATIONAL",category:kind,reason:"ADAPTER_UNAVAILABLE"});
 function weatherState(snapshot,zone,now=new Date()){
   const p=SIGNALS?.pointWeather?.(snapshot,zone,now)||fallbackWeather();
   return {...p,link:"/weather/",source:"JoTrip Weather"};
 }
 function marineState(snapshot,kind="cano",now=new Date()){
   return SIGNALS?.marineCategory?.(snapshot,kind,now)||fallbackMarine(kind);
 }
 async function load(originZone,now=new Date()){
   let payload=null;
   try{payload=await abortable(ENDPOINT,6500);}catch{}
   const weather=payload?.weather||null,marine=payload?.marine||null;
   const weatherByZone=Object.fromEntries(["zone_central_west","zone_south","zone_north"]
     .map(zone=>[zone,weatherState(weather,zone,now)]));
   const weatherHealth=payload?.source_status?.weather||"UNAVAILABLE";
   const marineHealth=payload?.source_status?.marine||"UNAVAILABLE";
   return {
     weather:weatherByZone[originZone]||fallbackWeather(),
     weather_by_zone:weatherByZone,
     cano:marineState(marine,"cano",now),
     fast_boat:marineState(marine,"fast_boat",now),
     ferry:marineState(marine,"ferry",now),
     // Current marine_ops does not confirm individual charter departures.
     charter_boat:marineState(marine,"charter_boat",now),
     marine_route:{},
     health:{weather:weatherHealth,marine:marineHealth,endpoint:payload?"OK":"UNAVAILABLE"},
     sources:{weather:"/weather/",marine:"/cano/",charter_boat:null,context:ENDPOINT}
   };
 }
 root.OpenPQGoLive={load,weatherState,marineState};
})(window);
