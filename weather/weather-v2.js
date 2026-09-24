Warning: truncated output (original token count: 39817)
Total output lines: 3024

(()=>{
"use strict";

const CRITICAL="/weather/data/critical.json";
const LOCAL_NOW="/weather/data/local-now.json";
const GROUND_TRUTH="/weather/data/groundtruth.json";
const CURRENT_BUNDLE="/weather/data/current-bundle.json";
const TIDE=["/weather/data/tide.json"];
const AQI=["/weather/data/air-quality.json"];
const NOWCAST=["/weather/data/nowcast-compact.json"];
const FRESH_BUNDLE="/weather/data/current-bundle.json";
const JOTRIP_FORECAST="/weather/data/jotrip-forecast.json";
const ENGINE_DASHBOARD="/weather/data/dashboard-data.json";
const RUNTIME_AUTHORITY="/weather/data/runtime-authority.json";
const LIVE_REFRESH_MS=2*60*1000;
const LIVE_NO_STORE_URLS=[CRITICAL,LOCAL_NOW,GROUND_TRUTH,CURRENT_BUNDLE,JOTRIP_FORECAST,ENGINE_DASHBOARD,RUNTIME_AUTHORITY,FRESH_BUNDLE,...NOWCAST];
const WEATHER_LIVE_API="/api/weather/live";
const FEEDBACK_ENDPOINT=WEATHER_LIVE_API+"/feedback";
const RECENT_FEEDBACK_ENDPOINT=WEATHER_LIVE_API+"/feedback/recent?minutes=90&limit=30";
const FEEDBACK_QUEUE_KEY="pq_weather_feedback_queue_v1";
const FEEDBACK_HISTORY_KEY="pq_weather_field_feedback_v1";
const WINDY={
  radar:"https://embed.windy.com/embed2.html?lat=10.20&lon=104.00&detailLat=10.20&detailLon=104.00&width=1000&height=650&zoom=8&level=surface&overlay=radar&product=radar&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1",
  wind:"https://embed.windy.com/embed2.html?lat=10.20&lon=104.00&detailLat=10.20&detailLon=104.00&width=1000&height=650&zoom=8&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C",
  rain:"https://embed.windy.com/embed2.html?lat=10.20&lon=104.00&detailLat=10.20&detailLon=104.00&width=1000&height=650&zoom=8&level=surface&overlay=rain&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C",
  waves:"https://embed.windy.com/embed2.html?lat=10.20&lon=104.00&detailLat=10.20&detailLon=104.00&width=1000&height=650&zoom=8&level=surface&overlay=waves&product=ecmwfWaves&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C"
};
const JMA="https://www.data.jma.go.jp/mscweb/data/himawari/img/ha1/";

const $=id=>document.getElementById(id);
const num=v=>v===null||v===undefined||v===""||Number.isNaN(Number(v))?null:Number(v);
const fmt=(v,d=1)=>{v=num(v);return v===null?"-":Number(v.toFixed(d)).toString()};
const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const defer=(fn,ms=600)=>setTimeout(()=>{"requestIdleCallback" in window?requestIdleCallback(()=>fn(),{timeout:900}):fn()},ms);
function isoUTC7(value=Date.now()){
  const d=value instanceof Date?value:new Date(value);
  if(Number.isNaN(d.getTime()))return null;
  return new Date(d.getTime()+7*3600000).toISOString().replace("Z","+07:00");
}

let critical=null;
let current="duong_dong";
let currentBundle=null;
let intradayLayer="wind";
let fullAQI=null;
let fullTide=null;
let fullNowcast=null;
let regionalForecast=null;
let engineDashboard=null;
let selectedForecastDayKey=null;
let currentRegion="central_west";
const POINT_REGION={
  duong_dong:"central_west",
  cua_can:"north_northwest",ganh_dau:"north_northwest",
  bai_thom:"east_northeast",ham_ninh:"east_northeast",
  bai_sao:"south_southeast",an_thoi:"south_southeast"
};
function regionForPoint(id){return POINT_REGION[id]||null}
let mapStarted=false;
let mapLayer="jotrip";
let jotripMap=null;
let leafletPromise=null;
let liveRefreshBusy=false;
let lastLiveRefreshAt=0;
let recentFieldFeedback=null;
let himawariLoopTimer=null;
let himawariLoopPlaying=true;
let himawariMap=null;
let himawariOverlay=null;
const HIMAWARI_HA1_BOUNDS=[[7.0,99.0],[16.0,110.0]];

async function getJSON(url,ttlMs=120000){
  const sep=url.includes("?")?"&":"?";
  const live=LIVE_NO_STORE_URLS.includes(url);
  const token=live?Date.now():Math.floor(Date.now()/Math.max(30000,ttlMs));
  const r=await fetch(url+sep+"v="+token,{cache:live?"no-store":"default"});
  if(!r.ok)throw new Error("HTTP "+r.status);
  return r.json();
}
async function getFirst(urls,ttlMs=120000){
  let last;
  for(const u of urls){
    try{return await getJSON(u,ttlMs)}catch(e){last=e}
  }
  throw last||new Error("unavailable");
}
function ageMinutes(iso){
  const t=Date.parse(iso||"");
  return Number.isFinite(t)?Math.max(0,(Date.now()-t)/60000):Infinity;
}
function liveTimestamp(){
  return critical?.local_generated_at||critical?.generated_at||null;
}
function localDataFresh(maxMinutes=35){
  return freshEnough(liveTimestamp(),maxMinutes);
}
function sourceAgeLabel(iso,limit){
  const age=ageMinutes(iso);
  if(!Number.isFinite(age))return "không rõ";
  return (age<=limit?"MỚI · ":"TRỄ · ")+ageText(iso);
}
function actualTimestamp(){return critical?.actual?.vvpq?.observed_at||null}
function nowcastTimestamp(){return fullNowcast?.sampled_time||effectiveNowcast()?.sampled_time||null}
function forecastTimestamp(){return engineDashboard?.generated_at||regionalForecast?.generated_at||critical?.generated_at||null}
function ageText(iso){
  const m=ageMinutes(iso);
  if(!Number.isFinite(m))return "không rõ";
  if(m<2)return "vừa cập nhật";
  if(m<60)return Math.round(m)+" phút trước";
  const h=Math.floor(m/60),rest=Math.round(m-h*60);
  if(rest>=60)return (h+1)+" giờ trước";
  if(rest<8)return h+" giờ trước";
  return h+" giờ "+rest+" phút trước";
}
function localTime(iso){
  const d=new Date(iso);
  return Number.isFinite(d.getTime())?d.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}):"-";
}
function hourLabel(iso){
  const d=new Date(iso);
  return Number.isFinite(d.getTime())?d.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",hour:"2-digit",minute:"2-digit",hour12:false}):"-";
}
function badgeClass(k){
  k=String(k||"").toUpperCase();
  if(k==="ACTUAL"||k==="POINT_NUMERIC_READY"||k==="READY")return "actual";
  if(k==="ESTIMATED_NOW")return "estimated";
  if(k==="REMOTE_OBSERVED")return "remote";
  if(k==="MODEL_ONLY")return "model";
  if(k==="LEARNING")return "learning";
  return "deferred";
}
function setBadge(id,k,label){
  const el=$(id);if(!el)return;
  el.className="badge "+badgeClass(k);
  const key=String(k||"").toUpperCase();
  const natural={
    ACTUAL:"ĐO THỰC",ESTIMATED_NOW:"ƯỚC TÍNH",MODEL_ONLY:"MÔ HÌNH",
    REMOTE_OBSERVED:"VỆ TINH",LEARNING:"ĐANG HIỆU CHỈNH",
    READY:"SẴN SÀNG",UNAVAILABLE:"CHƯA CÓ"
  };
  el.textContent=label||natural[key]||String(k||"-").replace("_NOW","").replaceAll("_"," ");
}
function setMetric(id,v,d){const el=$(id);if(el)el.textContent=num(v)===null?"-":fmt(v,d)}
function point(){return critical?.points?.[current]||{}}
function localPoint(){return point().local||{}}
function dashboardModelPoint(id=current){
  const p=engineDashboard?.points?.[id]||{};
  if(!p||!Object.keys(p).length)return null;
  return {
    temperature_c:num(p.temperature),
    wind_kmh:num(p.wind),
    gust_kmh:num(p.gust),
    rain_3h_mm:num(p.rain),
    wave_hs_m:num(p.wave),
    wave_hmax_m:num(p.wave_max),
    period_s:num(p.period),
    current_kmh:num(p.current),
    wave_regional_hs_m:num(p.wave_regional_hs),
    marine_sampled_time:p.marine_sampled_time||null,
    wave_max_method:p.wave_max_method||null,
    long_range_status:p.long_range_status||null
  };
}
function modelPoint(){
  const compact=point().model||{};
  if(!critical?._forecast_baseline_stale)return compact;
  return dashboardModelPoint()||compact;
}
function forecastCycleCompatible(forecast,dashboard){
  const ft=Date.parse(forecast?.run_time||"");
  const dt=Date.parse(dashboard?.source_cycles?.GEFS||"");
  if(!Number.isFinite(ft)||!Number.isFinite(dt))return true;
  return ft+5*60*1000>=dt;
}
function refreshSnapshotAuthority(){
  if(!critical||!engineDashboard)return true;
  const cs=critical.snapshot_id||null,ds=engineDashboard.snapshot_id||null;
  const mismatch=Boolean(cs&&ds&&cs!==ds);
  critical._forecast_baseline_stale=mismatch;
  if(mismatch){
    console.warn("[Weather V2] snapshot mismatch; using dashboard as model authority",{critical:cs,dashboard:ds});
  }
  if(regionalForecast&&!forecastCycleCompatible(regionalForecast,engineDashboard)){
    console.warn("[Weather V2] stale regional forecast rejected",{
      forecast:regionalForecast.run_time,
      engine:engineDashboard.source_cycles?.GEFS
    });
    regionalForecast=null;
    return false;
  }
  return !mismatch;
}
function overlayFreshLocalNow(base,localNow){
  if(!base||!localNow?.points)return base;
  const localTs=Date.parse(localNow.generated_at||"");
  const baseTs=Date.parse(base.local_generated_at||"");
  if(Number.isFinite(baseTs)&&Number.isFinite(localTs)&&localTs<baseTs)return base;
  base.local_generated_at=localNow.generated_at||base.local_generated_at;
  base.source_state={...(base.source_state||{}),local_engine:localNow.engine||base.source_state?.local_engine};
  Object.entries(localNow.points).forEach(([id,lp])=>{
    const bp=base.points?.[id];if(!bp||!lp)return;
    const rain=lp.rain||{},wind=lp.wind||{},temp=lp.temperature||{},marine=lp.marine||{};
    bp.local={...(bp.local||{}),
      available:true,
      temperature_c:num(lp.temperature_c),
      wind_kmh:num(lp.wind_kmh),
      wind_direction_deg:num(lp.wind_direction_deg),
      rain_rate_mm_h:num(rain.rain_rate_mm_h),
      rain_confidence:num(rain.confidence),
      rain_imminence_score:num(rain.imminence?.score),
      rain_imminence_level:rain.imminence?.level||null,
      rain_imminence_window_min:num(rain.imminence?.window_minutes),
      rain_imminence_motion:rain.imminence?.cloud_motion||null,
      rain_impact_label:rain.imminence?.rain_impact_label||rain.rain_impact_label||null,
      rain_impact_background_mm_h:num(rain.imminence?.background_model_rate_mm_h??rain.background_model_rate_mm_h),
      convection_score:num(rain.convective_score),
      wave_hs_m:num(lp.wave_hs_m),
      temperature_class:temp.data_class||bp.local?.temperature_class,
      wind_class:wind.data_class||bp.local?.wind_class,
      rain_class:rain.data_class||bp.local?.rain_class,
      marine_class:marine.data_class||bp.local?.marine_class,
      analysis_time:lp.analysis_time||localNow.generated_at||null,
      reference_lat:num(lp.lat),
      reference_lon:num(lp.lon),
      wind_method:wind.method||null
    };
  });
  return base;
}
function overlayFreshGroundTruth(base,ground){
  if(!base||!ground)return base;
  base._groundtruth=ground;
  const actual=base.actual={...(base.actual||{})};
  const v=ground.atmosphere?.vvpq||{};
  if(v.status){
    actual.vvpq={
      status:v.status,
      observed_at:v.observed_at,
      lat:num(v.lat),
      lon:num(v.lon),
      temperature_c:num(v.temperature_c),
      wind_kmh:num(v.wind_speed_kmh),
      wind_direction_deg:num(v.wind_direction_deg),
      pressure_hpa:num(v.pressure_hpa),
      visibility_m:num(v.visibility_m),
      weather:v.weather||null,
      convective_cloud:Boolean(v.convective_cloud)
    };
    base.source_state={...(base.source_state||{}),vvpq:v.status};
  }
  const stations=ground.rainfall?.stations||{};
  actual.rain_gauges=Object.values(stations).map(s=>({
    name:s.station_name,
    lat:num(s.lat),lon:num(s.lon),
    accum_mm:num(s.accumulation_mm),
    increment_mm:num(s.increment_mm),
    increment_min:num(s.increment_window_minutes),
    rain_observed:s.rain_observed,
    rain_intensity_mm_h:num(s.rain_intensity_mm_h),
    recent_change_mm:num(s.recent_change_mm),
    recent_change_min:num(s.recent_change_window_minutes),
    rain_recently_observed:s.rain_recently_observed,
    increment_qc:s.increment_qc,
    observed_at:s.observed_at,
    period_start:s.period_start||ground.rainfall?.period_start||null,
    period_end:s.period_end||ground.rainfall?.period_end||null,
    qc:s.qc
  }));
  if(ground.rainfall?.status)base.source_state={...(base.source_state||{}),vrain:ground.rainfall.status};
  return base;
}
async function getCriticalWithFreshLocal(){
  // The read-only Cloudflare gateway reads the SAME canonical JoTrip-Lab
  // data-weather branch. Select the newest valid snapshot, never combine
  // unrelated model baselines or treat data recency as forecast accuracy.
  const [base,mirror,edge]=await Promise.allSettled([
    getJSON(CRITICAL,2*60*1000),
    getJSON(CURRENT_BUNDLE,2*60*1000),
    getJSON(FRESH_BUNDLE,60*1000)
  ]);
  if(base.status!=="fulfilled")throw base.reason;
  critical=base.value;
  const bundles=[mirror,edge].filter(x=>x.status==="fulfilled")
    .map(x=>x.value).filter(x=>x?.local_now?.points&&x?.groundtruth);
  bundles.sort((a,b)=>Date.parse(b.local_now.generated_at||b.generated_at||0)-Date.parse(a.local_now.generated_at||a.generated_at||0));
  if(bundles.length){
    const live=bundles[0];
    currentBundle=live;
    overlayFreshLocalNow(critical,live.local_now);
    overlayFreshGroundTruth(critical,live.groundtruth);
    if(live.nowcast?.points&&(
      !fullNowcast||Date.parse(live.nowcast.sampled_time||0)>Date.parse(fullNowcast.sampled_time||0)
    ))fullNowcast=live.nowcast;
    return critical;
  }
  const [local,ground]=await Promise.allSettled([getJSON(LOCAL_NOW,2*60*1000),getJSON(GROUND_TRUTH,2*60*1000)]);
  if(local.status==="fulfilled")overlayFreshLocalNow(critical,local.value);
  if(ground.status==="fulfilled")overlayFreshGroundTruth(critical,ground.value);
  return critical;
}

