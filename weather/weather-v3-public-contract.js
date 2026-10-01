(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.OpenPQWeatherShortView=api;
  root.JoTripWeatherV3Public=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const num=v=>{
    if(v===null||v===undefined||v===""||(typeof v==="string"&&!v.trim()))return null;
    const n=Number(v);return Number.isFinite(n)?n:null;
  };
  const clean=s=>String(s||"").trim();
  function ageMinutes(iso,nowMs=Date.now()){
    const t=Date.parse(iso||"");
    return Number.isFinite(t)?Math.max(0,(nowMs-t)/60000):Infinity;
  }
  function isFresh(iso,budgetMinutes,nowMs=Date.now()){return ageMinutes(iso,nowMs)<=budgetMinutes}
  function vvpqWeatherFlags(weather){
    const tokens=clean(weather).toUpperCase().split(/\s+/).filter(Boolean);
    return {thunder:tokens.some(t=>t.includes("TS")),rain:tokens.some(t=>/(?:RA|DZ)/.test(t))};
  }
  function nowView(critical,pointId,nowMs=Date.now()){
    const item=critical?.human_weather?.rain?.[pointId];
    if(item?.evidence==="ACTUAL"&&item?.observed===true&&isFresh(item.at,45,nowMs)){
      return {state:"ACTUAL_RAIN",evidenceClass:"ACTUAL",
        headline:clean(item.headline)||"Đang có mưa ở khu vực này.",
        detail:clean(item.detail)||"Số đo mới đang ghi nhận mưa ở khu vực này.",
        observedAt:item.at||null,scope:"POINT"};
    }
    const vvpq=critical?.actual?.vvpq;
    const vvpqActual=vvpq?.data_class==="ACTUAL"||vvpq?.status==="FRESH";
    if(vvpqActual&&isFresh(vvpq?.observed_at,45,nowMs)){
      const flags=vvpqWeatherFlags(vvpq.weather);
      if(flags.rain)return {
        state:flags.thunder?"REFERENCE_ACTUAL_THUNDER_RAIN":"REFERENCE_ACTUAL_RAIN",
        evidenceClass:"ACTUAL_REFERENCE",
        headline:flags.thunder?"Trạm sân bay Phú Quốc đang ghi nhận mưa dông.":"Trạm sân bay Phú Quốc đang ghi nhận mưa.",
        detail:"Đây là quan trắc tại sân bay, không phải xác nhận mưa tại điểm đang xem.",
        observedAt:vvpq.observed_at||null,scope:"REFERENCE_STATION"
      };
      if(flags.thunder)return {
        state:"REFERENCE_ACTUAL_THUNDER",evidenceClass:"ACTUAL_REFERENCE",
        headline:"Trạm sân bay Phú Quốc đang ghi nhận dông quanh khu vực.",
        detail:"Đây là quan trắc tại sân bay, không đồng nghĩa toàn đảo hoặc điểm đang xem đang có mưa.",
        observedAt:vvpq.observed_at||null,scope:"REFERENCE_STATION"
      };
    }
    return {state:"NO_DIRECT_RAIN_CONFIRMATION",evidenceClass:"UNKNOWN",
      headline:"Chưa có số đo mưa mới tại điểm này.",
      detail:"Chưa có số đo mới thì chưa nên kết luận trời đang khô.",observedAt:null,scope:"POINT"};
  }
  function soonView(nowcast,pointId,nowMs=Date.now()){
    const sampled=nowcast?.sampled_time||null;
    if(!sampled||!isFresh(sampled,60,nowMs))return {
      state:"STALE",evidenceClass:"REMOTE_OBSERVED",
      headline:"Ảnh mây mới chưa về.",
      detail:"Tạm thời chưa đưa ra nhận định cho 30-120 phút tới.",observedAt:sampled
    };
    const point=nowcast?.points?.[pointId]||{},motion=point.cloud_motion||{};
    const score=num(point.score),eta=num(motion.eta_minutes);
    const publicTrack=motion.public_track_usable===true;
    const impact=motion.predicted_impact===true;
    const approaching=motion.approaching===true;
    const status=clean(motion.status).toUpperCase();
    if(publicTrack&&status==="MOVING_AWAY")return {
      state:"MOVING_AWAY",evidenceClass:"DERIVED_NOWCAST",
      headline:"Vùng mây đối lưu đang dịch ra xa khu vực này.",
      detail:"Đường đi hiện tại chưa cho thấy vùng mây đang tiến vào điểm đang xem.",observedAt:sampled
    };
    if(publicTrack&&status==="PASSING_BY")return {
      state:"PASSING_BY",evidenceClass:"DERIVED_NOWCAST",
      headline:"Vùng mây đối lưu đang đi ngang gần khu vực.",
      detail:"Đường đi hiện tại chưa cắt vào điểm đang xem. Tiếp tục theo dõi nếu bạn chuẩn bị ra ngoài hoặc ra biển.",
      observedAt:sampled
    };
    if(publicTrack&&status==="NEARBY"&&!approaching)return {
      state:"NEARBY_CONVECTION",evidenceClass:"DERIVED_NOWCAST",
      headline:"Có vùng mây đối lưu đang ở gần khu vực.",
      detail:"Vùng mây đang ở gần nhưng hiện chưa có bằng chứng cho thấy nó đang tiến thẳng vào điểm đang xem.",
      observedAt:sampled
    };
    if(publicTrack&&impact&&approaching&&eta!==null&&eta>=0&&eta<=120){
      let windowText="trong 1-2 giờ tới",windowCode="60_120_MIN";
      if(eta<=30){windowText="trong khoảng 30 phút tới";windowCode="0_30_MIN"}
      else if(eta<=60){windowText="trong khoảng 30-60 phút tới";windowCode="30_60_MIN"}
      return {state:"APPROACHING_CONVECTION",evidenceClass:"DERIVED_NOWCAST",
        headline:"Vùng mây đối lưu đang tiến gần khu vực.",
        detail:"Cần để ý khả năng mưa "+windowText+". Đây là suy luận từ diễn biến mây, chưa phải số đo mưa tại mặt đất.",
        observedAt:sampled,window:windowCode};
    }
    if(score!==null&&score>=75)return {
      state:"CONVECTIVE_WATCH",evidenceClass:"REMOTE_OBSERVED",
      headline:"Có vùng mây đối lưu đáng chú ý quanh khu vực.",
      detail:"Nên theo dõi thêm. Ảnh mây một mình chưa đủ để kết luận mưa sẽ tới điểm này.",observedAt:sampled
    };
    return {state:"NO_STRONG_SHORT_SIGNAL",evidenceClass:"REMOTE_OBSERVED",
      headline:"Chưa thấy tín hiệu ngắn hạn đáng chú ý.",detail:"Mưa cục bộ vẫn có thể xuất hiện.",observedAt:sampled};
  }
  function pointView(critical,nowcast,pointId,nowMs=Date.now()){
    if(!pointId)return null;
    return {pointId,status:"PUBLIC_BETA",now:nowView(critical,pointId,nowMs),soon:soonView(nowcast,pointId,nowMs),
      policy:{v2DecisionAuthority:true,pointEstimateNeverActual:true,referenceStationNeverEqualsPoint:true,
        radarNegativeNeverMeansDry:true,preciseEtaDisabled:true,lightningPublicDisabled:true}};
  }
  return {ageMinutes,isFresh,vvpqWeatherFlags,nowView,soonView,pointView};
});