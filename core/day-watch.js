(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  else root.OpenPQDayWatch=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  const SUNSET_WEATHER_REASONS=new Set([
    "observed_weather","observed_rain","forecast_rain",
    "satellite_convection","cloud_approaching","low_visibility"
  ]);
  const LEVEL_RANK={info:1,watch:2,alert:3};

  function select(candidates,options={}){
    const maxItems=Math.max(0,Math.min(2,Number(options.maxItems)||2));
    if(!maxItems) return [];
    const sunset=options.sunsetWeather||{};
    const sunsetAlreadyCarriesWeather=
      ["watch","bad"].includes(String(sunset.level||"").toLowerCase())&&
      SUNSET_WEATHER_REASONS.has(String(sunset.reason||""));

    const rows=(Array.isArray(candidates)?candidates:[])
      .filter(x=>x&&typeof x.text==="string"&&x.text.trim())
      .filter(x=>x.day_watch!==false)
      .filter(x=>Number(x.priority)>=80)
      .filter(x=>!(x.kind==="weather"&&x.overlaps_sunset!==false&&sunsetAlreadyCarriesWeather))
      .sort((a,b)=>
        Number(b.priority||0)-Number(a.priority||0)||
        (LEVEL_RANK[String(b.level||"").toLowerCase()]||0)-(LEVEL_RANK[String(a.level||"").toLowerCase()]||0));

    const seen=new Set();
    const out=[];
    for(const row of rows){
      const key=String(row.dedupe_key||row.kind||row.label||row.text).toLowerCase();
      if(seen.has(key)) continue;
      seen.add(key);
      out.push({
        kind:row.kind||"notice",
        level:row.level||"watch",
        text:row.text.trim(),
        href:row.href||null
      });
      if(out.length>=maxItems) break;
    }
    return out;
  }

  return {select};
});