function islandIds(){
  return (critical?.island_watch_order||[]).filter(id=>critical?.points?.[id]);
}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function viLevel(v){
  return ({LOW:"THẤP",WATCH:"THEO DÕI",ELEVATED:"TĂNG",HIGH:"CAO"}[String(v||"").toUpperCase()]||String(v||""));
}
function viCal(v){
  return String(v||"").toUpperCase()==="LEARNING"?"ĐANG HIỆU CHỈNH":String(v||"").replaceAll("_"," ");
}
function sourceReady(v){
  const x=String(v||"").toUpperCase();
  return ["FRESH","READY","POINT_NUMERIC_READY","MEMBER_MATRIX_READY","PASS","LIVE"].includes(x);
}
function pointLayerCoverage(p){
  const l=p.local||{},a=p.aqi||{},t=p.tide||{},n=p.nowcast||{},e=p.ensemble||{};
  return [
    [l.temperature_c,l.wind_kmh,l.rain_rate_mm_h].every(v=>num(v)!==null),
    num(l.wave_hs_m??p.model?.wave_hs_m)!==null,
    num(a.aqi_us)!==null,
    num(t.height_m)!==null,
    num(n.convective_score)!==null,
    (e.rows||[]).length>=3
  ];
}
function coverageScore(){
  const ids=islandIds();if(!ids.length)return 0;
  let ok=0,total=0;
  ids.forEach(id=>pointLayerCoverage(critical.points[id]).forEach(v=>{total++;if(v)ok++}));
  return total?Math.round(100*ok/total):0;
}
function confidenceScore(){
  const ids=islandIds();if(!ids.length)return 0;
  const coverage=coverageScore()/100;
  const confs=ids.map(id=>num(critical.points[id]?.local?.rain_confidence)).filter(v=>v!==null);
  const local=confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:0.35;
  const fresh=clamp(1-ageMinutes(liveTimestamp())/90,0,1);
  const ens=ids.map(id=>num(critical.points[id]?.ensemble?.completion_ratio)).filter(v=>v!==null);
  const ensemble=ens.length?ens.reduce((a,b)=>a+b,0)/ens.length:0;
  const g=critical.actual?.rain_gauges||[];
  const actual=(sourceReady(critical.source_state?.vvpq)?0.45:0)+(g.filter(x=>x.qc==="PASS"||num(x.accum_mm)!==null).length>=3?0.55:0);
  let score=100*(0.25*coverage+0.30*local+0.15*fresh+0.15*ensemble+0.15*actual);
  const learning=ids.some(id=>String(critical.points[id]?.ensemble?.calibration_status||"").toUpperCase()==="LEARNING");
  if(learning)score*=0.88;
  return Math.round(clamp(score,0,100));
}
function pointRisk(p,id=null){
  const m=p.model||{},legacyNow=p.nowcast||{},l=p.local||{},rows=p.ensemble?.rows||[];
  const n=id?effectiveNowcastFor(id):legacyNow;
  const localFresh=localDataFresh();
  const nowFresh=freshEnough(n?.sampled_time||fullNowcast?.sampled_time||legacyNow.sampled_time,75);
  const conv=nowFresh?num(n?.convective_score):null;
  const imminence=localFresh?num(l.rain_imminence_score):null;
  const guard=globalThis.JoTripWindGuard;
  const freshModel=guard?.dashboardUsable(engineDashboard);
  const now=Date.now();
  const nearRows=freshModel?(engineDashboard?.points?.[id]?.hours||[])
    .filter(r=>{
      const t=Date.parse(r.time_iso||"");
      return Number.isFinite(t)&&t>=now&&t<=now+3*3600000&&
        guard.validForecastFrame(r);
    }):[];
  const maxOrNull=(values)=>values.length?Math.max(...values):null;
  const gust=maxOrNull(nearRows.map(r=>num(r.gust)).filter(v=>v!==null));
  const rain=maxOrNull(nearRows.map(r=>num(r.rain)).filter(v=>v!==null));
  const hs=maxOrNull(nearRows.map(r=>num(r.wave)).filter(v=>v!==null));
  const currentWind=localFresh&&l.available?num(l.wind_kmh):null;
  const aligned=freshModel&&critical?.snapshot_id&&
    critical.snapshot_id===engineDashboard?.snapshot_id&&
    freshEnough(critical?.generated_at,150);
  const nearEns=aligned?rows.filter(r=>num(r.lead_hours)!==null&&r.lead_hours<=6):[];
  const windProb=Math.max(0,...nearEns.map(x=>num(x.wind?.prob)).filter(v=>v!==null));
  const rainProb=Math.max(0,...nearEns.map(x=>num(x.rain?.prob)).filter(v=>v!==null));
  let level=0,reasons=[];
  if(currentWind!==null&&currentWind>=40){level=Math.max(level,3);reasons.push("gió hiện tại mạnh theo ước tính địa phương")}
  else if(currentWind!==null&&currentWind>=30){level=Math.max(level,2);reasons.push("gió hiện tại cần theo dõi")}
  if(conv!==null&&conv>=75){level=Math.max(level,2);reasons.push("mây phát triển rất cao")}
  else if(conv!==null&&conv>=60){level=Math.max(level,1);reasons.push("mây đang phát triển")}
  if(imminence!==null&&imminence>=75){level=Math.max(level,2);reasons.push("mưa cục bộ có thể tăng nhanh")}
  else if(imminence!==null&&imminence>=55){level=Math.max(level,1);reasons.push("mưa ngắn hạn cần theo dõi")}
  if(gust!==null&&gust>=50){level=Math.max(level,3);reasons.push("dự báo gió giật mạnh trong 3 giờ tới")}
  else if(gust!==null&&gust>=40){level=Math.max(level,2);reasons.push("dự báo gió giật cần theo dõi trong 3 giờ tới")}
  if(rain!==null&&rain>=25){level=Math.max(level,3);reasons.push("dự báo mưa 3 giờ lớn")}
  else if(rain!==null&&rain>=10){level=Math.max(level,2);reasons.push("dự báo mưa 3 giờ tăng")}
  if(hs!==null&&hs>=2){level=Math.max(level,3);reasons.push("sóng nền dự báo cao")}
  else if(hs!==null&&hs>=1.5){level=Math.max(level,2);reasons.push("sóng nền dự báo tăng")}
  if(windProb>=0.25){level=Math.max(level,2);reasons.push("vẫn còn kịch bản gió mạnh")}
  else if(windProb>=0.10){level=Math.max(level,1)}
  if(rainProb>=0.50){level=Math.max(level,2);reasons.push("nhiều kịch bản cùng nghiêng về mưa")}
  else if(rainProb>=0.25){level=Math.max(level,1)}
  return {level,reasons};
}
function beaufort(kmh){
  const v=Math.max(0,num(kmh)||0);
  const limits=[1,6,12,20,29,39,50,62,75,89,103,118];
  const names=["Lặng gió","Rất nhẹ","Nhẹ","Gió yếu","Vừa","Khá mạnh","Mạnh","Gió lớn","Gió rất lớn","Bão","Bão mạnh","Bão rất mạnh","Cuồng phong"];
  let force=12;
  for(let i=0;i<limits.length;i++){if(v<limits[i]){force=i;break}}
  return {force,label:names[force]};
}
function probabilityLevel(v){
  v=num(v);
  if(v===null)return {label:"CHƯA RÕ",score:0};
  if(v>=0.60)return {label:"CAO",score:3};
  if(v>=0.30)return {label:"VỪA",score:2};
  if(v>=0.12)return {label:"THẤP - VỪA",score:1};
  return {label:"THẤP",score:0};
}
function variationLevel(w,r){
  const ws=num(w?.spread)||0,rs=num(r?.spread)||0;
  const raw=Math.max(ws/20,rs/10);
  const index=Math.round(clamp(raw*100,0,100));
  if(index>=70)return {label:"CAO",score:3,index};
  if(index>=40)return {label:"VỪA",score:2,index};
  if(index>=20)return {label:"NHẸ",score:1,index};
  return {label:"ỔN ĐỊNH",score:0,index};
}
function pct(v){
  v=num(v);return v===null?"-":Math.round(clamp(v,0,1)*100)+"%";
}
function rowVariability(r){
  const direct=num(r?.variability_score);
  if(direct!==null)return Math.round(clamp(direct,0,100));
  return variationLevel({spread:r?.wind_spread},{spread:r?.rain_spread}).index;
}
function rowConfidence(r){
  const direct=num(r?.confidence_score);
  if(direct!==null)return Math.round(clamp(direct,0,100));
  const completion=clamp(num(regionalForecast?.ensemble_completion_ratio)??0,0,1);
  const lead=Math.max(0,num(r?.lead_hours)||0);
  const leadPenalty=lead<=72?0:Math.min(35,35*(lead-72)/(240-72));
  const learning=String(regionalForecast?.calibration_status||"").toUpperCase()==="LEARNING"?8:0;
  return Math.round(clamp(100*completion-leadPenalty-learning,35,95));
}
function leadMoment(row){
  return row?.valid_time?localTime(row.valid_time):("+"+fmt(row?.lead_hours,0)+" giờ");
}
function rowValidMs(row){
  const t=Date.parse(row?.valid_time||"");
  return Number.isFinite(t)?t:null;
}
function isFutureForecastRow(row,graceMinutes=10){
  const t=rowValidMs(row);
  return t===null?true:t>=Date.now()-graceMinutes*60000;
}
function futureForecastRows(rows){
  return (Array.isArray(rows)?rows:[])
    .filter(r=>isFutureForecastRow(r))
    .sort((a,b)=>(rowValidMs(a)??Infinity)-(rowValidMs(b)??Infinity));
}
function setHazard(id,label,meta,level){
  const b=$(id),m=$(id+"Meta");if(!b||!m)return;
  b.textContent=label;m.textContent=meta;
  const card=b.closest("article");
  if(card)card.dataset.level=String(level||0);
}
function renderHazardBoard(){
  const points=islandIds().map(id=>({id,p:critical.points[id]}));

  // Mưa hiện tại: ưu tiên VRain đo thực, sau đó mới tới Local Now.
  const gauges=(critical?.actual?.rain_gauges||[])
    .filter(g=>freshEnough(g.observed_at,35))
    .map(g=>({...g,rate:num(g.rain_intensity_mm_h)}))
    .sort((a,b)=>(b.rate||0)-(a.rate||0));
  const fieldRain=combinedRecentFeedback().find(x=>feedbackCategoryFromRecord(x)==="RAIN_MORE");
  const recentGauge=gauges.filter(g=>num(g.recent_change_mm)>0&&num(g.recent_change_min)>0)
    .sort((a,b)=>(b.recent_change_mm||0)-(a.recent_change_mm||0))[0];
  const wetGauge=gauges.find(g=>g.rain_observed===true&&(g.rate||0)>0);
  if(fieldRain){
    const nm=fieldRain.point_name||pointDisplayName(fieldRain.point_id);
    setHazard(
      "hazardRain",
      nm+": thực địa báo mưa nhiều hơn ước tính",
      "VRain là số đo tại từng vị trí trạm, không đại diện toàn khu vực. Hệ thống đang giữ cảnh báo sai lệch này để đối chiếu.",
      3
    );
  }else if(wetGauge){
    const rate=wetGauge.rate||0;
    setHazard(
      "hazardRain",
      wetGauge.name+" đang mưa ~"+fmt(rate,1)+" mm/h",
      (num(wetGauge.increment_mm)!==null&&num(wetGauge.increment_min)!==null
        ?("VRain đo thực · +"+fmt(wetGauge.increment_mm,1)+" mm trong "+fmt(wetGauge.increment_min,0)+" phút")
        :"VRain đo thực · "+ageText(wetGauge.observed_at)),
      rate>=7.5?3:rate>=2.5?2:1
    );
  }else if(recentGauge){
    setHazard(
      "hazardRain",
      recentGauge.name+": vừa ghi nhận có mưa",
      "Tổng tại trạm tăng +"+fmt(recentGauge.recent_change_mm,1)+" mm trong khoảng "+fmt(recentGauge.recent_change_min,0)+" phút kể từ lần lấy trước. Chưa dùng khoảng này để tính mm/h hiện tại.",
      1
    );
  }else{
    const localRain=localDataFresh()?points.map(x=>({name:x.p.name,rate:num(x.p.local?.rain_rate_mm_h)||0,cls:x.p.local?.rain_class}))
      .sort((a,b)=>b.rate-a.rate)[0]:null;
    if(localRain&&localRain.rate>=0.5){
      setHazard("hazardRain",
        localRain.name+" ước tính ~"+fmt(localRain.rate,1)+" mm/h",
        "JoTrip Local Now · chưa phải số đo tại chỗ",
        localRain.rate>=7.5?3:localRain.rate>=2.5?2:1
      );
    }else{
      const dryNames=gauges.filter(g=>g.rain_observed===false).slice(0,3).map(g=>g.name);
      const cloudMax=points.map(x=>num(effectiveNowcastFor(x.id)?.convective_score)||0).sort((a,b)=>b-a)[0]||0;
      if(cloudMax>=70){
        setHazard("hazardRain",
          "Các trạm VRain gần đây chưa ghi nhận mưa tại đúng vị trí trạm",
          (dryNames.length?("VRain "+dryNames.join(", ")+" đang 0 mm/h. "):"")+
          "Tuy vậy Himawari đang thấy vùng mây rất cao quanh đảo, nên vẫn có thể có mưa cục bộ giữa các trạm.",
          1
        );
      }else{
        setHazard("hazardRain",
          "Chưa thấy mưa đáng kể trong các nguồn đang có",
          dryNames.length?("VRain "+dryNames.join(", ")+" hiện chưa ghi nhận mưa tại vị trí trạm"):"Ước tính mưa hiện tại đang thấp",
          0
        );
      }
    }
  }

  // Mây mưa 0-3 giờ: chỉ phát giờ đến khi backend xác nhận quỹ đạo cắt khu vực.
  const impacts=points.map(x=>{
    const n=effectiveNowcastFor(x.id),m=n.cloud_motion||{};
    return {id:x.id,name:x.p.name,n,m,eta:num(m.eta_minutes),score:num(n.convective_score)||0};
  });
  const incoming=impacts.filter(x=>x.m.public_track_usable&&x.m.predicted_impact&&x.eta!==null&&x.eta>=0&&x.eta<=180)
    .sort((a,b)=>a.eta-b.eta);
  if(incoming.length){
    const first=incoming[0];
    setHazard("hazardStorm",
      "Vùng mây mưa đang hướng tới "+first.name,
      motionEtaText(first.m)+" · "+cloudImpactText(first.id,first.n),
      first.eta<=60?3:2
    );
  }else{
    const strongest=impacts.sort((a,b)=>b.score-a.score)[0];
    if(strongest&&strongest.score>=70){
      const st=String(strongest.m.status||"").toUpperCase();
      const movement=st==="MOVING_AWAY"?"đang rời xa":st==="PASSING_BY"?"dự kiến đi lệch khu vực":"chưa xác định đường vào đủ rõ";
      const cloud=cloudStateLabel(strongest.n);
      setHazard("hazardStorm",
        cloud.label,
        strongest.name+" · "+movement+(cloud.detail?" · "+cloud.detail:""),
        1
      );
    }else{
      setHazard("hazardStorm","Chưa thấy vùng mây mưa đáng lo","Himawari chưa cho thấy quỹ đạo mây mạnh đi thẳng vào các điểm đảo trong 3 giờ tới",0);
    }
  }

  // Current local wind and time-stamped background marine wave are separate
  // sources. Do not silently substitute stale model wind for live local wind.
  const useLocal=localDataFresh();
  const windNow=useLocal?points.map(x=>({
    name:x.p.name,wind:x.p.local?.available?num(x.p.local.wind_kmh):null
  })).filter(x=>x.wind!==null).sort((a,b)=>b.wind-a.wind)[0]:null;
  const waveNow=points.map(x=>({
    name:x.p.name,hs:num(x.p.model?.wave_hs_m),
    sampled:x.p.model?.marine_sampled_time
  })).filter(x=>x.hs!==null&&freshEnough(x.sampled,210))
    .sort((a,b)=>b.hs-a.hs)[0];
  const windLabel=windNow?("Gió địa phương cao nhất "+windNow.name+" ~"+fmt(windNow.wind,0)+" km/h"):"Chưa có số gió tại điểm đủ mới";
  const windMeta=waveNow?("Sóng nền MÔ HÌNH ~"+fmt(waveNow.hs,1)+" m tại "+waveNow.name+" · "+phuQuocClock(waveNow.sampled)):"Chưa có số sóng nền mới";
  setHazard("hazardWind",windLabel,windMeta,windNow?.wind>=40||waveNow?.hs>=2?3:windNow?.wind>=30||waveNow?.hs>=1.5?2:0);

  // 12 giờ tới: dùng giá trị JoTrip forecast dễ đọc, không lấy probability làm dòng chính.
  const future=[];
  Object.values(regionalForecast?.regions||{}).forEach(region=>{
    (region.rows||[]).forEach(row=>{
      const ms=rowValidMs(row),hours=ms===null?num(row.lead_hours):(ms-Date.now())/3600000;
      if(hours===null||hours<0||hours>12)return;
      const rain=num(row.rain_mm)||0,wind=num(row.wind_kmh)||0,rainHigh=num(row.rain_q90_mm),windHigh=num(row.wind_q90_kmh);
      const severity=Math.max(
        rain>=7.5?3:rain>=2.5?2:rain>=.5?1:0,
        wind>=40?3:wind>=30?2:wind>=22?1:0,
        (rainHigh!==null&&rainHigh>=12)||(windHigh!==null&&windHigh>=40)?2:0
      );
      future.push({region:region.name||"Phú Quốc",row,hours,rain,wind,rainHigh,windHigh,severity});
    });
  });
  future.sort((a,b)=>b.severity-a.severity||a.hours-b.hours);
  const f=future[0];
  if(f&&f.severity>0){
    const time=f.row.valid_time?localTime(f.row.valid_time):("+"+fmt(f.hours,0)+" giờ");
    setHazard("hazardVolatility",
      f.region+" cần lưu ý khoảng "+time,
      "Mưa ~"+fmt(f.rain,1)+" mm/mốc · gió ~"+fmt(f.wind,0)+" km/h"+
        (f.rainHigh!==null?(" · kịch bản mưa cao "+fmt(f.rainHigh,1)+" mm"):"")+
        (f.windHigh!==null?(" · gió cao "+fmt(f.windHigh,0)+" km/h"):""),
      f.severity
    );
  }else{
    setHazard("hazardVolatility","Chưa thấy mốc xấu rõ trong 12 giờ tới","JoTrip vẫn tiếp tục đối chiếu ensemble và dữ liệu thực tế mỗi chu kỳ",0);
  }
}

