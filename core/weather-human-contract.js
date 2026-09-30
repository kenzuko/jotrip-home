(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.OpenPQHumanWeather=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
  const clean=s=>String(s||"").trim().replace(/[.\s]+$/,"");

  function freshIsland(human){
    const reference=human?.reference;
    const actual=reference?.actual;
    const t=num(actual?.temperature_c);
    if(!reference||reference.status!=="ACTUAL"||actual?.class!=="ACTUAL"||t===null)return null;
    return {reference,actual,t,referenceLocation:reference.location||"Sân bay Phú Quốc"};
  }

  function actualRain(points){
    const order=["an_thoi","duong_dong","cua_can","ganh_dau","bai_thom","ham_ninh","bai_sao"];
    for(const id of order){
      const p=points?.[id],a=p?.rain?.actual,i=p?.interpretation;
      if(a?.observation_status==="ACTUAL"&&a?.rain_observed===true&&i?.evidence_class==="ACTUAL")
        return {id,headline:clean(i.headline),detail:clean(i.detail)};
    }
    return null;
  }

  function homepage(critical){
    const human=critical?.human_weather;
    const base=freshIsland(human);
    if(!base)return null;
    const {reference,t,referenceLocation}=base;
    const derived=reference.derived||{};
    const feels=num(derived.feels_like_c);
    const rain=actualRain(human?.points);
    let secondary;
    if(rain){
      secondary="Đo thực tế · "+rain.headline;
    }else{
      const pieces=["Đo thực tế tại "+referenceLocation];
      if(derived.comfort_label)pieces.push(clean(derived.comfort_label));
      if(feels!==null&&Math.abs(feels-t)>=1)pieces.push("cảm giác khoảng "+Math.round(feels)+"°");
      secondary=pieces.join(" · ");
    }
    return {
      primary:Math.round(t)+"°",
      secondary,
      observedAt:reference.at||null,
      temperatureC:t,
      feelsLikeC:feels,
      rain,
      evidenceClass:"ACTUAL"
    };
  }

  return {homepage,actualRain};
});
