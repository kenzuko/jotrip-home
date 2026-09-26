/* Shared decision signals for homepage and GO; derived observations are never port permits. */
(function(root,factory){
  const api=factory();
  root.OpenPQDecisionSignals=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const ZONES=Object.freeze({
    zone_central_west:"duong_dong",
    zone_south:"an_thoi",
    zone_north:"ganh_dau"
  });
  const PRIMARY=Object.freeze(Object.values(ZONES));
  function dayKey(now=new Date()){
    const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(now));
    const x=Object.fromEntries(p.map(v=>[v.type,v.value]));
    return x.year+"-"+x.month+"-"+x.day;
  }
  function ageMinutes(stamp,now=new Date()){
    if(!stamp)return Infinity;
    const t=Date.parse(stamp),n=+new Date(now);
    if(!Number.isFinite(t)||!Number.isFinite(n))return Infinity;
    const age=(n-t)/60000;
    return age>=-5?Math.max(0,age):Infinity;
  }
  function freshness(age,limit=90){
    return !Number.isFinite(age)||age>limit?"stale":age<=60?"fresh":"aging";
  }
  function pointWeather(snapshot,zone,now=new Date()){
    const key=ZONES[zone]||null,point=key?snapshot?.points?.[key]:null;
    const stamp=snapshot?.generated_at||snapshot?.local_generated_at||null;
    const snapshotAge=ageMinutes(stamp,now);
    const n=point?.nowcast||{},castStamp=n.sampled_time||null;
    const castAge=ageMinutes(castStamp,now);
    const validCast=n.status==="POINT_NUMERIC_READY"&&castAge<=90&&snapshotAge<=90;
    const level=validCast?String(n.convective_level||"").toUpperCase():"";
    const rain=point?.local?.available===true&&typeof point.local.rain_rate_mm_h==="number"&&
      Number.isFinite(point.local.rain_rate_mm_h)?point.local.rain_rate_mm_h:null;
    const validRain=snapshotAge<=90&&rain!==null;
    const severe=["HIGH","SEVERE","EXTREME"].includes(level);
    const elevated=["ELEVATED","WATCH","MODERATE"].includes(level);
    const quiet=["NONE","LOW","CLEAR","NORMAL"].includes(level);
    const status=severe?"watch":elevated||validRain&&rain>=2?"advisory":
      quiet&&validRain?"normal":"unknown";
    const trustedAt=status==="advisory"&&validRain&&rain>=2&&!severe&&!elevated?stamp:
      castStamp||stamp;
    const age=status==="advisory"&&validRain&&rain>=2&&!severe&&!elevated?snapshotAge:
      validCast?Math.max(castAge,snapshotAge):Infinity;
    return {
      status,point:key||null,point_name:point?.name||null,
      freshness:freshness(age),source_updated_at:trustedAt,
      source_class:"ESTIMATED_NOW/MODEL",rain_rate_mm_h:validRain?rain:null,
      convective_level:level||"UNKNOWN",nowcast_fresh:validCast,
      reason:!key?"UNKNOWN_ZONE":!point?"POINT_MISSING":snapshotAge>90?"SNAPSHOT_STALE":
        status==="unknown"?"POINT_SIGNAL_INCOMPLETE":status==="watch"?"HIGH_CONVECTION":
        status==="advisory"?"WEATHER_ADVISORY":"NO_POINT_ALERT",
      scope:"POINT"
    };
  }
  function rainGauges(snapshot,now=new Date()){
    return (Array.isArray(snapshot?.actual?.rain_gauges)?snapshot.actual.rain_gauges:[])
      .filter(g=>g&&g.qc!=="FAIL"&&g.increment_qc!=="FAIL"&&
        ageMinutes(g.observed_at,now)<=90);
  }
  function islandWeather(snapshot,now=new Date()){
    const points=Object.fromEntries(Object.entries(ZONES).map(([zone,key])=>
      [key,pointWeather(snapshot,zone,now)]));
    const gauges=rainGauges(snapshot,now);
    const observedRain=gauges.some(g=>g.rain_observed===true||
      typeof g.rain_intensity_mm_h==="number"&&g.rain_intensity_mm_h>0);
    const levels=Object.values(points).filter(p=>p.nowcast_fresh)
      .map(p=>p.convective_level);
    const statuses=Object.values(points).map(p=>p.status);
    const status=statuses.includes("watch")?"watch":
      statuses.includes("advisory")||observedRain?"advisory":
      statuses.every(v=>v==="normal")?"normal":"unknown";
    return {status,points,convective_levels:levels,observed_rain:observedRain,
      valid_gauges:gauges,scope:"ISLAND_SAMPLE",
      freshness:freshness(ageMinutes(snapshot?.generated_at||snapshot?.local_generated_at,now)),
      source_updated_at:snapshot?.generated_at||snapshot?.local_generated_at||null};
  }
  function sourceDay(text){
    const date=String(text||"").trim();
    const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
    return m?m[3]+"-"+m[2]+"-"+m[1]:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:null;
  }
  function marineCategory(snapshot,kind,now=new Date()){
    const cat=snapshot?.categories?.[kind],stamp=snapshot?.collected_at_vn||snapshot?.generated_at||null;
    const today=dayKey(now),age=ageMinutes(stamp,now);
    const evidence=Array.isArray(cat?.evidence)?cat.evidence:[];
    const daily=sourceDay(snapshot?.source_date);
    // Re-fetching today's file is not proof of an independent charter departure.
    const valid=!!cat&&daily===today&&age<=720&&evidence.length>0;
    return {
      state:valid?String(cat.state||"UNKNOWN").toUpperCase():"UNKNOWN",
      source_updated_at:stamp,source_date:daily,day:daily,
      freshness:valid?freshness(age,720):"stale",
      source_class:"DIRECT_OPERATIONAL",category:kind,
      evidence_count:valid?evidence.length:0,
      reason:!cat?"CATEGORY_NOT_REPORTED":daily!==today?"WRONG_DAY":
        age>720?"STALE_SOURCE":!evidence.length?"NO_DIRECT_EVIDENCE":"DIRECT_DAILY_EVIDENCE",
      scope:"ACTIVITY_CLASS",source:"JoTrip marine_ops"
    };
  }
  return {ZONES,PRIMARY,dayKey,ageMinutes,freshness,pointWeather,islandWeather,
    rainGauges,marineCategory,sourceDay};
});