function islandAssessment(){
  const rows=islandIds().map(id=>({id,p:critical.points[id],risk:pointRisk(critical.points[id],id)}));
  rows.sort((a,b)=>b.risk.level-a.risk.level);
  const worst=rows[0]?.risk.level||0;
  const label=worst>=3?"NÊN ĐIỀU CHỈNH":worst>=2?"THEO DÕI SÁT":worst>=1?"CÓ ĐIỂM CẦN LƯU Ý":"TƯƠNG ĐỐI ỔN";
  const attention=rows.filter(x=>x.risk.level>=2).slice(0,4);
  return {label,attention,rows};
}
function renderTechnicalPointTabs(){
  if(!critical)return;
  const nav=$("technicalPointTabs");
  // The primary point selector controls all sections, including deep analysis.
  if(nav)nav.innerHTML="";
  const title=$("technicalPointTitle");if(title)title.textContent=point().name||current;
}
function renderTechnicalFreshness(){
  const set=(id,iso,limit)=>{const el=$(id);if(!el)return;el.textContent=sourceAgeLabel(iso,limit);el.classList.toggle("stale",ageMinutes(iso)>limit)};
  set("technicalLocalAge",critical?.local_generated_at,35);
  set("technicalActualAge",actualTimestamp(),35);
  set("technicalNowcastAge",nowcastTimestamp(),35);
  set("technicalForecastAge",forecastTimestamp(),180);
}
function renderTechnicalPointForecast(){
  const body=$("technicalForecastRows"),title=$("technicalForecastTitle"),meta=$("technicalForecastMeta");
  if(!body)return;
  if(title)title.textContent="Chi tiết mô hình tại "+(point().name||current);
  const rows=(engineDashboard?.points?.[current]?.hours||[]).filter(r=>Date.parse(r.time_iso||"")>=Date.now()-30*60*1000);
  if(!rows.length){
    body.innerHTML='<tr><td colspan="6">Chưa có chuỗi dự báo theo điểm.</td></tr>';
    if(meta)meta.textContent="Đang chờ JoTrip Engine.";
    return;
  }
  body.innerHTML=rows.map(r=>'<tr>'+
    '<td><b>'+esc(localTime(r.time_iso))+'</b></td>'+
    '<td>'+ (num(r.temperature)===null?'-':fmt(r.temperature,1)+'°C') +'</td>'+
    '<td>'+ (num(r.wind)===null?'-':fmt(r.wind,1)+' km/h') +'</td>'+
    '<td>'+ (safeModelGust(r)===null?'-':fmt(r.gust,1)+' km/h') +'</td>'+
    '<td>'+ (num(r.rain)===null?'-':fmt(r.rain,2)+' mm/mốc') +'</td>'+
    '<td>'+ (num(r.wave)===null?'-':fmt(r.wave,2)+' m') +'</td>'+
  '</tr>').join("");
  if(meta)meta.textContent=rows.length+" mốc · JoTrip Engine · "+sourceAgeLabel(engineDashboard?.generated_at,180)+". D0-D3 có độ phân giải cao hơn; các ngày xa chỉ dùng như xu hướng.";
}
function renderTechnical(){
  renderTechnicalPointTabs();
  renderTechnicalFreshness();
  renderIntradayChart();
  renderTechnicalPointForecast();
  renderCurrent();
  renderHealth();
}

