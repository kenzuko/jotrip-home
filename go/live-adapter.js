/* /go reads existing normalized JoTrip Lab outputs; it does not forecast or infer port permissions. */
(function(root){
 "use strict";
 const SOURCES={
   weather:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/gh-pages/weather/data/critical.json",
   marine:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json"
 };
 const abortable=async(url,ms)=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
   try{const r=await fetch(url+(url.includes("?")?"&":"?")+"v="+Math.floor(Date.now()/60000),{cache:"no-store",signal:controller.signal});if(!r.ok)throw Error("HTTP "+r.status);return await r.json();}
   finally{clearTimeout(timer)}
 };
 const clock=()=>root.OpenPQGoEngine.clock(new Date());
 const ageMin=iso=>{const n=Date.parse(iso||"");return Number.isFinite(n)?Math.max(0,(Date.now()-n)/60000):Infinity};
 function weatherState(snapshot,zone){
   if(!snapshot)return{status:"unknown",freshness:"unknown",source_class:"MODEL",source_updated_at:null};
   const pt=snapshot.points?.[({zone_south:"an_thoi",zone_north:"ganh_dau",zone_central_west:"duong_dong"})[zone]||"duong_dong"]||{};
   const stamp=pt.nowcast?.sampled_time||snapshot.generated_at,age=ageMin(stamp);
   const recent=age<=90&&age>=0;
   const risk=String(pt.nowcast?.convective_level||"").toUpperCase();
   const rain=pt.local?.rain_rate_mm_h;
   let status="unknown";
   if(recent&&["HIGH","SEVERE","EXTREME"].includes(risk))status="watch";
   else if(recent&&typeof rain==="number"&&rain>=2)status="advisory";
   else if(recent&&pt.nowcast?.status==="POINT_NUMERIC_READY"&&risk&&risk!=="UNKNOWN")status="normal";
   return{status,freshness:!recent?"stale":age<=60?"fresh":"aging",source_class:"ESTIMATED_NOW/MODEL",source_updated_at:stamp,point:pt.name||zone,link:"/weather/",source:"JoTrip Weather"};
 }
 function marineState(snapshot){
   const today=clock().day,stamp=snapshot?.collected_at_vn||null;
   const date=snapshot?.source_date||"";
   const day=date.match(/^(\d\d)\/(\d\d)\/(\d{4})$/);
   const normalized=day?day[3]+"-"+day[2]+"-"+day[1]:date;
   if(!snapshot||normalized!==today||ageMin(stamp)>720)return{state:"UNKNOWN",freshness:"stale",source_updated_at:stamp,source:"JoTrip marine_ops"};
   return{state:snapshot.categories?.cano?.state||"UNKNOWN",freshness:"fresh",source_updated_at:stamp,source:"JoTrip marine_ops"};
 }
 async function load(zone){
   const [w,m]=await Promise.allSettled([abortable(SOURCES.weather,6500),abortable(SOURCES.marine,6500)]);
   return{
      weather:weatherState(w.status==="fulfilled"?w.value:null,zone),
      cano:marineState(m.status==="fulfilled"?m.value:null),
      health:{weather:w.status,marine:m.status},
      sources:{weather:"/weather/",marine:"/cano/"}
   };
 }
 root.OpenPQGoLive={load,weatherState,marineState};
})(window);
