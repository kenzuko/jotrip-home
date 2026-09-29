(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  else root.OpenPQSunsetOutlook=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";

  const WEST_IDS=["duong_dong","cua_can","ganh_dau"];
  const PASSING_STATES=new Set(["PASSING_BY","MOVING_AWAY","BEYOND_HORIZON"]);

  function number(value){
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  }

  function clockMinutes(label){
    const m=String(label||"").match(/^(\d{1,2}):(\d{2})$/);
    return m?Number(m[1])*60+Number(m[2]):NaN;
  }

  function ageMinutes(iso,nowMs){
    const t=Date.parse(iso||"");
    return Number.isFinite(t)?Math.max(0,(nowMs-t)/60000):Infinity;
  }

  function vnMinutes(nowMs){
    const parts=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false
    }).formatToParts(new Date(nowMs));
    const hour=Number(parts.find(p=>p.type==="hour")?.value||0);
    const minute=Number(parts.find(p=>p.type==="minute")?.value||0);
    return hour*60+minute;
  }

  function normalizeName(value){
    return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
  }

  function refreshDelayMs(minutesToSunset){
    const remain=Number(minutesToSunset);
    if(!Number.isFinite(remain)||remain<=0) return null;
    if(remain>360) return 60*60*1000;
    if(remain>180) return 30*60*1000;
    return 10*60*1000;
  }

  function result(level,reason,extra={}){
    return {
      level,reason,
      rain_mm_max:null,rain_mm_typical:null,points:[],
      observed_rain:false,observed_convective:false,
      gauges_dry:false,gauge_count:0,
      satellite_level:"UNKNOWN",
      cloud_track_status:"UNKNOWN",
      cloud_track_impact:false,
      cloud_track_usable:false,
      visibility_m:null,
      phase:"unknown",
      minutes_to_sunset:null,
      ...extra
    };
  }

  function assess(criticalData,sunsetLabel,options={}){
    const sunsetMin=clockMinutes(sunsetLabel);
    if(!criticalData||!Number.isFinite(sunsetMin)) return result("unknown","no_forecast");

    const nowMs=Number.isFinite(Number(options.nowMs))?Number(options.nowMs):Date.now();
    const nowMinute=Number.isFinite(Number(options.nowMinutes))?Number(options.nowMinutes):vnMinutes(nowMs);
    const minutesToSunset=sunsetMin-nowMinute;
    if(minutesToSunset<=0) return result("unknown","after_sunset",{minutes_to_sunset:minutesToSunset,phase:"after"});

    const criticalAge=ageMinutes(criticalData.generated_at||criticalData.local_generated_at,nowMs);
    if(!Number.isFinite(criticalAge)||criticalAge>180){
      return result("unknown","stale_forecast",{minutes_to_sunset:minutesToSunset});
    }

    const phase=minutesToSunset>360?"early":minutesToSunset>180?"afternoon":"near";
    const rows=[];
    for(const id of WEST_IDS){
      const point=criticalData?.points?.[id];
      const today=Array.isArray(point?.today)?point.today:[];
      let best=null;
      for(const row of today){
        const d=new Date(row?.t||"");
        if(!Number.isFinite(d.getTime())) continue;
        const parts=new Intl.DateTimeFormat("en-GB",{
          timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false
        }).formatToParts(d);
        const hour=Number(parts.find(p=>p.type==="hour")?.value||0);
        const minute=Number(parts.find(p=>p.type==="minute")?.value||0);
        const diff=Math.abs(hour*60+minute-sunsetMin);
        if(!best||diff<best.diff) best={diff,row};
      }
      if(!best||best.diff>180||!Number.isFinite(Number(best.row?.rain))) continue;
      rows.push({id,name:point?.name||id,rain:Number(best.row.rain),time:best.row.t});
    }

    const rainValues=rows.map(x=>x.rain).sort((a,b)=>a-b);
    const rainMax=rainValues.length?Math.max(...rainValues):0;
    const mid=Math.floor(rainValues.length/2);
    const rainTypical=!rainValues.length?0:rainValues.length%2
      ?rainValues[mid]:(rainValues[mid-1]+rainValues[mid])/2;

    const freshNowcasts=WEST_IDS.map(id=>criticalData?.points?.[id]?.nowcast)
      .filter(n=>n?.status==="POINT_NUMERIC_READY"&&ageMinutes(n?.sampled_time,nowMs)<=90);
    const levels=freshNowcasts.map(n=>String(n?.convective_level||"").toUpperCase()).filter(Boolean);
    const highConvective=levels.some(x=>["HIGH","SEVERE","EXTREME"].includes(x));
    const elevatedConvective=levels.some(x=>["ELEVATED","WATCH","MODERATE"].includes(x));

    const tracks=freshNowcasts.map(n=>n?.cloud_motion).filter(m=>m&&m.public_track_usable===true);
    const cloudImpact=tracks.some(m=>m.predicted_impact===true||["IMPACT_EXPECTED","NEARBY"].includes(String(m.status||"").toUpperCase()));
    const passingOnly=tracks.length>0&&tracks.every(m=>PASSING_STATES.has(String(m.status||"").toUpperCase()));
    const trackStatus=cloudImpact?"IMPACT_EXPECTED":passingOnly?"PASSING_OR_AWAY":tracks.length?"TRACKED":"UNKNOWN";

    const westGaugeNames=new Set(["CUA CAN","DUONG DONG","GANH DAU"]);
    const freshWestGauges=(Array.isArray(criticalData?.actual?.rain_gauges)?criticalData.actual.rain_gauges:[])
      .filter(g=>g&&g.qc!=="FAIL"&&g.increment_qc!=="FAIL"&&ageMinutes(g.observed_at,nowMs)<=90)
      .filter(g=>westGaugeNames.has(normalizeName(g.name)));
    const observedRain=freshWestGauges.some(g=>g.rain_observed===true||
      (Number.isFinite(Number(g.rain_intensity_mm_h))&&Number(g.rain_intensity_mm_h)>0));
    const observedIntensityMax=freshWestGauges.reduce((m,g)=>
      Math.max(m,Number.isFinite(Number(g.rain_intensity_mm_h))?Number(g.rain_intensity_mm_h):0),0);

    const metar=criticalData?.actual?.vvpq;
    const metarFresh=metar&&ageMinutes(metar.observed_at,nowMs)<=90;
    const metarWx=metarFresh?String(metar.weather||"").toUpperCase():"";
    const observedConvective=!!(metarFresh&&(metar.convective_cloud===true||/TS/.test(metarWx)));
    const metarRain=!!(metarFresh&&/(RA|SHRA|DZ)/.test(metarWx));
    const anyObservedRain=observedRain||metarRain;
    const gaugesDry=freshWestGauges.length>0&&!observedRain;
    const visibility=metarFresh?number(metar.visibility_m):null;
    const lowVisibility=visibility!==null&&visibility<=5000;

    const common={
      rain_mm_max:Number(rainMax.toFixed(2)),
      rain_mm_typical:Number(rainTypical.toFixed(2)),
      points:rows,
      observed_rain:anyObservedRain,
      observed_convective:observedConvective,
      gauges_dry:gaugesDry,
      gauge_count:freshWestGauges.length,
      satellite_level:highConvective?"HIGH":elevatedConvective?"ELEVATED":"LOW",
      cloud_track_status:trackStatus,
      cloud_track_impact:cloudImpact,
      cloud_track_usable:tracks.length>0,
      visibility_m:visibility,
      phase,
      minutes_to_sunset:minutesToSunset
    };

    if(phase==="early"){
      if(rainMax>=3||rainTypical>=2) return result("bad","forecast_rain",common);
      if(rainMax>=1.5||rainTypical>=0.8) return result("watch","forecast_rain",common);
      return result("good","early_favorable",common);
    }

    // Three to six hours before sunset, use the forecast sunset window only.
    // Current rain or convective cloud can pass long before sunset and must not
    // be projected forward as a sunset warning.
    if(phase==="afternoon"){
      if(rainMax>=2||rainTypical>=1.5) return result("bad","forecast_rain",common);
      if(rainMax>=0.8||rainTypical>=0.5) return result("watch","forecast_rain",common);
      return result("good","afternoon_favorable",common);
    }

    // Inside the final three hours, observed weather, visibility and a usable
    // Himawari cloud track become relevant to the sunset decision.
    if(observedConvective||observedIntensityMax>=2)
      return result("bad","observed_weather",common);
    if(rainMax>=2||rainTypical>=1.5)
      return result("bad","forecast_rain",common);
    if(anyObservedRain)
      return result("watch","observed_rain",common);
    if(cloudImpact)
      return result("watch","cloud_approaching",common);
    if(lowVisibility)
      return result("watch","low_visibility",common);
    if(rainMax>=0.8||rainTypical>=0.5)
      return result("watch","forecast_rain",common);
    if(highConvective&&!passingOnly)
      return result("watch","satellite_convection",common);
    if(elevatedConvective&&!tracks.length)
      return result("watch","satellite_convection",common);

    return result("good",passingOnly?"cloud_passing":"favorable",common);
  }

  return {assess,clockMinutes,refreshDelayMs};
});