function renderPointTabs(){
  const nav=$("pointTabs");if(!nav||!critical)return;
  const ids=[...islandIds()];
  if(critical.points?.rach_gia&&!ids.includes("rach_gia"))ids.push("rach_gia");
  nav.innerHTML=ids.map(id=>{
    const comparison=id==="rach_gia";
    const label=esc(critical.points[id]?.name||id)+(comparison?" · đối chiếu":"");
    const title=comparison?' title="Điểm đối chiếu Rạch Giá - không tính vào tổng quan 7 điểm đảo"':"";
    return '<button class="'+(id===current?'active ':'')+(comparison?'off-island':'')+'" data-point="'+esc(id)+'"'+title+'>'+label+'</button>';
  }).join("")+
  '<button class="off-island" data-compare="ha_tien" title="Đối chiếu hành lang mây Himawari tại Hà Tiên">Hà Tiên · hành lang mây</button>';
}

function renderStatus(){
  if(!critical)return;
  const localAge=ageMinutes(critical?.local_generated_at);
  const actualAge=ageMinutes(actualTimestamp());
  const nowAge=ageMinutes(nowcastTimestamp());
  // The newest unrelated source must never make all sources look fresh.
  // For the customer-facing header, Local Now is the primary current-time source.
  const localDelayed=localAge===null||localAge>20;
  const localStale=localAge===null||localAge>35;
  const cloudDelayed=nowAge===null||nowAge>35;
  $("liveDot").className=localDelayed||cloudDelayed?"warn":"ok";
  const localLabel=critical?.local_generated_at?"Tại điểm "+ageText(critical.local_generated_at):"Tại điểm chưa có dữ liệu";
  const cloudLabel=nowcastTimestamp()?" · mây "+ageText(nowcastTimestamp()):" · mây chưa cập nhật";
  $("liveLabel").textContent=(localStale?"DỮ LIỆU TẠI ĐIỂM ĐANG TRỄ":localDelayed?"ĐANG CHỜ BẢN LÚC NÀY":"LÚC NÀY ĐÃ CẬP NHẬT")+" · "+localLabel+cloudLabel;

  const assessment=islandAssessment();
  const coverage=coverageScore();
  const confidence=confidenceScore();
  $("decisionNow").textContent=assessment.label;
  $("completenessNow").textContent=coverage+"% · "+islandIds().length+"/"+islandIds().length+" điểm";
  $("confidenceNow").textContent=confidence+"/100 · "+(confidence>=80?"cao":confidence>=60?"khá":"thận trọng");
  const fallbackLead=Math.max(0,...islandIds().flatMap(id=>(critical.points[id]?.ensemble?.rows||[]).map(r=>Number(r.lead_hours)||0)));
  const maxLead=Number(regionalForecast?.horizon_hours||fallbackLead||0);
  const regionalStale=regionalForecast?regionalForecastFreshness().stale:false;
  $("horizonNow").textContent=maxLead?(maxLead>=240?(regionalStale?"10 NGÀY · ĐANG CẬP NHẬT":"10 NGÀY"):maxLead+" giờ"):"CHƯA CÓ";
  $("completenessNow").parentElement.title="Tỷ lệ các lớp phân tích hiện tại, dự báo JoTrip, AQI, triều, Himawari và dự báo tổ hợp đang có dữ liệu trên 7 điểm đảo.";
  $("confidenceNow").parentElement.title="Mức tin cậy của toàn bộ dữ liệu đang dùng, không phải xác suất dự báo chắc chắn đúng.";
  const summary=$("islandSummary");
  if(summary){
    const watches=buildQuickWatchEvents().slice(0,2);
    if(watches.length){
      summary.innerHTML="<b>Hiện cần chú ý:</b> "+watches.map(x=>esc(x.title)+(x.detail?" - "+esc(x.detail):"")).join("<br>")+"<small>Tin nhanh tự biến mất khi dữ liệu mới cho thấy tình huống đã qua.</small>";
    }else{
      summary.innerHTML="<b>Toàn đảo:</b> hiện chưa thấy tình huống nào vượt ngưỡng theo dõi chính.<small>Hệ thống vẫn cập nhật mưa, gió, mây và biển theo từng chu kỳ.</small>";
    }
  }
  renderHazardBoard();
  $("dataMode").textContent=critical.data_mode==="B"?"ƯU TIÊN RỦI RO":(critical.data_mode||"-");
}

function summary(p){
  const l=p.local||{},m=p.model||{},bits=[];
  const localFresh=localDataFresh();
  const nowFresh=freshEnough(fullNowcast?.sampled_time||(p.nowcast||{}).sampled_time,35);
  const rain=localFresh?num(l.rain_rate_mm_h):null;
  const imminence=localFresh?num(l.rain_imminence_score):null;
  const conv=nowFresh?num(effectiveNowcast()?.convective_score??l.convection_score):null;
  const wind=localFresh&&l.available?num(l.wind_kmh):null;
  const wave=localFresh?num(l.wave_hs_m??m.wave_hs_m):num(m.wave_hs_m);
  if(rain!==null)bits.push(rain>=3?"Đang có mưa đáng chú ý":rain>.2?"Có mưa nhẹ hoặc rải rác":"Mưa hiện tại ít");
  if(imminence!==null&&imminence>=75)bits.push("mưa cục bộ có thể tăng nhanh trong 0-60 phút");
  else if(imminence!==null&&imminence>=55)bits.push("mưa ngắn hạn cần theo dõi");
  if(conv!==null&&conv>=70)bits.push("có mây dông đáng chú ý");
  if(wind!==null)bits.push("gió khoảng "+fmt(wind,0)+" km/h");
  if(wave!==null)bits.push("sóng khoảng "+fmt(wave,1)+" m");
  return bits.length?bits.join(" · ")+".":"Chưa đủ dữ liệu địa phương để tóm tắt.";
}

