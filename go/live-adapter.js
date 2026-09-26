/* GO consumes existing JoTrip Lab outputs through the same evidence rules as homepage.
   No inference from canoe permits to fishing charters or from Dương Đông to An Thới. */
(function(root){
 "use strict";
 const SIGNALS=root.OpenPQDecisionSignals;
 const SOURCES={
   weather:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/gh-pages/weather/data/critical.json",
   marine:"https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json"
 };
 const abortable=async(url,ms)=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);
   try{
     const r=await fetch(url+(url.includes("?")?"&":"?")+"v="+Math.floor(Date.now()/60000),
       {cache:"no-store",signal:controller.signal});
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
   const [w,m]=await Promise.allSettled([abortable(SOURCES.weather,6500),abortable(SOURCES.marine,6500)]);
   const weather=w.status==="fulfilled"?w.value:null,marine=m.status==="fulfilled"?m.value:null;
   const weatherByZone=Object.fromEntries(["zone_central_west","zone_south","zone_north"]
     .map(zone=>[zone,weatherState(weather,zone,now)]));
   return {
     weather:weatherByZone[originZone]||fallbackWeather(),
     weather_by_zone:weatherByZone,
     cano:marineState(marine,"cano",now),
     fast_boat:marineState(marine,"fast_boat",now),
     ferry:marineState(marine,"ferry",now),
     // marine_ops currently reports cano / commercial ferry / fast-boat categories,
     // not individually confirmed fishing charter departures.
     charter_boat:marineState(marine,"charter_boat",now),
     marine_route:{},
     health:{weather:w.status,marine:m.status},
     sources:{weather:"/weather/",marine:"/cano/",charter_boat:null}
   };
 }
 root.OpenPQGoLive={load,weatherState,marineState};
})(window);