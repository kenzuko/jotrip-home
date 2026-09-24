(() => {
"use strict";
const NOTICES="data/operational-notices.json";
const SUPPORT="data/home-support.json",PLACES="data/entities/places.json",ACTIVITIES="data/entities/activities.json",UTILITIES="data/entities/utilities.json",STORIES="data/content.json",CURRENCY="data/currency-snapshot.json";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const stateText={OPEN:"Đang mở",CLOSED:"Đã đóng",TEMPORARILY_CLOSED:"Tạm đóng",UNKNOWN:"Chưa biết chắc"};
const liveStateText={normal:"Hôm nay hoạt động bình thường",good:"Hôm nay hoạt động bình thường",watch:"Có điều nên xem lại",advisory:"Có lưu ý",bad:"Tạm dừng",unknown:"Chưa biết chắc",info:"Theo giờ hôm nay"};
let operationalNotices=null,support=null,currencyPayload=null,entities=new Map(),stories=new Map(),selectedCategory=null,selectedArea=null,position=null,nearBound=false,utilitiesLoaded=false;
function vnParts(date=new Date()){const d=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"long",day:"2-digit",month:"2-digit"}).format(date).replace(",","");const t=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).format(date);return{time:t,date:d}}
function ageText(iso){
  const t=Date.parse(iso||"");
  if(!Number.isFinite(t))return"Chưa biết lần cập nhật gần nhất";
  const m=Math.max(0,(Date.now()-t)/60000);
  if(m<2)return"Vừa cập nhật";
  if(m<60)return Math.round(m)+" phút trước";
  const h=Math.floor(m/60);
  if(h<24)return h===1?"Hơn 1 giờ trước":"Hơn "+h+" giờ trước";
  return Math.floor(h/24)===1?"Hôm qua":Math.floor(h/24)+" ngày trước";
}
function hhmmToMinutes(value){const m=String(value||"").match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):NaN}
function scheduleSummary(opening){if(!opening)return"Chưa có giờ rõ ràng";if(opening.state==="NEEDS_VERIFICATION")return"Giờ hôm nay chưa chắc, nên xem lại trước khi đi";if(opening.schedule_type==="FIXED_START"&&(opening.times||[]).length)return(opening.times||[]).map(x=>x.start+(x.label?" · "+x.label:"")).join(" · ");const windows=(opening.windows||[]).filter(x=>x.start&&x.end);if(!windows.length)return"Chưa có giờ rõ ràng";const prefix=opening.state==="APPROXIMATE_SCHEDULE"?"Khoảng ":"";return prefix+windows.map(x=>x.start+"-"+x.end).join(" · ")}
function scheduleDecision(opening){
  if(!opening||!["PUBLISHED_SCHEDULE","APPROXIMATE_SCHEDULE"].includes(opening.state)){
    return{state:"unknown",label:"Chưa biết chắc giờ hôm nay",detail:"Bấm vào để xem giờ và lưu ý gần nhất"};
  }
  const dayName=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short"}).format(new Date());
  const dayIndex=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(dayName);
  if((opening.closed_weekdays||[]).includes(dayIndex))return{state:"past",label:"Hôm nay nghỉ",detail:"Không cần chạy tới nhé"};
  const now=hhmmToMinutes(vnParts().time),approx=opening.state==="APPROXIMATE_SCHEDULE";
  const detail=approx?"Giờ có thể xê dịch một chút":"Giờ hôm nay";
  if(opening.schedule_type==="FIXED_START"&&(opening.times||[]).length){
    const times=(opening.times||[]).map(x=>({...x,startMin:hhmmToMinutes(x.start)})).filter(x=>Number.isFinite(x.startMin)).sort((a,b)=>a.startMin-b.startMin);
    const next=times.find(x=>now<x.startMin);
    if(next)return{state:"future",label:"Bắt đầu lúc "+next.start,detail,nextMin:next.startMin};
    return{state:"past",label:"Đã qua giờ hôm nay",detail};
  }
  const windows=(opening.windows||[]).map(x=>({...x,startMin:hhmmToMinutes(x.start),endMin:hhmmToMinutes(x.end)})).filter(x=>Number.isFinite(x.startMin)&&Number.isFinite(x.endMin)).sort((a,b)=>a.startMin-b.startMin);
  if(!windows.length)return{state:"unknown",label:"Chưa biết chắc giờ hôm nay",detail:"Bấm vào để xem giờ và lưu ý gần nhất"};
  const active=windows.find(x=>now>=x.startMin&&now<=x.endMin);
  if(active)return{state:"active",label:"Đi lúc này vẫn kịp",detail,startMin:active.startMin,endMin:active.endMin,remainingMin:active.endMin-now};
  const next=windows.find(x=>now<x.startMin);
  if(next)return{state:"future",label:(approx?"Thường bắt đầu khoảng ":"Mở từ ")+next.start,detail,nextMin:next.startMin,endMin:next.endMin};
  return{state:"past",label:"Hôm nay đã qua giờ",detail};
}
function scheduleFreshness(opening){if(!opening?.verified_at)return"Chưa rõ lần cập nhật gần nhất";return ageText(opening.verified_at)}
function localSunsetPhuQuoc(date=new Date()){const lat=10.2172,lon=103.9593,tz=7;const d=new Date(date.getTime()+tz*3600000);const start=Date.UTC(d.getUTCFullYear(),0,0);const day=Math.floor((Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-start)/86400000);const lngHour=lon/15;const t=day+((18-lngHour)/24);const M=(0.9856*t)-3.289;let L=M+(1.916*Math.sin(M*Math.PI/180))+(0.020*Math.sin(2*M*Math.PI/180))+282.634;L=(L+360)%360;let RA=Math.atan(0.91764*Math.tan(L*Math.PI/180))*180/Math.PI;RA=(RA+360)%360;RA=RA+(Math.floor(L/90)*90-Math.floor(RA/90)*90);RA/=15;const sinDec=0.39782*Math.sin(L*Math.PI/180);const cosDec=Math.cos(Math.asin(sinDec));const cosH=(Math.cos(90.833*Math.PI/180)-(sinDec*Math.sin(lat*Math.PI/180)))/(cosDec*Math.cos(lat*Math.PI/180));if(cosH>1||cosH<-1)return"—";let H=Math.acos(cosH)*180/Math.PI;H/=15;const T=H+RA-(0.06571*t)-6.622;let UT=(T-lngHour)%24;if(UT<0)UT+=24;let local=(UT+tz)%24;const hh=Math.floor(local),mm=Math.round((local-hh)*60);const H2=(hh+(mm===60?1:0))%24,M2=mm===60?0:mm;return String(H2).padStart(2,"0")+":"+String(M2).padStart(2,"0")}
function renderClock(){const p=vnParts();if($("#tripClockNow"))$("#tripClockNow").textContent=p.time;if($("#tripClockDate"))$("#tripClockDate").textContent=p.date;const sunset=$("#tripClockSunset");if(sunset)sunset.textContent=localSunsetPhuQuoc()}
function durationMin(value){
  const s=String(value||"").toLowerCase();
  const range=s.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(giờ|phút)/);
  if(range){const n=Number(range[1].replace(",","."));return range[3]==="giờ"?n*60:n}
  const one=s.match(/(\d+(?:[.,]\d+)?)\s*(giờ|phút)/);
  if(one){const n=Number(one[1].replace(",","."));return one[2]==="giờ"?n*60:n}
  return null;
}
function applyPracticalStartCutoff(item,decision,now){
  const cutoff=hhmmToMinutes(item?.latest_sensible_start);
  if(!Number.isFinite(cutoff)||now<cutoff)return{decision,hidden:false};
  if(!["active","future"].includes(decision?.state))return{decision,hidden:false};
  const lateDecision={
    ...decision,
    state:"past",
    label:item.late_label||"Giờ này bắt đầu sẽ hơi muộn",
    detail:item.late_detail||"Để mai đi sẽ thoải mái hơn",
    practicalCutoff:true
  };
  return{decision:lateDecision,hidden:item.hide_after_sensible_start===true};
}
function localDateKey(date=new Date()){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+"-"+p.month+"-"+p.day;
}
function activeNotices(){const day=localDateKey();return (operationalNotices?.notices||[]).filter(x=>x.date===day&&x.status==="CANCELLED")}
function activeNotice(id){return activeNotices().find(x=>x.entity_id===id)||null}
function cancellationCards(){
 return activeNotices().map(x=>
  '<a class="trip-cancel-notice" role="status" href="places/detail.html?id=tinh-hoa-viet-nam">'+
  '<span>THÔNG BÁO SUẤT DIỄN HÔM NAY</span><strong>'+esc(x.title)+'</strong>'+
  '<p>'+esc(x.summary)+'</p><small>'+esc(x.booking_message)+'</small><b>Xem thông tin →</b></a>'
 ).join("");
}
const noticeStyle=document.createElement("style");
noticeStyle.textContent=".trip-cancel-notice{display:block;padding:17px 19px;margin-bottom:12px;border:2px solid #c96e34;border-radius:17px;background:#fff6ea;color:#623518;text-decoration:none}.trip-cancel-notice span{display:block;color:#9a4e18;font-weight:900;font-size:12px;letter-spacing:.04em}.trip-cancel-notice strong{display:block;margin:6px 0;font-size:19px;line-height:1.35}.trip-cancel-notice p{margin:4px 0 8px;line-height:1.55}.trip-cancel-notice small{display:block;font-size:13px;line-height:1.5}.trip-cancel-notice b{display:block;margin-top:9px;color:#87421c}";
document.head.appendChild(noticeStyle);
function tripClockSnapshot(){
 const engine=window.OpenPQTripClockPlanner;
 if(!engine||!support)return [];
 const now=hhmmToMinutes(vnParts().time),sunset=hhmmToMinutes(localSunsetPhuQuoc());
 const weekdayName=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short"}).format(new Date());
 const weekday=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(weekdayName);
 return engine.plan({items:support.trip_clock?.items||[],entities,nowMinute:now,sunsetMinute:sunset,weekday,
  sunsetWeather:window.OPENPQ_HOME?.signals?.sunset_weather?.level||"unknown"}).filter(x=>!activeNotice(x.item.entity_id));
}
function renderTripClock(){
 if(!support)return;
 renderClock();const host=$("#tripClockList");if(!host)return;
 if(!window.OpenPQTripClockPlanner){
  host.innerHTML='<div class="trip-clock-empty"><strong>Gợi ý hôm nay đang được cập nhật.</strong><p>Mở Khám phá để xem giờ từng điểm trước khi đi.</p></div>';
  return;
 }
 const rows=tripClockSnapshot().filter(x=>x.eligible&&["active","future","watch"].includes(x.decision?.state));
 if(!rows.length){
  host.innerHTML=cancellationCards()+'<div class="trip-clock-empty"><strong>Giờ này các điểm chính đã qua khung tham quan phù hợp.</strong><p>Xem các hoạt động buổi tối hoặc lịch ngày mai. Giờ tham khảo không phải xác nhận mở cửa trực tiếp.</p><div><a href="food/">Tìm món ăn →</a><a href="nearme/">Xem quanh đây →</a><a href="explore/">Xem cho ngày mai →</a></div></div>';
  publishLocalNowHint();return;
 }
 let shown=rows.slice(0,9);
 const nextShow=rows.find(x=>x.opening?.schedule_type==="FIXED_START"&&x.decision.state==="future");
 if(nextShow&&!shown.includes(nextShow))shown=[...rows.slice(0,8),nextShow];
 host.innerHTML=cancellationCards()+shown.map(row=>{
  const {item,e,opening,decision,summary,note}=row;
  const detail=opening?.schedule_type==="FIXED_START"?summary:[summary,e.duration].filter(Boolean).join(" · ");
  const distinctNote=note&&note.trim()!==detail.trim()?note:"";
  return '<a class="trip-item" data-decision="'+esc(decision.state)+'" href="'+esc(item.route)+'">'+
   '<span>'+esc(decision.label)+'</span>'+
   '<strong>'+esc(e.name||item.entity_id)+'</strong>'+
   '<p>'+esc(detail)+'</p>'+
   (distinctNote?'<b>'+esc(distinctNote)+'</b>':"")+'</a>';
 }).join("");
 publishLocalNowHint();
}
function buildLocalNowHint(){
 if(!support||!window.OpenPQTripClockPlanner)return null;
 const canceled=activeNotices()[0];
 if(canceled)return{priority:"operational",tone:"watch",title:canceled.title,note:canceled.booking_message,primaryText:"Xem thông báo →",primaryHref:"places/detail.html?id=tinh-hoa-viet-nam",secondaryText:"Chọn hoạt động khác",secondaryHref:"#happening"};
 const now=hhmmToMinutes(vnParts().time),candidates=[];
 for(const x of tripClockSnapshot()){
  if(!x.eligible||!x.decision)continue;
  const name=x.e.name||x.item.entity_id;
  if(x.opening?.schedule_type==="FIXED_START"&&x.decision.state==="future"){
   const delta=x.decision.nextMin-now;
   if(delta>0&&delta<=150)candidates.push({
    score:delta,priority:"deadline",tone:"default",
    title:name+" bắt đầu lúc "+String(Math.floor(x.decision.nextMin/60)).padStart(2,"0")+":"+String(x.decision.nextMin%60).padStart(2,"0"),
    note:name==="ONCE Show"?"ONCE 18:45-19:05 theo lịch; cần vé vào VinWonders.":"Lịch biểu diễn có thể thay đổi; kiểm tra lịch hôm nay.",
    primaryText:"Xem "+name+" →",primaryHref:x.item.route,
    secondaryText:"Xem tối nay",secondaryHref:"#happening"
   });
  }else if(x.item.entity_id==="place_vinpearl_safari"&&now<16*60){
   const left=16*60-now;
   if(left<=150)candidates.push({
    score:100+left,priority:"deadline",tone:"default",
    title:"Safari đóng cửa lúc 16:00",
    note:"Xem thời gian còn lại và giờ nhận khách tại cổng.",
    primaryText:"Xem Safari →",primaryHref:x.item.route,
    secondaryText:"Xem hoạt động khác",secondaryHref:"#happening"
   });
  }else if(x.item.entity_id==="place_vinwonders"&&now<17*60){
   const left=17*60-now;
   if(left<=120)candidates.push({
    score:130+left,priority:"deadline",tone:"default",
    title:"VinWonders: trò chơi dừng khoảng 17:00",
    note:"Sau đó còn show ONCE lúc 18:45 theo lịch.",
    primaryText:"Xem VinWonders →",primaryHref:x.item.route,
    secondaryText:"Xem ONCE",secondaryHref:"places/detail.html?id=once-show"
   });
  }
 }
 return candidates.sort((a,b)=>a.score-b.score)[0]||null;
}
let lastLocalHintKey="";
function publishLocalNowHint(){const hint=buildLocalNowHint(),payload={now_hint:hint,updated_at:new Date().toISOString()};window.OPENPQ_HOME_LOCAL=payload;const key=JSON.stringify(hint||null);if(key!==lastLocalHintKey){lastLocalHintKey=key;window.dispatchEvent(new CustomEvent("openpq:local-ready",{detail:payload}))}}
function liveFor(binding){return binding?window.OPENPQ_HOME?.live_status?.[binding]||null:null}
function renderActivities(){if(!support)return;const host=$("#activityBoard");if(!host)return;host.innerHTML=(support.activity_board||[]).map(item=>{const e=entities.get(item.entity_id)||{},live=liveFor(item.operational_binding),opening=e.opening_hours||null,decision=scheduleDecision(opening);const state=live?.status||(opening?.state==="PUBLISHED_SCHEDULE"?"info":"unknown");const primary=live?(liveStateText[state]||live.primary||"Hôm nay chưa có tin mới"):(opening?.state==="PUBLISHED_SCHEDULE"?decision.label:(stateText[item.status_code]||"Hôm nay chưa có tin mới"));const context=live?.context||live?.secondary||(opening?scheduleSummary(opening):([e.best_time,e.duration].filter(Boolean).join(" · ")||"Mở ra để xem kỹ hơn"));const fresh=live?.source_updated_at?ageText(live.source_updated_at):(opening?scheduleFreshness(opening):"Hôm nay chưa có tin mới");return'<a class="activity-status-card" data-state="'+esc(state)+'" href="'+esc(item.route)+'"><span>'+esc(primary)+'</span><strong>'+esc(e.name||item.entity_id)+'</strong><p>'+esc(context)+'</p><small>'+esc(fresh)+'</small><b>Xem hôm nay →</b></a>'}).join("");const live=window.OPENPQ_HOME?.live_status||{};const bad=live.cano?.status==="bad"||live.weather?.status==="watch";const plan=$("#planBCard");if(plan)plan.hidden=!bad}
function renderNearControls(){
  if(!support)return;
  const a=$("#nearManualAreas"),c=$("#nearCategories");
  if(a)a.innerHTML=(support.near_me?.manual_areas||[]).map(x=>'<button type="button" data-area="'+esc(x.id)+'">'+esc(x.label)+'</button>').join("");
  const preferred=["ATM","PHARMACY","FUEL","TOILET","MINIMART","CLINIC_HOSPITAL"];
  const categories=(support.near_me?.categories||[]).filter(x=>preferred.includes(x.id)).sort((x,y)=>preferred.indexOf(x.id)-preferred.indexOf(y.id));
  if(c)c.innerHTML=categories.map(x=>'<button type="button" class="near-category" data-category="'+esc(x.id)+'"><span>'+esc(x.icon)+'</span><strong>'+esc(x.label)+'</strong></button>').join("");
}
function haversine(a,b){const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
const nearAreaCenters={
  zone_central_west:{lat:10.2172,lon:103.9593},
  zone_south:{lat:10.0191,lon:104.0150},
  zone_north:{lat:10.3759,lon:103.90}
};
function nearestNearArea(pos){
  return Object.entries(nearAreaCenters)
    .map(([id,coords])=>({id,d:haversine(pos,coords)}))
    .sort((a,b)=>a.d-b.d)[0]?.id||"all";
}
function resolveNearItem(x){const e=entities.get(x.utility_id)||{},map=e.map||{};return{...x,name:e.name||x.utility_id,address:e.address||"",phone:e.phone||null,zone_id:e.zone_id||null,utility_type:e.utility_type||null,lat:Number.isFinite(map.lat)?map.lat:null,lon:Number.isFinite(map.lon)?map.lon:null}}
function renderNearResults(){
  const host=$("#nearResults");if(!host||!support)return;
  if(!position&&!selectedArea){
    const picked=selectedCategory?(support.near_me.categories.find(x=>x.id===selectedCategory)?.label||selectedCategory):null;
    host.innerHTML='<div><strong>'+esc(picked?"Đã chọn "+picked+". Chọn khu vực để xem.":"Chọn một khu vực hoặc dùng vị trí của bạn.")+'</strong>'+
      '<span>Có thể xem Toàn đảo, Dương Đông, An Thới, Sunset Town hoặc Gành Dầu.</span></div>'+
      '<a class="near-open-directory" href="nearme/">Mở bản đồ tiện ích →</a>';
    return;
  }
  if(!utilitiesLoaded){host.innerHTML='<div><strong>Chờ chút nhé.</strong><span>Đang tìm những chỗ hữu ích quanh đây.</span></div>';return}
  let items=[...(support.near_me?.items||[])].map(resolveNearItem);
  if(selectedCategory)items=items.filter(x=>x.utility_type===selectedCategory);
  let gpsFallback=false;
  if(position){
    const withCoords=items
      .filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
      .map(x=>({...x,distance_km:haversine(position,{lat:x.lat,lon:x.lon})}))
      .sort((a,b)=>(a.current_status==="OPEN"?0:1)-(b.current_status==="OPEN"?0:1)||a.distance_km-b.distance_km);
    const fallbackArea=selectedArea&&selectedArea!=="all"?selectedArea:nearestNearArea(position);
    const areaOnly=items
      .filter(x=>!Number.isFinite(x.lat)||!Number.isFinite(x.lon))
      .filter(x=>x.zone_id===fallbackArea||x.place_id===fallbackArea)
      .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
    gpsFallback=areaOnly.length>0;
    items=[...withCoords,...areaOnly];
    if(!items.length){
      items=[...(support.near_me?.items||[])].map(resolveNearItem)
        .filter(x=>!selectedCategory||x.utility_type===selectedCategory)
        .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
    }
  }else if(selectedArea&&selectedArea!=="all"){
    items=items.filter(x=>x.zone_id===selectedArea||x.place_id===selectedArea);
  }else if(selectedArea==="all"){
    items.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
  }
  if(!items.length){
    host.innerHTML='<div><strong>Chưa có điểm phù hợp để hiện ở đây.</strong><span>Thử khu vực hoặc loại tiện ích khác.</span></div>'+
      '<a class="near-open-directory" href="nearme/">Mở Quanh đây →</a>';
    return;
  }
  const stateLabel=x=>{
    if(x.current_status==="TEMPORARILY_CLOSED")return"Tạm đóng";
    if(x.current_status==="CLOSED")return"Hiện đóng";
    if(x.current_status==="OPEN"&&/24\/?24/i.test(x.opening_hours_note||""))return"Mở 24/24";
    return"";
  };
  host.innerHTML=(gpsFallback?'<div class="near-gps-note"><strong>Đã nhận vị trí.</strong><span>Các điểm tiện ích chưa có đủ tọa độ để xếp chính xác theo khoảng cách, nên tạm ưu tiên khu vực gần vị trí bạn vừa chia sẻ.</span></div>':"")+'<div class="near-result-list">'+items.slice(0,6).map(x=>{
    const state=stateLabel(x),distance=Number.isFinite(x.distance_km)?x.distance_km.toFixed(1)+" km":"";
    const top=[state,distance].filter(Boolean).join(" · ");
    return '<article class="near-result-card">'+
      (top?'<span>'+esc(top)+'</span>':"")+
      '<strong>'+esc(x.name)+'</strong>'+
      (x.address?'<small>'+esc(x.address)+'</small>':"")+
      (x.opening_hours_note?'<small>'+esc(x.opening_hours_note)+'</small>':"")+
      (x.phone?'<small>☎ '+esc(x.phone)+'</small>':"")+
      '<div class="near-result-actions"><a href="nearme/">Xem quanh đây →</a></div>'+
    '</article>';
  }).join("")+'</div>';
}
function currencyRate(value){if(value===null||value===undefined||value==="")return"—";const n=Number(value);if(!Number.isFinite(n)||n<=0)return"—";const digits=n<100?2:n<1000?1:0;return new Intl.NumberFormat("vi-VN",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n)+" ₫"}
function renderHomeCurrency(payload=currencyPayload){const host=$("#homeCurrencyGrid"),status=$("#homeCurrencyStatus");if(!host||!status)return;const rates=payload?.rates||[];if(!rates.length){host.innerHTML='<div class="home-currency-empty">Chưa lấy được tỷ giá lúc này. <a href="currency/">Mở trang tỷ giá →</a></div>';status.textContent="Thử lại sau một chút nhé.";return}const flags={USD:"🇺🇸",KRW:"🇰🇷",CNY:"🇨🇳",RUB:"🇷🇺",EUR:"🇪🇺"},wanted=["USD","KRW","CNY","RUB","EUR"],by=new Map(rates.map(x=>[x.currency,x]));host.innerHTML=wanted.map(code=>{const r=by.get(code);if(!r)return"";const cash=Number(r.cash_buy),transfer=Number(r.transfer_buy),hasCash=r.cash_buy!==null&&r.cash_buy!==undefined&&r.cash_buy!==""&&Number.isFinite(cash)&&cash>0,hasTransfer=r.transfer_buy!==null&&r.transfer_buy!==undefined&&r.transfer_buy!==""&&Number.isFinite(transfer)&&transfer>0;const buy=hasCash?r.cash_buy:hasTransfer?r.transfer_buy:null;const note=hasCash?"VCB mua tiền mặt · bán "+currencyRate(r.sell):hasTransfer?"VCB mua chuyển khoản · bán "+currencyRate(r.sell):"VCB chưa có giá mua · bán "+currencyRate(r.sell);return'<a class="home-currency-card" href="currency/?from='+code+'&amount=100"><span>'+esc((flags[code]||"¤")+" "+code)+'</span><strong>'+esc(currencyRate(buy))+'</strong><small>'+esc(note)+'</small></a>'}).join("");const source=payload.source_updated_at||payload.fetched_at,when=source?new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(source)):"chưa biết";status.textContent=(payload.data_status==="live"?"Vietcombank · cập nhật ":"Bản gần nhất · ")+when+" · mở trang tỷ giá để quy đổi và xem 30 ngày."}
function renderHotNow(){
  const section=$("#hot-now"),host=$("#hotNowList");if(!section||!host)return;
  section.hidden=false;
  if(!support){host.innerHTML='<div class="surface-loading">Đang mở những chuyện mới trên đảo...</div>';return}
  const now=Date.now(),items=(support.hot_now?.items||[]).filter(x=>!x.expires_at||Date.parse(x.expires_at)>now);
  if(!items.length){host.innerHTML='<div class="surface-loading">Hôm nay chưa có thay đổi nào đủ đáng kể để đưa lên đây.</div>';return}
  host.innerHTML=items.slice(0,4).map(x=>{
    const published=x.published_at?new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit"}).format(new Date(x.published_at+"T12:00:00+07:00")):"";
    return '<a class="hot-card" href="'+esc(x.route||"#")+'"><span>'+esc(x.category||"CẬP NHẬT")+'</span>'+
      '<strong>'+esc(x.title)+'</strong><p>'+esc(x.short_summary||"")+'</p>'+
      (published?'<small>Cập nhật '+esc(published)+'</small>':"")+'</a>';
  }).join("");
}
function randomIndex(max){if(max<=1)return 0;try{if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%max}}catch{}return Math.floor(Math.random()*max)}
function sessionRandomSlice(items,count){if(!items.length)return[];const ids=items.map(x=>x.prompt_id),key="openpq.curiosity.session.v2",byId=new Map(items.map(x=>[x.prompt_id,x]));let order=[];try{order=JSON.parse(sessionStorage.getItem(key)||"[]")}catch{}if(!Array.isArray(order)||order.length!==ids.length||order.some(id=>!byId.has(id))){order=[...ids];for(let i=order.length-1;i>0;i--){const j=randomIndex(i+1);[order[i],order[j]]=[order[j],order[i]]}try{sessionStorage.setItem(key,JSON.stringify(order))}catch{}}return order.slice(0,Math.min(count,order.length)).map(id=>byId.get(id)).filter(Boolean)}
function renderCuriosity(){
  const host=$("#curiosityRail");if(!host||!support)return;
  const typeLabel={
    LOCAL_BELIEF:"CHUYỆN ĐỊA PHƯƠNG",
    ORAL_HISTORY:"CHUYỆN TRUYỀN LẠI",
    LEGEND:"TRUYỀN THUYẾT",
    DOCUMENTED_HISTORY:"TƯ LIỆU ĐẢO",
    LOCAL_CRAFT:"NGHỀ & ĐỜI SỐNG",
    NATURE_NOTE:"THIÊN NHIÊN · TẬP TÍNH",
    PLACE_NOTE:"CHUYỆN MỘT NƠI",
    FOOD_NOTE:"MÓN NGON · CHUYỆN ĂN",
    CULTURAL_NOTE:"TÍN NGƯỠNG · VĂN HÓA",
    HISTORY_NOTE:"TƯ LIỆU ĐẢO",
    DISPUTED:"CÒN NHIỀU CÁCH KỂ"
  };
  const rows=sessionRandomSlice(support.curiosity||[],support.curiosity_policy?.display_count||3);
  host.innerHTML=rows.map((x,index)=>{
    const s=stories.get(x.story_id)||{},answer=x.short_teaser||s.dek||"Câu chuyện này đang được bổ sung thêm tư liệu.";
    const image=s.image||x.image||"assets/hero-local.svg",alt=x.image_alt||s.title||x.question;
    const verify=x.verification_status==="NEEDS_VERIFICATION"?"Câu chuyện này còn vài chi tiết chưa chắc":x.verification_status==="PARTIAL_VERIFIED"?"Có tư liệu, một phần vẫn là lời kể địa phương":"Có tài liệu ghi lại";
    return '<article class="curiosity-card" data-curiosity-card>'+
      '<button class="curiosity-toggle" type="button" aria-expanded="false" aria-controls="curiosity-answer-'+index+'">'+
        '<figure class="curiosity-media"><img src="'+esc(image)+'" alt="'+esc(alt)+'" loading="lazy" decoding="async"></figure>'+
        '<div class="curiosity-question"><span>'+esc(typeLabel[x.story_type]||"CHUYỆN PHÚ QUỐC")+'</span><strong>'+esc(x.question)+'</strong><small>Chạm để biết vì sao</small></div>'+
      '</button>'+
      '<div class="curiosity-answer" id="curiosity-answer-'+index+'" hidden><p>'+esc(answer)+'</p><div><em>'+esc(verify)+'</em>'+(x.route?'<a href="'+esc(x.route)+'">Đọc câu chuyện đầy đủ →</a>':"")+'</div></div>'+
    '</article>';
  }).join("");
  host.querySelectorAll(".curiosity-toggle").forEach(btn=>btn.addEventListener("click",()=>{
    const card=btn.closest("[data-curiosity-card]"),answer=card?.querySelector(".curiosity-answer"),willOpen=btn.getAttribute("aria-expanded")!=="true";
    host.querySelectorAll("[data-curiosity-card]").forEach(other=>{
      const ob=other.querySelector(".curiosity-toggle"),oa=other.querySelector(".curiosity-answer");
      if(ob)ob.setAttribute("aria-expanded","false");if(oa)oa.hidden=true;other.dataset.open="false";
    });
    if(willOpen&&answer){btn.setAttribute("aria-expanded","true");answer.hidden=false;card.dataset.open="true"}
  }));
}
function bindNear(){
  if(nearBound)return;nearBound=true;
  $("#nearCategories")?.addEventListener("click",e=>{
    const b=e.target.closest("[data-category]");if(!b)return;
    selectedCategory=selectedCategory===b.dataset.category?null:b.dataset.category;
    document.querySelectorAll(".near-category").forEach(x=>x.classList.toggle("active",selectedCategory&&x.dataset.category===selectedCategory));
    renderNearResults();
  });
  $("#nearManualAreas")?.addEventListener("click",e=>{
    const b=e.target.closest("[data-area]");if(!b)return;
    selectedArea=b.dataset.area;position=null;
    document.querySelectorAll("[data-area]").forEach(x=>x.classList.toggle("active",x===b));
    const loc=$("#nearLocationBtn");if(loc)loc.textContent="⌖ Dùng vị trí của tôi";
    renderNearResults();
  });
  $("#nearLocationBtn")?.addEventListener("click",()=>{
    const button=$("#nearLocationBtn");
    if(!navigator.geolocation){
      $("#nearResults").innerHTML="<strong>Thiết bị này không chia sẻ được vị trí.</strong><span>Bạn vẫn có thể chọn khu vực.</span>";
      return;
    }
    if(button){button.disabled=true;button.textContent="Đang lấy vị trí..."}
    navigator.geolocation.getCurrentPosition(p=>{
      position={lat:p.coords.latitude,lon:p.coords.longitude};selectedArea=nearestNearArea(position);
      document.querySelectorAll("[data-area]").forEach(x=>x.classList.toggle("active",x.dataset.area===selectedArea));
      if(button){button.disabled=false;button.textContent="✓ Đang dùng vị trí này"}
      renderNearResults();
    },()=>{
      if(button){button.disabled=false;button.textContent="⌖ Dùng vị trí của tôi"}
      $("#nearResults").innerHTML="<strong>Chưa lấy được vị trí.</strong><span>Chọn Toàn đảo hoặc một khu vực để xem tiếp.</span>";
    },{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
  });
}
function renderAll(){renderTripClock();renderActivities();renderNearControls();renderNearResults();renderHomeCurrency();renderHotNow();renderCuriosity()}
async function loadJson(url,label){try{const r=await fetch(url+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(label+" HTTP "+r.status);return await r.json()}catch(error){console.warn("Homepage source unavailable:",label,error);return null}}
renderClock();setInterval(()=>{renderClock();renderTripClock()},60000);renderHotNow();renderHomeCurrency();
const noticesTask=loadJson(NOTICES,"operational-notices").then(data=>{operationalNotices=data;renderTripClock();renderActivities()});
const supportTask=loadJson(SUPPORT,"home-support").then(data=>{if(!data)return;support=data;renderNearControls();bindNear();renderNearResults();renderHotNow();renderCuriosity();renderTripClock();renderActivities()});
const placesTask=loadJson(PLACES,"places").then(data=>{if(!data)return;(data.entities||[]).forEach(x=>entities.set(x.id,x));renderTripClock();renderActivities()});
const activitiesTask=loadJson(ACTIVITIES,"activities").then(data=>{if(!data)return;(data.entities||[]).forEach(x=>entities.set(x.id,x));renderTripClock();renderActivities()});
const utilitiesTask=loadJson(UTILITIES,"utilities").then(data=>{if(!data)return;(data.entities||[]).forEach(x=>entities.set(x.id,x));utilitiesLoaded=true;renderNearResults()});
const storiesTask=loadJson(STORIES,"stories").then(data=>{if(!data)return;(data.stories||[]).forEach(x=>stories.set(x.id,x));renderCuriosity()});
const currencyTask=loadJson(CURRENCY,"currency").then(data=>{currencyPayload=data;renderHomeCurrency()});
Promise.allSettled([noticesTask,supportTask,placesTask,activitiesTask,utilitiesTask,storiesTask,currencyTask]).then(()=>{renderClock();renderTripClock();renderActivities();renderNearResults();renderHotNow();renderCuriosity();renderHomeCurrency()});
window.addEventListener("openpq:live-ready",()=>{renderClock();renderTripClock();renderActivities()});
})();