function kmBetween(lat1,lon1,lat2,lon2){
  if([lat1,lon1,lat2,lon2].some(v=>num(v)===null))return null;
  const r=6371.0088,toRad=x=>x*Math.PI/180;
  const p1=toRad(lat1),p2=toRad(lat2),dp=toRad(lat2-lat1),dl=toRad(lon2-lon1);
  const a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*r*Math.asin(Math.sqrt(a));
}
function nearestRainGauge(){
  const l=localPoint(),gauges=critical?.actual?.rain_gauges||[];
  const lat=num(l.reference_lat),lon=num(l.reference_lon);
  if(lat===null||lon===null||!gauges.length)return null;
  return gauges.map(g=>({...g,distance_km:kmBetween(lat,lon,g.lat,g.lon)}))
    .filter(g=>g.distance_km!==null)
    .sort((a,b)=>a.distance_km-b.distance_km)[0]||null;
}
function colocatedRainActual(maxDistanceKm=1.5,maxAgeMinutes=25){
  const g=nearestRainGauge();if(!g||num(g.distance_km)===null||g.distance_km>maxDistanceKm||g.qc!=="PASS")return null;
  const age=(Date.now()-Date.parse(g.observed_at||""))/60000;
  if(!Number.isFinite(age)||age<0||age>maxAgeMinutes)return null;
  let rate=null,state="";
  if(g.rain_observed===false||num(g.accum_mm)===0){rate=0;state="KHÔNG MƯA"}
  else if(num(g.rain_intensity_mm_h)!==null){rate=num(g.rain_intensity_mm_h);state=rate>0?"CÓ MƯA":"KHÔNG MƯA"}
  else if(num(g.increment_mm)!==null&&num(g.increment_min)>0){rate=num(g.increment_mm)*60/num(g.increment_min);state=rate>0?"CÓ MƯA":"KHÔNG MƯA"}
  if(rate===null)return null;
  return {...g,rate_mm_h:rate,state,age_minutes:age};
}
function rainActualContext(){
  const field=recentFeedbackFor(current,"RAIN_MORE");
  const g=nearestRainGauge();
  if(field){
    const where=point().name||current;
    const station=g?(" Trạm "+esc(g.name||"gần nhất")+" cách "+fmt(g.distance_km,1)+" km có thể ghi khác vì mưa cục bộ."):"";
    return "Phản hồi tại chỗ mới: "+esc(where)+" đang mưa nhiều hơn hệ thống ước tính."+station;
  }
  if(!g)return "";
  const name=esc(g.name||"gần nhất"),dist=fmt(g.distance_km,1);
  if(g.rain_observed===true){
    const rate=num(g.rain_intensity_mm_h);
    return "Trạm "+name+" đang ghi nhận mưa"+(rate!==null?" ~"+fmt(rate,1)+" mm/h":"")+" · cách điểm đang xem "+dist+" km.";
  }
  if(g.rain_observed===false||num(g.accum_mm)===0){
    return "Trạm "+name+" chưa ghi nhận mưa ngay tại vị trí trạm · cách "+dist+" km. Điều này không có nghĩa toàn khu vực đều khô.";
  }
  if(num(g.accum_mm)!==null){
    return "Trạm "+name+" đã ghi nhận tổng "+fmt(g.accum_mm,1)+" mm trong kỳ · cách "+dist+" km.";
  }
  return "Trạm mưa gần nhất: "+name+" · cách "+dist+" km.";
}
function weatherCondition(rain,conv,wind,forecast=false){
  rain=num(rain)||0;conv=num(conv)||0;wind=num(wind)||0;
  if(forecast){
    if(conv>=75&&rain>=1)return {label:"Có khả năng mưa dông cục bộ",icon:"⛈️",mood:"storm"};
    if(rain>=3)return {label:"Dự báo có mưa",icon:"🌧️",mood:"storm"};
    if(rain>=.2)return {label:"Có thể có mưa nhẹ hoặc rải rác",icon:"🌦️",mood:"watch"};
    if(conv>=60)return {label:"Mây đối lưu cần theo dõi",icon:"☁️",mood:"watch"};
    if(wind>=28)return {label:"Dự báo gió khá mạnh",icon:"💨",mood:"watch"};
    if(conv>=25)return {label:"Có thể nhiều mây",icon:"⛅",mood:"calm"};
    return {label:"Dự báo tương đối ổn",icon:"🌤️",mood:"calm"};
  }
  if(conv>=75&&rain>=1)return {label:"Mưa dông cục bộ",icon:"⛈️",mood:"storm"};
  if(rain>=3)return…19817 tokens truncated…;
  }else if(layer==="rain"){
    history=hist.map(r=>({time:r.time,value:num(r.rain_rate_mm_h),kind:"estimated"})).filter(r=>r.value!==null);
    forecast=ens.length
      ?ens.map(r=>({time:r.valid_time,value:num(r.rain?.q50)===null?null:num(r.rain.q50)/6,high:num(r.rain?.q90)===null?null:num(r.rain.q90)/6,kind:"forecast"})).filter(r=>r.value!==null)
      :model72.map(r=>({time:r.time,value:num(r.rain_3h_mm)===null?null:num(r.rain_3h_mm)/3,high:null,kind:"forecast_model",model_only:true})).filter(r=>r.value!==null);
  }else if(layer==="temperature"){
    history=hist.map(r=>({time:r.time,value:num(r.temperature_c),kind:"estimated"})).filter(r=>r.value!==null);
    forecast=ens.length
      ?ens.map(r=>({time:r.valid_time,value:num(r.temperature?.q50),high:num(r.temperature?.q90),kind:"forecast"})).filter(r=>r.value!==null)
      :model72.map(r=>({time:r.time,value:num(r.temperature_c),high:null,kind:"forecast_model",model_only:true})).filter(r=>r.value!==null);
    actual=intradayActual().filter(r=>{const t=Date.parse(r.time);return Number.isFinite(t)&&t>=start&&t<=now+15*60*1000}).map(r=>({time:r.time,value:num(r.temperature_c),kind:"actual",source:"VVPQ"})).filter(r=>r.value!==null);
  }else if(layer==="wave"){
    history=hist.map(r=>({time:r.time,value:num(r.wave_hs_m),kind:"model"})).filter(r=>r.value!==null);
    forecast=waveForecast72().filter(r=>{const t=Date.parse(r.time);return Number.isFinite(t)&&t>=now-15*60*1000&&t<=end}).map(r=>({
      time:r.time,value:num(r.wave_hs_m),high:num(r.wave_hmax_m),kind:"forecast",period_s:num(r.period_s),
      reference_mode:r.reference_mode||null,reference_point:r.reference_point||null,reference_distance_km:num(r.reference_distance_km)
    })).filter(r=>r.value!==null);
  }else if(layer==="convective"){
    history=hist.map(r=>({time:r.time,value:num(r.convective_score),kind:"remote"})).filter(r=>r.value!==null);
  }else if(layer==="tide"){
    const t=effectiveTide();
    forecast=(t.series||[]).filter(r=>{const tt=Date.parse(r.time_iso);return Number.isFinite(tt)&&tt>=now-H1&&tt<=end}).map(r=>({time:r.time_iso,value:num(r.height_m),kind:"forecast"})).filter(r=>r.value!==null);
  }
  const sort=rows=>rows.sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  history=sort(history);forecast=sort(forecast);actual=sort(actual);
  if(["wind","rain","temperature","wave"].includes(layer)&&forecast.length){
    const latest=history[history.length-1];
    const anchor=latest?{...latest,time:new Date(Math.max(Date.now(),Date.parse(latest.time))).toISOString(),kind:"estimated-anchor"}:null;
    forecast=interpolateRows(forecast,Date.now(),end,anchor);
  }
  return {history,forecast,actual,start,end};
}
function chartValueText(layer,v){
  if(num(v)===null)return "-";
  const d=layer==="temperature"?1:layer==="wind"||layer==="convective"?0:2;
  return fmt(v,d)+" "+INTRADAY_META[layer].unit;
}
function intradayTip(r,label,layer){
  const payload={
    time:localTime(r.time),
    label,
    value:chartValueText(layer,r.value),
    high:num(r.high)!==null?chartValueText(layer,r.high):null,
    period:num(r.period_s)!==null?fmt(r.period_s,1)+" s":null,
    interpolation:r.display_interpolated?("Điểm hiển thị nội suy từ mốc mô hình "+fmt(r.source_interval_hours,0)+"h; không tăng độ phân giải nguồn"):null,
    reference:r.reference_mode==="NEAREST_MARINE_SERIES"
      ?("Tham chiếu biển "+(critical?.points?.[r.reference_point]?.name||r.reference_point||"-")+
        (num(r.reference_distance_km)!==null?" · cách ô biển ~"+fmt(r.reference_distance_km,1)+" km":""))
      :null
  };
  return encodeURIComponent(JSON.stringify(payload));
}
function setIntradayFocus(encoded){
  const box=$("intradayFocus");if(!box)return;
  try{
    const p=typeof encoded==="string"?JSON.parse(decodeURIComponent(encoded)):encoded;
    box.innerHTML='<b>'+esc(p.time||"-")+'</b><span>'+esc(p.label||"")+' · '+esc(p.value||"-")+'</span>'+
      (p.high?'<small>Biên q90 / Hmax: '+esc(p.high)+'</small>':'')+
      (p.period?'<small>Chu kỳ sóng: '+esc(p.period)+'</small>':'')+
      (p.reference?'<small>'+esc(p.reference)+'</small>':'')+
      (p.interpolation?'<small>'+esc(p.interpolation)+'</small>':'');
  }catch{
    box.textContent="Chạm vào một điểm để xem số liệu.";
  }
}
function renderIntradayChart(){
  const svg=$("intradayChart");if(!svg||!critical)return;
  const meta=INTRADAY_META[intradayLayer]||INTRADAY_META.wind;
  const panel=document.querySelector(".intraday-panel");
  if(panel)panel.dataset.layer=intradayLayer;
  svg.dataset.layer=intradayLayer;
  renderIntradaySignal();
  $("intradayTitle").textContent=meta.title+" - "+(point().name||current);
  $("intradayNote").textContent=meta.note;
  document.querySelectorAll("[data-intraday]").forEach(b=>b.classList.toggle("active",b.dataset.intraday===intradayLayer));

  const data=chartDataset(intradayLayer);
  const all=[...data.history,...data.forecast,...data.actual];
  if(!all.length){
    svg.setAttribute("viewBox","0 0 960 270");
    svg.innerHTML='<text x="480" y="135" text-anchor="middle" class="chart-empty">Chưa đủ chuỗi 72 giờ cho layer này tại point đang chọn.</text>';
    $("intradayLegend").innerHTML="";
    $("intradayFocus").textContent="Chưa có chuỗi dữ liệu phù hợp.";
    $("intradayMeta").textContent="72 giờ tới · Giờ Phú Quốc UTC+7";
    return;
  }

  const W=960,H=270,L=54,R=20,T=22,B=48,CW=W-L-R,CH=H-T-B;
  svg.setAttribute("viewBox","0 0 "+W+" "+H);
  const values=all.flatMap(r=>[r.value,r.high]).filter(v=>num(v)!==null).map(Number);
  let ymin=Math.min(...values),ymax=Math.max(...values);
  if(["wind","rain","wave","convective"].includes(intradayLayer))ymin=0;
  if(intradayLayer==="convective")ymax=100;
  else if(intradayLayer==="temperature"){ymin=Math.floor(ymin-1);ymax=Math.ceil(ymax+1)}
  else if(intradayLayer==="tide"){const pad=Math.max(.05,(ymax-ymin)*.14);ymin-=pad;ymax+=pad}
  else ymax=Math.max(ymin+.1,ymax*1.14+.05);
  if(ymax<=ymin)ymax=ymin+1;

  const x=time=>{
    const tt=Date.parse(time);if(!Number.isFinite(tt))return L;
    return L+clamp((tt-data.start)/(data.end-data.start),0,1)*CW;
  };
  const xMs=tt=>L+clamp((tt-data.start)/(data.end-data.start),0,1)*CW;
  const y=value=>T+(ymax-Number(value))/(ymax-ymin)*CH;
  const poly=rows=>rows.map(r=>x(r.time).toFixed(1)+","+y(r.value).toFixed(1)).join(" ");
  let out="";

  for(let i=0;i<=4;i++){
    const yy=T+i*CH/4,val=ymax-i*(ymax-ymin)/4;
    out+='<line x1="'+L+'" y1="'+yy.toFixed(1)+'" x2="'+(W-R)+'" y2="'+yy.toFixed(1)+'" class="chart-grid"/>';
    out+='<text x="'+(L-8)+'" y="'+(yy+3).toFixed(1)+'" text-anchor="end" class="chart-axis-label">'+esc(fmt(val,intradayLayer==="wind"||intradayLayer==="convective"?0:1))+'</text>';
  }

  const firstMidnight=localMidnightMs(data.start);
  for(let t=firstMidnight;t<=data.end;t+=12*H1){
    if(t<data.start-30*60*1000)continue;
    const xx=xMs(t),lab=localTickLabel(t);
    out+='<line x1="'+xx.toFixed(1)+'" y1="'+T+'" x2="'+xx.toFixed(1)+'" y2="'+(H-B)+'" class="chart-time-grid"/>';
    out+='<text x="'+xx.toFixed(1)+'" y="'+(H-25)+'" text-anchor="middle" class="chart-axis-date">'+esc(lab.date)+'</text>';
    out+='<text x="'+xx.toFixed(1)+'" y="'+(H-10)+'" text-anchor="middle" class="chart-axis-label">'+esc(lab.time)+'</text>';
  }

  const renderHit=(r,key,label)=>{
    const xx=x(r.time),yy=y(r.value),tip=intradayTip(r,label,intradayLayer);
    return '<circle cx="'+xx.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="11" class="chart-hit" data-tip="'+tip+'" data-key="'+key+'"/>';
  };

  if(intradayLayer==="rain"){
    const bars=[...data.history,...data.forecast];
    bars.forEach((r,i)=>{
      const xx=x(r.time),yy=y(r.value),base=y(0),bw=r.kind==="forecast"?13:9;
      const label=r.kind==="forecast"?"Dự báo q50":"Ước tính hiện tại",tip=intradayTip(r,label,intradayLayer),key="r"+i;
      out+='<rect x="'+(xx-bw/2).toFixed(1)+'" y="'+Math.min(yy,base).toFixed(1)+'" width="'+bw+'" height="'+Math.max(2,Math.abs(base-yy)).toFixed(1)+'" rx="2" class="chart-bar '+(r.kind==="forecast"?"forecast":"")+'" data-key="'+key+'"/>';
      if(num(r.high)!==null){
        const hy=y(r.high);
        out+='<line x1="'+(xx-7).toFixed(1)+'" y1="'+hy.toFixed(1)+'" x2="'+(xx+7).toFixed(1)+'" y2="'+hy.toFixed(1)+'" class="chart-q90-cap"/>';
      }
      out+='<rect x="'+(xx-12).toFixed(1)+'" y="'+T+'" width="24" height="'+CH+'" class="chart-hit-rect" data-tip="'+tip+'" data-key="'+key+'"/>';
    });
  }else{
    if(data.forecast.length>1&&data.forecast.some(r=>num(r.high)!==null)){
      const upper=data.forecast.map(r=>({time:r.time,value:num(r.high)??r.value}));
      const polygon=[...upper,...[...data.forecast].reverse()].map(r=>x(r.time).toFixed(1)+","+y(r.value).toFixed(1)).join(" ");
      out+='<polygon points="'+polygon+'" class="chart-band"/>';
    }
    if(data.history.length>1)out+='<polyline points="'+poly(data.history)+'" class="chart-history"/>';
    if(data.forecast.length>1)out+='<polyline points="'+poly(data.forecast)+'" class="chart-forecast"/>';
    data.history.forEach((r,i)=>{
      const key="h"+i,label=intradayLayer==="wave"?"Mô hình":"Estimated Now";
      out+='<circle cx="'+x(r.time).toFixed(1)+'" cy="'+y(r.value).toFixed(1)+'" r="3.8" class="chart-point" data-key="'+key+'"/>'+renderHit(r,key,label);
    });
    data.forecast.forEach((r,i)=>{
      const key="f"+i,label=intradayLayer==="tide"?"Triều mô hình":intradayLayer==="wave"?"Sóng mô hình":r.model_only?"Mô hình dự phòng":"Dự báo q50";
      out+='<circle cx="'+x(r.time).toFixed(1)+'" cy="'+y(r.value).toFixed(1)+'" r="4" class="chart-point forecast" data-key="'+key+'"/>'+renderHit(r,key,label);
    });
    if(intradayLayer==="tide"){
      tideExtrema(data.forecast).forEach((r,i)=>{
        const xx=x(r.time),yy=y(r.value),high=r.extreme==="HIGH",lab=localTickLabel(Date.parse(r.time));
        const label=(high?"Triều cao ":"Triều thấp ")+lab.time;
        const tip=intradayTip(r,label,intradayLayer),key="tide-ext-"+i;
        out+='<circle cx="'+xx.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="5.5" class="tide-extreme '+(high?"high":"low")+'" data-key="'+key+'"/>';
        out+='<text x="'+xx.toFixed(1)+'" y="'+(yy+(high?-10:15)).toFixed(1)+'" text-anchor="middle" class="tide-extreme-label '+(high?"high":"low")+'">'+esc((high?"Cao ":"Thấp ")+lab.time)+'</text>';
        out+='<circle cx="'+xx.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="13" class="chart-hit" data-tip="'+tip+'" data-key="'+key+'"/>';
      });
    }
    data.actual.forEach((r,i)=>{
      const key="a"+i,label=(r.source||"ACTUAL")+" ACTUAL";
      out+='<circle cx="'+x(r.time).toFixed(1)+'" cy="'+y(r.value).toFixed(1)+'" r="4.8" class="chart-actual" data-key="'+key+'"/>'+renderHit(r,key,label);
    });
  }

  const nowX=xMs(Date.now());
  out+='<line x1="'+nowX.toFixed(1)+'" y1="'+T+'" x2="'+nowX.toFixed(1)+'" y2="'+(H-B)+'" class="chart-now"/>';
  out+='<text x="'+Math.min(W-R-24,nowX+5).toFixed(1)+'" y="'+(T+11)+'" class="chart-now-label">NOW</text>';
  svg.innerHTML=out;

  const focus=data.history[data.history.length-1]||data.actual[data.actual.length-1]||data.forecast[0];
  if(focus){
    const label=focus.kind==="actual"?"VVPQ đo thực":focus.kind==="forecast_model"?"Mô hình dự phòng":focus.kind==="forecast"?"Dự báo q50":intradayLayer==="wave"?"Mô hình":"Ước tính hiện tại";
    setIntradayFocus(intradayTip(focus,label,intradayLayer));
  }

  const legends=[];
  if(["wind","rain","temperature"].includes(intradayLayer)){
    legends.push('<span><i></i>Ước tính hiện tại</span><span><i class="forecast"></i>Dự báo q50</span><span><i class="q90"></i>Biên q90</span>');
    if(data.actual.length)legends.push('<span><i class="actual"></i>VVPQ ACTUAL</span>');
  }else if(intradayLayer==="convective")legends.push('<span><i></i>Himawari proxy / Local Now</span>');
  else if(intradayLayer==="wave")legends.push('<span><i></i>Hiện tại</span><span><i class="forecast"></i>Mô hình 72 giờ</span><span><i class="q90"></i>Hmax</span>');
  else legends.push('<span><i class="forecast"></i>Triều mô hình</span>');
  $("intradayLegend").innerHTML=legends.join("");
  $("intradayMeta").textContent="0-24h: 1 giờ · 24-72h: 2 giờ · UTC+7 · chạm điểm để xem số";
}

