/* Contextual editorial hero. Uses the HOME snapshot only; never fetches weather twice. */
(function(root){
  "use strict";
  const TZ="Asia/Ho_Chi_Minh";
  const mins=value=>{
    const m=/^(\d{1,2}):(\d{2})$/.exec(String(value||""));
    return m&&+m[1]<24&&+m[2]<60 ? +m[1]*60 + +m[2] : null;
  };
  function localMinutes(date=new Date()){
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
    const n=name=>Number(parts.find(p=>p.type===name)?.value||0);
    return n("hour")*60+n("minute");
  }
  function timeMood(date=new Date(),snapshot=null){
    const now=localMinutes(date);
    const sunset=mins(snapshot?.live_status?.sunset?.primary)??(18*60);
    if(now<5*60+30||now>=sunset+30)return "night";
    if(now<10*60+30)return "morning";
    if(now>=sunset-95)return "sunset";
    if(now<14*60)return "noon";
    return "afternoon";
  }
  // Two separate, recently checked island gauges must independently observe
  // substantial rain. Convection forecasts, isolated drizzle and stale totals
  // are insufficient to turn the whole-island hero into a rainy slideshow.
  function assessHeavyRain(gauges,snapshotAgeMin,now=new Date()){
    if(!Array.isArray(gauges)||!Number.isFinite(snapshotAgeMin)||snapshotAgeMin<0||snapshotAgeMin>60)
      return {confirmed:false,count:0};
    const stations=new Set();
    const nowMs=+now;
    for(const g of gauges){
      if(String(g?.qc||'').toUpperCase()!=='PASS'||
         String(g?.increment_qc||'').toUpperCase()!=='PASS'||
         g?.rain_observed!==true||Number(g?.rain_intensity_mm_h)<10)continue;
      const observedMs=Date.parse(g?.observed_at||'');
      const elapsed=(nowMs-observedMs)/60000;
      if(!Number.isFinite(elapsed)||elapsed<0||elapsed>45)continue;
      const key=String(g?.name||'').trim().toLowerCase();
      if(key)stations.add(key);
    }
    return {confirmed:stations.size>=2,count:stations.size};
  }
  function select(date=new Date(),snapshot=null){
    const time=timeMood(date,snapshot);
    const signals=snapshot?.signals;
    const age=signals?.weather_snapshot_age_min;
    const fresh=Number.isFinite(age)&&age>=0&&age<=90;
    if(!fresh)return {mood:time,timeMood:time,weatherUsed:false};
    const levels=Array.isArray(signals?.convective_levels)?signals.convective_levels.map(v=>String(v).toUpperCase()):[];
    const intense=levels.includes("HIGH")||levels.includes("ELEVATED");
    // An isolated shower somewhere on the island does not imply island-wide rain.
    const wet=signals?.observed_rain===true;
    // Only a confirmed multi-station heavy rain observation changes the
    // gallery into rainy pictures. Uncertainty gets a beautiful neutral set.
    if(signals?.heavy_rain_confirmed===true)
      return {mood:time==="night"?"rainy-night":"rainy",timeMood:time,weatherUsed:true};
    if(intense||signals?.heavy_rain_gauge_count===1||
       (wet&&signals?.sunset_weather?.level==="bad"&&time==="sunset"))
      return {mood:time==="night"?"cloudy-night":"cloudy",timeMood:time,weatherUsed:true};
    // A marine sample is specific to An Thoi; use it only to avoid promoting
    // a sea-tour photograph as the leading scene, never as a whole-island warning.
    const sea=snapshot?.live_status?.sea;
    const wave=Number.parseFloat(String(sea?.primary||""));
    if((time==="noon"||time==="afternoon")&&sea?.freshness==="fresh"&&Number.isFinite(wave)&&wave>=1.7)
      return {mood:"cloudy",timeMood:time,weatherUsed:true};
    return {mood:time,timeMood:time,weatherUsed:false};
  }
  root.OpenPQHeroContext={select,timeMood,localMinutes,assessHeavyRain};
})(typeof window!=="undefined"?window:globalThis);
