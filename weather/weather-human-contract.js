(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.JoTripHumanWeather=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const num=v=>{if((typeof v!=="number"&&typeof v!=="string")||(typeof v==="string"&&!v.trim()))return null;const n=Number(v);return Number.isFinite(n)?n:null};
  const clean=s=>String(s||"").trim();

  function comfort(critical,pointId=null){
    const reference=critical?.human_weather?.reference;
    if(!reference||reference.status!=="ACTUAL")return null;
    const actual=reference.actual||{},t=num(actual.temperature_c),d=reference.derived||{};
    if(t===null)return null;
    const referenceLocation=reference.location||"Sân bay Phú Quốc";
    const humidity=num(d.humidity_pct);
    const pointNames={duong_dong:"Dương Đông",an_thoi:"An Thới",cua_can:"Cửa Cạn",ganh_dau:"Gành Dầu",bai_thom:"Bãi Thơm",ham_ninh:"Hàm Ninh",bai_sao:"Bãi Sao"};
    const pointName=pointNames[pointId]||"điểm đang xem";
    return {
      title:"Số đo tham chiếu tại sân bay",
      note:t.toFixed(1)+"°C tại "+referenceLocation,
      humidityText:humidity!==null?"Độ ẩm suy ra từ điểm sương: khoảng "+Math.round(humidity)+"%":null,
      methodText:"VVPQ là METAR/SPECI định kỳ, không phải cảm biến thời tiết liên tục.",
      scopeNote:"Số đo ở sân bay không đại diện trực tiếp cho cảm giác ngoài trời tại "+pointName+".",
      reason:"Cảm giác thực tế còn phụ thuộc mưa, gió, mây, bức xạ và vị trí.",
      observedAt:reference.at||null,
      actualTemperatureC:t,
      feelsLikeC:num(d.feels_like_c),
      humidityPct:humidity,
      actualLabel:"ACTUAL_PERIODIC",
      derivedLabel:"REFERENCE_ONLY",
      spatialScope:reference.scope||"REFERENCE_STATION_ACTUAL",
      referenceLocation
    };
  }
  function pointRain(critical,pointId){
    const item=critical?.human_weather?.rain?.[pointId];
    if(!item)return null;
    if(item.evidence==="ACTUAL"&&item.observed===true){
      return {
        headline:clean(item.headline),detail:clean(item.detail),evidenceClass:"ACTUAL",
        rainObserved:item.observed===true,rateMmH:num(item.derived_rate_mm_h),
        observedAt:item.at||null,duration:item.duration_min||null
      };
    }
    if(item.evidence==="DERIVED"){
      return {
        headline:clean(item.headline),detail:clean(item.detail),evidenceClass:"DERIVED",
        rainObserved:null,rateMmH:num(item.estimated_rate_mm_h),observedAt:null,duration:null
      };
    }
    return null;
  }

  function pointView(critical,pointId){
    return {comfort:comfort(critical,pointId),rain:pointRain(critical,pointId)};
  }

  return {comfort,pointRain,pointView};
});