function renderAll(){
  if(!critical)return;
  renderPointTabs();renderStatus();renderHero();renderTodayDecision();renderActual();renderFeedbackPoint();renderMapConvective();renderQuickAlert();renderJoTripForecast();
  if($("deepWeatherDetails")?.open)renderTechnical();
}

async function loadAQI(){
  try{fullAQI=await getFirst(AQI,15*60*1000);renderAQI()}catch(e){console.warn("[Weather V2] AQI",e)}
}
async function loadTide(){
  try{fullTide=await getFirst(TIDE,30*60*1000);renderTide();if(intradayLayer==="tide")renderIntradayChart()}catch(e){
    console.warn("[Weather V2] tide",e);
    const el=$("tideSpark");if(el)el.innerHTML='<text x="300" y="65" text-anchor="middle" fill="#8b9ba5" font-size="10">Chưa tải được chuỗi triều 24h</text>';
  }
}
async function loadNowcast(){
  try{
    const results=await Promise.allSettled(NOWCAST.map(url=>getJSON(url,60*1000)));
    const candidates=results.filter(x=>x.status==="fulfilled")
      .map(x=>x.value).filter(x=>x?.status==="POINT_NUMERIC_READY"&&x?.points);
    if(!candidates.length)throw new Error("No valid nowcast");
    candidates.sort((a,b)=>Date.parse(b.sampled_time||0)-Date.parse(a.sampled_time||0));
    if(!fullNowcast||Date.parse(candidates[0].sampled_time||0)>=Date.parse(fullNowcast.sampled_time||0))
      fullNowcast=candidates[0];
    renderHero();renderTodayDecision();renderMapConvective();renderCurrent();renderCloudMotionTable();renderStatus();renderQuickAlert();refreshActiveMap();
  }catch(e){console.warn("[Weather V2] compact nowcast",e)}
}
async function loadRegionalForecast(){
  try{
    const candidate=await getJSON(JOTRIP_FORECAST,10*60*1000);
    if(engineDashboard&&!forecastCycleCompatible(candidate,engineDashboard)){
      throw new Error("STALE_REGIONAL_FORECAST_CYCLE");
    }
    regionalForecast=candidate;
    refreshSnapshotAuthority();
    const ids=Object.keys(regionalForecast?.regions||{});
    if(!ids.includes(currentRegion))currentRegion=ids[0]||currentRegion;
    renderJoTripForecast();renderStatus();renderQuickAlert();
  }catch(e){
    console.warn("[Weather V2] regional forecast",e);
    $("jotripForecastRows").innerHTML='<tr><td colspan="8"><div class="data-empty"><b>CHƯA TẢI ĐƯỢC DỰ BÁO VÙNG</b><span>Phần quan trắc hiện tại vẫn hoạt động bình thường.</span></div></td></tr>';
  }
}

function mapCandidates(){
  const now=new Date(),base=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),now.getUTCHours(),Math.floor(now.getUTCMinutes()/10)*10);
  return Array.from({length:14},(_,i)=>{
    const d=new Date(base-(i+2)*600000),hh=String(d.getUTCHours()).padStart(2,"0"),mm=String(d.getUTCMinutes()).padStart(2,"0");
    return {url:JMA+"ha1_b13_"+hh+mm+".jpg",time:d.toISOString()};
  });
}
function preloadImage(url){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>resolve(true);
    img.onerror=()=>resolve(false);
    img.src=url+(url.includes("?")?"&":"?")+"t="+Date.now();
  });
}
function stopHimawariLoop(removeMap=false){
  if(himawariLoopTimer)clearInterval(himawariLoopTimer);
  himawariLoopTimer=null;
  if(removeMap&&himawariMap){
    try{himawariMap.remove()}catch{}
    himawariMap=null;
    himawariOverlay=null;
  }
}
async function startHimawariLoop(box,note,statusEl){
  stopHimawariLoop(true);
  himawariLoopPlaying=true;
  const L=await ensureLeaflet();

  box.innerHTML='<div class="himawari-loop himawari-georef"><div id="himawariMap" class="himawari-map" aria-label="Himawari IR Band 13 georeferenced map"></div><div class="himawari-ir-badge">JMA · IR B13 · 99–110°E · 7–16°N</div><div class="himawari-loop-bar"><button id="himawariLoopPlay" type="button" aria-label="Tạm dừng ảnh vệ tinh">❚❚</button><span id="himawariLoopTime">Đang tải chuỗi ảnh...</span><small id="himawariLoopCount"></small></div></div>';

  const candidates=mapCandidates();
  const checked=await Promise.all(candidates.map(async x=>({...x,ok:await preloadImage(x.url)})));
  const frames=checked.filter(x=>x.ok).slice(0,9).reverse();
  const time=$("himawariLoopTime"),count=$("himawariLoopCount"),play=$("himawariLoopPlay");
  if(!frames.length){
    if(note)note.textContent="Chưa tải được chuỗi ảnh Himawari IR trong lần này.";
    if(statusEl){statusEl.textContent="CHƯA TẢI";statusEl.className="badge deferred"}
    return;
  }

  himawariMap=L.map("himawariMap",{
    zoomControl:false,
    attributionControl:true,
    preferCanvas:true,
    minZoom:5,
    maxZoom:10
  });
  himawariMap.createPane("himawariImage");
  himawariMap.getPane("himawariImage").style.zIndex="360";
  himawariMap.createPane("himawariLabels");
  himawariMap.getPane("himawariLabels").style.zIndex="430";
  himawariMap.getPane("himawariLabels").style.pointerEvents="none";

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png?key=cb1_3q98_1_d8112ce70cc7ec9b9276b0a0",{
    subdomains:"abcd",maxZoom:19,opacity:.78,
    attribution:'&copy; OpenStreetMap &copy; CARTO'
  }).addTo(himawariMap);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png?key=cb1_3q98_1_d8112ce70cc7ec9b9276b0a0",{
    subdomains:"abcd",maxZoom:19,pane:"himawariLabels",opacity:.90
  }).addTo(himawariMap);

  let i=0;
  himawariOverlay=L.imageOverlay(frames[0].url+"?t="+Date.now(),HIMAWARI_HA1_BOUNDS,{
    pane:"himawariImage",
    opacity:.78,
    interactive:false,
    crossOrigin:false
  }).addTo(himawariMap);

  L.circleMarker([10.2172,103.9593],{
    radius:4,weight:2,color:"#fff",fillColor:"#f0b741",fillOpacity:1
  }).bindTooltip("Phú Quốc",{permanent:false,direction:"top"}).addTo(himawariMap);

  himawariMap.fitBounds([[8.9,102.45],[11.55,105.45]],{padding:[8,8],animate:false});
  setTimeout(()=>himawariMap?.invalidateSize(),80);

  const show=()=>{
    const f=frames[i];
    if(himawariOverlay)himawariOverlay.setUrl(f.url+"?t="+Date.now());
    if(time)time.textContent=new Date(f.time).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",hour12:false});
    if(count)count.textContent=(i+1)+"/"+frames.length;
  };
  const tick=()=>{if(!himawariLoopPlaying)return;i=(i+1)%frames.length;show()};
  show();
  himawariLoopTimer=setInterval(tick,1800);
  play?.addEventListener("click",()=>{
    himawariLoopPlaying=!himawariLoopPlaying;
    play.textContent=himawariLoopPlaying?"❚❚":"▶";
    play.setAttribute("aria-label",himawariLoopPlaying?"Tạm dừng ảnh vệ tinh":"Chạy ảnh vệ tinh");
  });

  if(note)note.textContent="Himawari IR B13 · JMA High-Resolution Asia 1 được đặt theo đúng phạm vi công bố 99–110°E, 7–16°N. Phú Quốc nằm đúng trên nền bản đồ để đối chiếu mây, không dùng crop/marker ước lượng.";
  if(statusEl){statusEl.textContent="GẦN-LIVE";statusEl.className="badge remote"}
}
function ensureLeaflet(){
  if(window.L)return Promise.resolve(window.L);
  if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-leaflet]')){
      const link=document.createElement("link");
      link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";link.dataset.leaflet="1";
      document.head.appendChild(link);
    }
    const existing=document.querySelector('script[data-leaflet]');
    if(existing){
      existing.addEventListener("load",()=>resolve(window.L),{once:true});
      existing.addEventListener("error",reject,{once:true});
      return;
    }
    const script=document.createElement("script");
    script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async=true;script.dataset.leaflet="1";
    script.onload=()=>window.L?resolve(window.L):reject(new Error("Leaflet unavailable"));
    script.onerror=()=>reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}
