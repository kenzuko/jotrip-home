(function(root,factory){
  "use strict";
  const api=factory(root);
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.OpenPQHumanWeather=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const clean=s=>String(s||"").trim().replace(/[.\s]+$/,"");
  const fmt=(template,vars={})=>String(template||"").replace(/\{([A-Za-z0-9_]+)\}/g,(_,key)=>
    Object.prototype.hasOwnProperty.call(vars,key)?String(vars[key]):"{"+key+"}");

  const comfortKeys={
    "Rất nóng và rất oi":"very_hot_very_humid",
    "Rất nóng và oi":"very_hot_humid",
    "Nóng và rất oi":"hot_very_humid",
    "Rất oi":"very_humid",
    "Nóng và khá oi":"hot_quite_humid",
    "Khá oi":"quite_humid",
    "Ấm và ẩm":"warm_humid",
    "Nóng và hơi oi":"hot_slightly_humid",
    "Hơi ẩm":"slightly_humid",
    "Nóng":"hot",
    "Ấm":"warm",
    "Khá dễ chịu":"comfortable"
  };
  const reasonKeys={
    "Độ ẩm cao làm cơ thể cảm thấy nóng hơn nhiệt độ đo được.":"humidity_hotter",
    "Không khí có nhiều hơi ẩm nên cảm giác khá oi.":"humid_air",
    "Có gió nên cảm giác đỡ bí hơn một chút.":"wind_relief",
    "Gió yếu nên cảm giác oi rõ hơn.":"weak_wind",
    "Cảm nhận ngoài trời hiện khá gần với nhiệt độ đo được.":"close_to_measured"
  };
  const pointFallback={
    an_thoi:"An Thới",duong_dong:"Dương Đông",cua_can:"Cửa Cạn",ganh_dau:"Gành Dầu",
    bai_thom:"Bãi Thơm",ham_ninh:"Hàm Ninh",bai_sao:"Bãi Sao"
  };

  function translator(options={}){
    const i18n=options.i18n||root?.OpenPQI18n;
    return (key,fallback,vars={})=>{
      const path="weather_human."+key;
      if(typeof options.t==="function"){
        const value=options.t(path,vars,fallback);
        if(typeof value==="string"&&value)return value;
      }
      if(i18n&&typeof i18n.format==="function"){
        const value=i18n.format(path,vars,fallback);
        if(typeof value==="string"&&value)return value;
      }
      return fmt(fallback,vars);
    };
  }

  function freshIsland(human){
    const reference=human?.reference;
    const actual=reference?.actual;
    const t=num(actual?.temperature_c);
    if(!reference||reference.status!=="ACTUAL"||t===null)return null;
    return {reference,actual,t};
  }

  function actualRain(rain){
    const order=["an_thoi","duong_dong","cua_can","ganh_dau","bai_thom","ham_ninh","bai_sao"];
    for(const id of order){
      const item=rain?.[id];
      if(item?.evidence==="ACTUAL"&&item?.observed===true)
        return {id,...item,headline:clean(item.headline),detail:clean(item.detail)};
    }
    return null;
  }

  function localizedComfort(label,tr){
    const key=comfortKeys[clean(label)];
    return key?tr("comfort."+key,clean(label)):clean(label);
  }

  function localizedReason(reason,tr){
    const source=String(reason||"").trim();
    if(!source)return "";
    const parts=source.split(/(?<=\.)\s+/).filter(Boolean);
    return parts.map(part=>{
      const key=reasonKeys[part.trim()];
      return key?tr("reason."+key,part.trim()):part.trim();
    }).join(" ");
  }

  function localizedRain(rain,tr){
    if(!rain)return null;
    const rate=num(rain.derived_rate_mm_h);
    let intensityKey="generic",fallback="mưa";
    if(/mưa rào nhẹ/i.test(rain.headline||"")){intensityKey="light_shower";fallback="mưa rào nhẹ"}
    else if(rate!==null&&rate<2.5){intensityKey="light";fallback="mưa nhẹ"}
    else if(rate!==null&&rate<7.5){intensityKey="moderate";fallback="mưa vừa"}
    else if(rate!==null){intensityKey="heavy";fallback="mưa lớn"}
    const place=tr("points."+rain.id,pointFallback[rain.id]||rain.id);
    const intensity=tr("rain."+intensityKey,fallback);
    const headline=tr("rain.observed","{place} đang có {intensity}",{place,intensity});
    let detail=tr("rain.observed_detail","Mưa đang được ghi nhận tại điểm quan trắc trong khu vực");
    const duration=Array.isArray(rain.duration_min)?rain.duration_min:null;
    if(duration?.length===2&&num(duration[0])!==null&&num(duration[1])!==null){
      detail=tr("rain.duration","Dự kiến mưa sẽ giảm trong khoảng {lower}-{upper} phút",{
        lower:Math.round(Number(duration[0])),upper:Math.round(Number(duration[1]))
      });
    }
    return {...rain,headline,detail,place,intensity};
  }

  function homepage(critical,options={}){
    const human=critical?.human_weather;
    const base=freshIsland(human);
    if(!base)return null;
    const tr=translator(options);
    const {reference,t}=base;
    const derived=reference.derived||{};
    const feels=num(derived.feels_like_c);
    const rain=localizedRain(actualRain(human?.rain),tr);
    const rawLocation=reference.location||"Sân bay Phú Quốc";
    const referenceLocation=rawLocation==="Sân bay Phú Quốc"
      ?tr("location_airport","Sân bay Phú Quốc")
      :rawLocation;
    let secondary;
    if(rain){
      secondary=tr("actual","Đo thực tế")+" · "+rain.headline;
    }else{
      const pieces=[tr("actual_at","Đo thực tế tại {location}",{location:referenceLocation})];
      if(derived.label)pieces.push(localizedComfort(derived.label,tr));
      if(feels!==null&&Math.abs(feels-t)>=1)
        pieces.push(tr("feels_about","cảm giác khoảng {temperature}°",{temperature:Math.round(feels)}));
      secondary=pieces.join(" · ");
    }
    return {
      primary:Math.round(t)+"°",
      secondary,
      observedAt:reference.at||null,
      temperatureC:t,
      feelsLikeC:feels,
      comfortLabel:localizedComfort(derived.label,tr)||null,
      comfortReason:localizedReason(derived.reason,tr)||null,
      rain,
      evidenceClass:"ACTUAL"
    };
  }

  return {homepage,actualRain,localizedComfort,localizedReason,localizedRain};
});
