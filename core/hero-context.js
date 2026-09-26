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
    if(now<5*60+30||now>sunset+30)return "night";
    if(now<10*60+30)return "morning";
    if(now>=sunset-95)return "sunset";
    return "day";
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
    if(wet&&intense)return {mood:time==="night"?"rainy-night":"rainy",timeMood:time,weatherUsed:true};
    if(intense||(wet&&signals?.sunset_weather?.level==="bad"&&time==="sunset"))
      return {mood:time==="night"?"rainy-night":"cloudy",timeMood:time,weatherUsed:true};
    // A marine sample is specific to An Thoi; use it only to avoid promoting
    // a sea-tour photograph as the leading scene, never as a whole-island warning.
    const sea=snapshot?.live_status?.sea;
    const wave=Number.parseFloat(String(sea?.primary||""));
    if(time==="day"&&sea?.freshness==="fresh"&&Number.isFinite(wave)&&wave>=1.7)
      return {mood:"cloudy",timeMood:time,weatherUsed:true};
    return {mood:time,timeMood:time,weatherUsed:false};
  }
  root.OpenPQHeroContext={select,timeMood,localMinutes};
})(typeof window!=="undefined"?window:globalThis);