function pointCoords(id,p){
  const fallback={
    duong_dong:[10.2172,103.9593],an_thoi:[10.0191,104.015],ganh_dau:[10.37077,103.84472],
    rach_gia:[10.00677,105.07845],cua_can:[10.292693,103.914799],bai_thom:[10.411765,104.031055],
    ham_ninh:[10.18062,104.04463],bai_sao:[10.0572576,104.0363948]
  };
  const lat=num(p?.local?.reference_lat??p?.lat),lon=num(p?.local?.reference_lon??p?.lon);
  return lat!==null&&lon!==null?[lat,lon]:(fallback[id]||null);
}
function pointMapLevel(p){
  const l=p?.local||{};
  if(!localDataFresh()||!l.available)return -1;
  const rain=num(l.rain_rate_mm_h),wind=num(l.wind_kmh);
  if(rain===null&&wind===null)return -1;
  if((rain!==null&&rain>=7.5)||(wind!==null&&wind>=40))return 3;
  if((rain!==null&&rain>=2.5)||(wind!==null&&wind>=30))return 2;
  if((rain!==null&&rain>=.5)||(wind!==null&&wind>=22))return 1;
  return 0;
}
function pointMapColor(level){
  return level<0?"#a1adb4":["#4c8fae","#d5a62e","#df7e31","#c94e57"][Math.max(0,Math.min(3,level))];
}
function mapPopup(id,p){
  const l=p?.local||{},m=p?.model||{},n=effectiveNowcastFor(id);
  const cloud=cloudStateLabel(n),parts=[];
  if(localDataFresh()&&l.available){
    if(num(l.rain_rate_mm_h)!==null)parts.push("Mưa JoTrip "+fmt(l.rain_rate_mm_h,1)+" mm/h");
    if(num(l.wind_kmh)!==null)parts.push("Gió JoTrip "+fmt(l.wind_kmh,0)+" km/h");
  }
  if(freshEnough(m.marine_sampled_time,210)&&num(m.wave_hs_m)!==null)
    parts.push("Sóng nền mô hình "+fmt(m.wave_hs_m,1)+" m");
  return '<div class="jotrip-map-popup"><b>'+esc(p?.name||id)+'</b>'+
    '<span>'+esc(parts.join(" · ")||"Đang tổng hợp số liệu")+'</span>'+
    '<small>'+esc(cloud.label)+(cloud.detail?" · "+esc(cloud.detail):"")+'</small></div>';
}
const JOTRIP_SCENE_URL="/weather/weather-scene-v3.html?embed=1&integrated=1&v=20260922-fresh2";
async function renderJoTripMap(){
  const box=$("mapBox"),note=$("mapNote"),state=$("mapState");
  if(!box)return;
  const existing=box.querySelector('iframe[data-jotrip-scene]');
  if(existing){
    if(existing.getAttribute("src")!==JOTRIP_SCENE_URL)existing.setAttribute("src",JOTRIP_SCENE_URL);
    box.classList.add("jotrip-scene-active");
    if(state){state.textContent="LIVE";state.className="badge actual"}
    return;
  }
  if(jotripMap){try{jotripMap.remove()}catch{} jotripMap=null}
  box.classList.add("jotrip-scene-active");
  box.innerHTML='<iframe data-jotrip-scene title="JoTrip Weather Scene - Phú Quốc" loading="eager" referrerpolicy="strict-origin-when-cross-origin" src="'+JOTRIP_SCENE_URL+'"></iframe>';
  const frame=box.firstChild;
  frame.onload=()=>{
    if(state){state.textContent="LIVE";state.className="badge actual"}
    if(note)note.textContent="Chọn Mây, Mưa, Gió hoặc Sóng ngay trên bản đồ. Kéo timeline để xem diễn biến theo thời gian; chạm bản đồ để đọc số tại điểm chọn.";
  };
  frame.onerror=()=>{
    if(state){state.textContent="CHƯA TẢI";state.className="badge deferred"}
    if(note)note.textContent="Chưa tải được Bản đồ JoTrip trong lần này. Các số liệu và phần dự báo khác của trang vẫn hoạt động bình thường.";
  };
}

function setMap(type){
  stopHimawariLoop(true);
  mapLayer=type;
  document.querySelectorAll("[data-map]").forEach(b=>b.classList.toggle("active",b.dataset.map===type));
  if(!mapStarted)return;
  const box=$("mapBox"),note=$("mapNote"),state=$("mapState");
  if(jotripMap&&type!=="jotrip"){try{jotripMap.remove()}catch{} jotripMap=null}
  if(type!=="jotrip") box?.classList.remove("jotrip-scene-active");
  if(state){state.textContent="ĐANG TẢI";state.className="badge deferred"}
  if(type==="jotrip"){renderJoTripMap();return}
  if(type==="himawari"){
    startHimawariLoop(box,note,state).catch(e=>{
      console.warn("[Weather V2] Himawari loop",e);
      note.textContent="Chưa tải được chuỗi ảnh Himawari trong lần này.";
      state.textContent="CHƯA TẢI";state.className="badge deferred";
    });
    return;
  }
  box.innerHTML='<iframe title="Weather map" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  const frame=box.firstChild;
  frame.onload=()=>{state.textContent="SẴN SÀNG";state.className=type==="radar"?"badge remote":"badge model"};
  frame.src=WINDY[type]||WINDY.radar;
  const notes={
    radar:"Radar quan trắc được giữ nguyên để đối chiếu vùng mưa đang xuất hiện quanh đảo.",
    wind:"Windy - lớp gió được giữ nguyên để đối chiếu cấu trúc gió với JoTrip Local Now.",
    rain:"Windy - mưa dự báo được giữ nguyên để đối chiếu với VRain, Local Now và Dự báo JoTrip.",
    waves:"Windy - sóng được giữ nguyên để đối chiếu với lớp biển của JoTrip."
  };
  note.textContent=notes[type]||notes.radar;
}
function refreshActiveMap(){
  if(!mapStarted)return;
  if(mapLayer==="jotrip")return;
  if(mapLayer==="himawari"){setMap("himawari")}
}
function startMap(){
  if(mapStarted)return;
  mapStarted=true;
  setMap(mapLayer);
}
function installMapObserver(){
  const target=document.querySelector(".map-panel");
  if(!target)return;
  if(!("IntersectionObserver" in window)){defer(startMap,1200);return}
  const ob=new IntersectionObserver(entries=>{
    if(entries.some(e=>e.isIntersecting)){startMap();ob.disconnect()}
  },{rootMargin:"500px 0px"});
  ob.observe(target);
}

async function sendFeedbackRemote(item){
  const response=await fetch(FEEDBACK_ENDPOINT,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(item),
    cache:"no-store",
    keepalive:true
  });
  if(!response.ok)throw new Error("feedback_http_"+response.status);
  let body={};
  try{body=await response.json()}catch{}
  return body;
}
function readFeedbackQueue(){
  try{
    const q=JSON.parse(localStorage.getItem(FEEDBACK_QUEUE_KEY)||"[]");
    return Array.isArray(q)?q:[];
  }catch{return []}
}
function writeFeedbackQueue(q){
  localStorage.setItem(FEEDBACK_QUEUE_KEY,JSON.stringify((q||[]).slice(-100)));
}
function feedbackCategoryFromRecord(x){
  const direct=String(x?.category||"").toUpperCase();
  if(direct)return direct;
  const m=String(x?.note||"").match(/category=([A-Z_]+)/);
  if(m)return m[1];
  if(x?.rain_relation==="higher")return "RAIN_MORE";
  if(x?.rain_relation==="lower")return "RAIN_LESS";
  if(x?.wind_relation==="higher")return "WIND_MORE";
  if(x?.wind_relation==="lower")return "WIND_LESS";
  return null;
}
function localFeedbackHistory(){
  try{
    const rows=JSON.parse(localStorage.getItem(FEEDBACK_HISTORY_KEY)||"[]");
    return Array.isArray(rows)?rows:[];
  }catch{return []}
}
function combinedRecentFeedback(minutes=90){
  const cutoff=Date.now()-minutes*60000;
  const remote=Array.isArray(recentFieldFeedback?.items)?recentFieldFeedback.items:[];
  const local=localFeedbackHistory();
  const seen=new Set(),rows=[];
  [...local,...remote].forEach(x=>{
    const t=Date.parse(x?.observed_at||"");
    if(!Number.isFinite(t)||t<cutoff)return;
    const key=x.id||[x.point_id,x.observed_at,feedbackCategoryFromRecord(x)].join("|");
    if(seen.has(key))return;
    seen.add(key);rows.push(x);
  });
  return rows.sort((a,b)=>Date.parse(b.observed_at||0)-Date.parse(a.observed_at||0));
}
function recentFeedbackFor(pointId,category){
  return combinedRecentFeedback().find(x=>x.point_id===pointId&&feedbackCategoryFromRecord(x)===category)||null;
}
async function loadRecentFeedback(){
  try{recentFieldFeedback=await getJSON(RECENT_FEEDBACK_ENDPOINT,60*1000)}
  catch{recentFieldFeedback=null}
  if(critical){
    renderQuickAlert();
    renderHazardBoard();
    renderCurrent();
    const summary=$("islandSummary");
    if(summary){
      const watches=buildQuickWatchEvents().slice(0,2);
      if(watches.length)summary.innerHTML="<b>Hiện cần chú ý:</b> "+watches.map(x=>esc(x.title)+(x.detail?" - "+esc(x.detail):"")).join("<br>")+"<small>Tin nhanh tự biến mất khi dữ liệu mới cho thấy tình huống đã qua.</small>";
    }
  }
  return recentFieldFeedback;
}
function saveFeedbackHistory(item){
  let h=[];
  try{h=JSON.parse(localStorage.getItem(FEEDBACK_HISTORY_KEY)||"[]")}catch{}
  if(!Array.isArray(h))h=[];
  h.push(item);
  try{localStorage.setItem(FEEDBACK_HISTORY_KEY,JSON.stringify(h.slice(-100)))}catch{}
  return h.length;
}
function queueFeedback(item){
  const q=readFeedbackQueue();
  if(!q.some(x=>x?.id===item.id))q.push(item);
  try{writeFeedbackQueue(q)}catch{}
  return q.length;
}
function dequeueFeedback(id){
  const q=readFeedbackQueue().filter(x=>x?.id!==id);
  try{writeFeedbackQueue(q)}catch{}
  return q.length;
}
function feedbackMessage(message,kind="ok"){
  const state=$("feedbackState"),toast=$("feedbackToast");
  if(state)state.textContent=message;
  if(toast){
    toast.textContent=message;
    toast.classList.remove("error");
    if(kind==="error")toast.classList.add("error");
    toast.classList.add("show");
    clearTimeout(feedbackMessage._timer);
    feedbackMessage._timer=setTimeout(()=>toast.classList.remove("show","error"),2800);
  }
}
async function flushFeedbackQueue(){
  const q=readFeedbackQueue();
  if(!q.length)return {sent:0,pending:0};
  let sent=0;
  for(const item of q){
    try{
      await sendFeedbackRemote(item);
      dequeueFeedback(item.id);
      sent++;
    }catch(e){
      console.warn("[Weather V2] feedback retry",e);
      break;
    }
  }
  return {sent,pending:readFeedbackQueue().length};
}
async function feedback(kind,button){
  const feedbackPoint=current;
  const p=critical?.points?.[feedbackPoint]||point(),l=p.local||{};
  const labels={
    MATCH:"Khớp",
    RAIN_MORE:"Mưa nhiều hơn",
    RAIN_LESS:"Mưa ít hơn",
    WIND_MORE:"Gió mạnh hơn",
    WIND_LESS:"Gió yếu hơn",
    THUNDER:"Có dông"
  };
  const legacy={
    MATCH:{verdict:"accurate",wind_relation:"about",wave_relation:"about",rain_relation:"about"},
    RAIN_MORE:{verdict:"wrong",wind_relation:"unknown",wave_relation:"unknown",rain_relation:"higher"},
    RAIN_LESS:{verdict:"wrong",wind_relation:"unknown",wave_relation:"unknown",rain_relation:"lower"},
    WIND_MORE:{verdict:"wrong",wind_relation:"higher",wave_relation:"unknown",rain_relation:"unknown"},
    WIND_LESS:{verdict:"wrong",wind_relation:"lower",wave_relation:"unknown",rain_relation:"unknown"},
    THUNDER:{verdict:"close",wind_relation:"unknown",wave_relation:"unknown",rain_relation:"unknown"}
  }[kind]||{verdict:"close",wind_relation:"unknown",wave_relation:"unknown",rain_relation:"unknown"};
  const item={
    schema_version:"1.2",
    id:(globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now()),
    observed_at:isoUTC7(),
    point_id:feedbackPoint,
    point_name:p.name||feedbackPoint,
    category:kind,
    category_label:labels[kind]||kind,
    verdict:legacy.verdict,
    wind_relation:legacy.wind_relation,
    wave_relation:legacy.wave_relation,
    rain_relation:legacy.rain_relation,
    evidence_type:"field_observation",
    evidence_class:"FIELD_FEEDBACK_UNVERIFIED",
    accepted_as_ground_truth:false,
    engine:critical?.source_state?.local_engine||"PQ_LOCAL_NOW_V2",
    snapshot_id:critical?.snapshot_id||null,
    source_cycles:critical?.source_cycles||null,
    estimate:{
      temperature_c:l.temperature_c,
      wind_kmh:l.wind_kmh,
      rain_rate_mm_h:l.rain_rate_mm_h,
      rain_confidence:l.rain_confidence,
      wave_hs_m:p?.marine?.wave_hs_m??null
    }
  };

  saveFeedbackHistory(item);
  const pending=queueFeedback(item);

  document.querySelectorAll("[data-feedback]").forEach(b=>b.classList.toggle("selected",b===button));
  if(button){
    button.setAttribute("aria-pressed","true");
    setTimeout(()=>{button.classList.remove("selected");button.removeAttribute("aria-pressed")},1600);
  }
  if(navigator.vibrate)navigator.vibrate(25);

  feedbackMessage("Đang gửi phản hồi về JoTrip...");
  try{
    await sendFeedbackRemote(item);
    const left=dequeueFeedback(item.id);
    feedbackMessage("Đã gửi về JoTrip · "+(labels[kind]||kind)+" · "+(p.name||feedbackPoint)+(left?" · còn "+left+" phản hồi chờ gửi":""));
    flushFeedbackQueue();
  }catch(e){
    console.warn("[Weather V2] feedback send",e);
    feedbackMessage("Đã lưu trên thiết bị · sẽ tự gửi lại khi có mạng ("+pending+" chờ gửi)");
  }
}
function shareWeather(){
  const shareUrl="https://cms.openphuquoc.com/weather/";
  const data={title:"JoTrip Weather - Phú Quốc",text:"Theo dõi thời tiết hiện tại, biển, chất lượng không khí và Dự báo JoTrip 10 ngày cho Phú Quốc.",url:shareUrl};
  if(navigator.share){navigator.share(data).catch(()=>{})}
  else if(navigator.clipboard){navigator.clipboard.writeText(shareUrl).then(()=>{const b=$("shareWeather");if(b)b.textContent="Đã sao chép link"})}
}
function setDismissedPanel(id,dismissed){
  const target=document.getElementById(id||"");
  if(!target)return;
  target.hidden=Boolean(dismissed);
  document.querySelectorAll("[data-open-target]").forEach(btn=>{
    if(btn.dataset.openTarget===id)btn.hidden=!dismissed;
  });
}
function events(){
  document.addEventListener("click",e=>{
    const close=e.target.closest("[data-close-target]");
    if(close){
      setDismissedPanel(close.dataset.closeTarget||"",true);
      return;
    }
    const open=e.target.closest("[data-open-target]");
    if(open){
      setDismissedPanel(open.dataset.openTarget||"",false);
    }
  });
  document.addEventListener("keydown",e=>{
    if(e.key!=="Escape")return;
    const target=[...document.querySelectorAll("[data-esc-close]")].find(el=>!el.hidden);
    if(target)setDismissedPanel(target.id,true);
  });
  $("technicalPointTabs")?.addEventListener("click",e=>{
    const b=e.target.closest("[data-technical-point]");if(!b)return;
    current=b.dataset.technicalPoint;
    const linkedRegion=regionForPoint(current);if(linkedRegion)currentRegion=linkedRegion;
    renderAll();renderForecastDayDetail();refreshActiveMap();
  });
  $("pointTabs")?.addEventListener("click",e=>{
    const compare=e.target.closest("[data-compare]");
    if(compare?.dataset.compare==="ha_tien"){
      startMap();setMap("jotrip");
      document.querySelector(".command-center")?.scrollIntoView({behavior:"smooth",block:"start"});
      return;
    }
    const b=e.target.closest("[data-point]");if(!b)return;
    current=b.dataset.point;
    const linkedRegion=regionForPoint(current);if(linkedRegion)currentRegion=linkedRegion;
    renderAll();renderForecastDayDetail();refreshActiveMap();
  });
  document.querySelectorAll("[data-map]").forEach(b=>b.addEventListener("click",()=>{startMap();setMap(b.dataset.map)}));
  $("intradayTabs")?.addEventListener("click",e=>{
    const b=e.target.closest("[data-intraday]");if(!b)return;
    intradayLayer=b.dataset.intraday||"wind";
    renderIntradayChart();
  });
  $("intradayChart")?.addEventListener("click",e=>{
    const el=e.target.closest("[data-tip]");if(!el)return;
    const key=el.dataset.key;
    document.querySelectorAll("#intradayChart [data-key]").forEach(node=>node.classList.toggle("selected",Boolean(key)&&node.dataset.key===key));
    setIntradayFocus(el.dataset.tip||"");
  });
  const scrollForecastDays=dir=>{
    const ribbon=$("forecastDayRibbon");if(!ribbon)return;
    const card=ribbon.querySelector(".forecast-day");
    const step=(card?.getBoundingClientRect().width||150)+10;
    ribbon.scrollBy({left:dir*step*2,behavior:"smooth"});
  };
  $("forecastDayPrev")?.addEventListener("click",()=>scrollForecastDays(-1));
  $("forecastDayNext")?.addEventListener("click",()=>scrollForecastDays(1));
  $("forecastDayRibbon")?.addEventListener("wheel",e=>{
    if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;
    const ribbon=e.currentTarget;
    if(ribbon.scrollWidth<=ribbon.clientWidth)return;
    e.preventDefault();
    ribbon.scrollLeft+=e.deltaY;
  },{passive:false});
  $("forecastDayRibbon")?.addEventListener("click",e=>{
    const card=e.target.closest("[data-forecast-day]");if(!card)return;
    toggleForecastDay(card.dataset.forecastDay);
  });
  $("forecastDayRibbon")?.addEventListener("keydown",e=>{
    if(!["Enter"," "].includes(e.key))return;
    const card=e.target.closest("[data-forecast-day]");if(!card)return;
    e.preventDefault();toggleForecastDay(card.dataset.forecastDay);
  });
  $("forecastDayDetailClose")?.addEventListener("click",()=>{
    selectedForecastDayKey=null;renderJoTripForecast();renderForecastDayDetail();
  });
  $("forecastRegionTabs")?.addEventListener("click",e=>{
    const b=e.target.closest("[data-region]");if(!b)return;
    currentRegion=b.dataset.region;renderJoTripForecast();
  });
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-feedback]");
    if(!b)return;
    e.preventDefault();
    feedback(b.dataset.feedback,b);
  });
  $("deepWeatherDetails")?.addEventListener("toggle",e=>{
    if(e.currentTarget.open){
      renderTechnical();
      Promise.allSettled([loadTide(),loadAQI()]).then(()=>renderTechnical());
    }
  });
  $("shareWeather")?.addEventListener("click",shareWeather);
}

function registerWeatherWorker(){/* CMS owns the site service-worker scope. */}
async function refreshLive(){
  if(liveRefreshBusy)return;
  liveRefreshBusy=true;
  try{
    const next=await getCriticalWithFreshLocal();
    critical=next;
    if(!critical?.points?.[current])current=critical.default_point||"duong_dong";
    renderAll();
    refreshActiveMap();
    lastLiveRefreshAt=Date.now();
    const jobs=[loadEngineDashboard(),loadRegionalForecast(),loadRecentFeedback(),loadNowcast()];
    if($("deepWeatherDetails")?.open)jobs.push(loadTide(),loadAQI());
    await Promise.allSettled(jobs);
  }catch(e){
    console.warn("[Weather V2] live refresh",e);
    renderStatus();
    setTimeout(()=>{if(document.visibilityState==="visible")refreshLive()},60000);
  }finally{
    liveRefreshBusy=false;
  }
}
async function boot(){
  registerWeatherWorker();
  events();
  try{
    critical=await getCriticalWithFreshLocal();
    current=critical.default_point||"duong_dong";
    currentRegion=regionForPoint(current)||currentRegion;
    lastLiveRefreshAt=Date.now();
    renderAll();
    installMapObserver();
    defer(loadEngineDashboard,120);
    if(!fullNowcast)defer(loadNowcast,450);
    defer(loadRegionalForecast,620);
    defer(loadRecentFeedback,850);
    setInterval(()=>{renderStatus();renderHero();renderTodayDecision();renderQuickAlert()},60000);
    setInterval(refreshLive,LIVE_REFRESH_MS);
    // Re-evaluate the forecast publication gate even if the network is down;
    // never leave an old "favorable" card visible after it expires.
    setInterval(()=>{if(document.visibilityState==="visible")renderTodayDecision()},60000);
    setInterval(()=>{if(mapLayer==="himawari"&&document.visibilityState==="visible")refreshActiveMap()},10*60*1000);
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible"&&Date.now()-lastLiveRefreshAt>5*60*1000)refreshLive();
    });
    window.addEventListener("online",()=>{
      if(Date.now()-lastLiveRefreshAt>2*60*1000)refreshLive();
      flushFeedbackQueue();
    });
    setTimeout(flushFeedbackQueue,1800);
    setInterval(flushFeedbackQueue,5*60*1000);
  }catch(e){
    $("heroSummary").textContent="Không tải được dữ liệu ban đầu. Bạn thử tải lại trang giúp mình.";
    $("liveLabel").textContent="LỖI DỮ LIỆU";$("liveDot").className="warn";
    console.error(e);
  }
}
boot();
})();
