(() => {
"use strict";
const SUPPORT="data/home-support.json",PLACES="data/entities/places.json",ACTIVITIES="data/entities/activities.json",UTILITIES="data/entities/utilities.json",STORIES="data/content.json",CURRENCY="data/currency-snapshot.json";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const stateText={OPEN:"Đang mở",CLOSED:"Đã đóng",TEMPORARILY_CLOSED:"Tạm đóng",UNKNOWN:"Chưa có thông tin mới"};
const liveStateText={normal:"Hôm nay hoạt động bình thường",good:"Hôm nay hoạt động bình thường",watch:"Có điều cần xem",advisory:"Có lưu ý",bad:"Tạm dừng",unknown:"Chưa có thông tin mới",info:"Theo lịch hôm nay"};
let support=null,currencyPayload=null,entities=new Map(),stories=new Map(),selectedCategory=null,selectedArea=null,position=null,nearBound=false,utilitiesLoaded=false;
function vnParts(date=new Date()){const d=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"long",day:"2-digit",month:"2-digit"}).format(date).replace(",","");const t=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).format(date);return{time:t,date:d}}
function ageText(iso){
  const t=Date.parse(iso||"");
  if(!Number.isFinite(t))return"Chưa có cập nhật mới";
  const m=Math.max(0,(Date.now()-t)/60000);
  if(m<2)return"Vừa cập nhật";
  if(m<60)return Math.round(m)+" phút trước";
  const h=Math.floor(m/60);
  if(h<24)return h===1?"Hơn 1 giờ trước":"Hơn "+h+" giờ trước";
  return Math.floor(h/24)===1?"Hôm qua":Math.floor(h/24)+" ngày trước";
}
function hhmmToMinutes(value){const m=String(value||"").match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):NaN}
function scheduleSummary(opening){if(!opening)return"Chưa có giờ đáng tin để hiển thị";if(opening.state==="NEEDS_VERIFICATION")return"Giờ hôm nay đang được kiểm tra lại";if(opening.schedule_type==="FIXED_START"&&(opening.times||[]).length)return(opening.times||[]).map(x=>x.start+(x.label?" · "+x.label:"")).join(" · ");const windows=(opening.windows||[]).filter(x=>x.start&&x.end);if(!windows.length)return"Chưa có giờ đáng tin để hiển thị";const prefix=opening.state==="APPROXIMATE_SCHEDULE"?"Khoảng ":"";return prefix+windows.map(x=>x.start+"-"+x.end).join(" · ")}
function scheduleDecision(opening){
  if(!opening||!["PUBLISHED_SCHEDULE","APPROXIMATE_SCHEDULE"].includes(opening.state)){
    return{state:"unknown",label:"Chưa rõ giờ hôm nay",detail:"Xem thông tin điểm đến"};
  }
  const dayName=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short"}).format(new Date());
  const dayIndex=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(dayName);
  if((opening.closed_weekdays||[]).includes(dayIndex))return{state:"past",label:"Hôm nay nghỉ",detail:"Theo lịch hiện có"};
  const now=hhmmToMinutes(vnParts().time),approx=opening.state==="APPROXIMATE_SCHEDULE";
  const detail=approx?"Khung giờ tham khảo":"Lịch hôm nay";
  if(opening.schedule_type==="FIXED_START"&&(opening.times||[]).length){
    const times=(opening.times||[]).map(x=>({...x,startMin:hhmmToMinutes(x.start)})).filter(x=>Number.isFinite(x.startMin)).sort((a,b)=>a.startMin-b.startMin);
    const next=times.find(x=>now<x.startMin);
    if(next)return{state:"future",label:"Bắt đầu lúc "+next.start,detail,nextMin:next.startMin};
    return{state:"past",label:"Đã qua giờ hôm nay",detail};
  }
  const windows=(opening.windows||[]).map(x=>({...x,startMin:hhmmToMinutes(x.start),endMin:hhmmToMinutes(x.end)})).filter(x=>Number.isFinite(x.startMin)&&Number.isFinite(x.endMin)).sort((a,b)=>a.startMin-b.startMin);
  if(!windows.length)return{state:"unknown",label:"Chưa có giờ chắc chắn",detail:"Xem thông tin điểm đến"};
  const active=windows.find(x=>now>=x.startMin&&now<=x.endMin);
  if(active)return{state:"active",label:"Đi lúc này vẫn kịp",detail,startMin:active.startMin,endMin:active.endMin,remainingMin:active.endMin-now};
  const next=windows.find(x=>now<x.startMin);
  if(next)return{state:"future",label:(approx?"Thường bắt đầu khoảng ":"Mở từ ")+next.start,detail,nextMin:next.startMin,endMin:next.endMin};
  return{state:"past",label:"Để ngày mai",detail};
}
function scheduleFreshness(opening){if(!opening?.verified_at)return"Chưa có cập nhật mới";return"Cập nhật "+ageText(opening.verified_at)}
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
function renderTripClock(){
  if(!support)return;
  renderClock();
  const host=$("#tripClockList");if(!host)return;
  const now=hhmmToMinutes(vnParts().time),sunset=hhmmToMinutes(localSunsetPhuQuoc());
  let rows=(support.trip_clock?.items||[]).map(item=>{
    const e=entities.get(item.entity_id)||{},opening=e.opening_hours||null;
    let decision=scheduleDecision(opening),summary=scheduleSummary(opening);
    if(item.schedule_source==="SOFT_DAYLIGHT"){
      decision=Number.isFinite(sunset)&&now<sunset
        ?{state:"active",label:"Đi lúc này vẫn hợp",detail:"Nên đi khi còn sáng",endMin:sunset,remainingMin:sunset-now}
        :{state:"past",label:"Nên để ngày mai",detail:"Hợp hơn khi còn sáng"};
      summary=item.timing_note||"Nên đi ban ngày hoặc chiều dịu";
    }else if(item.schedule_source==="SOFT_EVENING"){
      const start=16*60+30;
      decision=now<start
        ?{state:"future",label:"Hợp hơn từ cuối chiều",detail:"Thời điểm trải nghiệm dễ chịu hơn",nextMin:start}
        :{state:"active",label:"Đang là lúc hợp để đi",detail:"Thời điểm trải nghiệm dễ chịu hơn"};
      summary=item.timing_note||e.best_time||"Hợp từ cuối chiều";
    }
    const minDuration=durationMin(e.duration);
    let score=decision.state==="active"?10:decision.state==="future"?60:decision.state==="unknown"?180:9999;
    if(Number.isFinite(decision.nextMin))score+=Math.max(0,decision.nextMin-now)/12;
    if(Number.isFinite(decision.remainingMin)&&minDuration&&decision.remainingMin<minDuration)score+=120;
    const best=String(e.best_time||item.timing_note||"").toLowerCase();
    if(/cuối chiều/.test(best)&&now>=15*60&&Number.isFinite(sunset)&&now<sunset)score-=28;
    if(/buổi tối|16:30|tối/.test(best)&&now>=16*60)score-=20;
    return{item,e,opening,decision,summary,score,minDuration};
  });
  const available=rows.filter(x=>x.decision.state!=="past");
  if(available.length>=4)rows=available;
  rows.sort((a,b)=>a.score-b.score);
  host.innerHTML=rows.slice(0,9).map(({item,e,decision,summary,minDuration})=>{
    const duration=e.duration||"";
    let note=item.timing_note||e.best_time||decision.detail;
    if(Number.isFinite(decision.remainingMin)&&minDuration&&decision.remainingMin<minDuration){
      note="Thời gian còn lại khá ngắn cho một lượt đi trọn vẹn";
    }
    const detail=[summary,duration].filter(Boolean).join(" · ");
    return '<a class="trip-item" data-decision="'+esc(decision.state)+'" href="'+esc(item.route)+'">'+
      '<span>'+esc(decision.label)+'</span>'+
      '<strong>'+esc(e.name||item.entity_id)+'</strong>'+
      '<p>'+esc(detail)+'</p>'+
      '<b>'+esc(note)+'</b>'+
    '</a>';
  }).join("");
  publishLocalNowHint();
}
function buildLocalNowHint(){
  if(!support)return null;
  const now=hhmmToMinutes(vnParts().time),candidates=[];
  for(const item of support.trip_clock?.items||[]){
    const e=entities.get(item.entity_id)||{},opening=e.opening_hours||null;
    if(!opening)continue;
    if(opening.schedule_type==="FIXED_START"){
      for(const t of opening.times||[]){
        const start=hhmmToMinutes(t.start),delta=start-now;
        if(Number.isFinite(delta)&&delta>0&&delta<=150)candidates.push({
          score:delta,priority:"deadline",tone:"default",
          title:(e.name||item.entity_id)+" bắt đầu lúc "+t.start,
          note:delta<=60?"Nếu muốn xem, nên tính đường đi từ bây giờ.":"Vẫn còn thời gian, nhưng đừng để sát giờ mới đi.",
          primaryText:"Xem "+(e.name||"hoạt động")+" →",primaryHref:item.route,
          secondaryText:"Xem tối nay",secondaryHref:"#happening"
        });
      }
    }
    for(const w of opening.windows||[]){
      const end=hhmmToMinutes(w.end),start=hhmmToMinutes(w.start);
      if(!Number.isFinite(start)||!Number.isFinite(end)||now<start||now>end)continue;
      const remain=end-now;
      if(remain>0&&remain<=90)candidates.push({
        score:180+remain,priority:"deadline",tone:"default",
        title:(e.name||item.entity_id)+" vẫn còn kịp",
        note:"Nếu không phải đi quá xa, bạn vẫn còn đủ thời gian để ghé.",
        primaryText:"Xem "+(e.name||"điểm này")+" →",primaryHref:item.route,
        secondaryText:"Lựa chọn khác",secondaryHref:"#happening"
      });
    }
  }
  return candidates.sort((a,b)=>a.score-b.score)[0]||null;
}
let lastLocalHintKey="";
function publishLocalNowHint(){const hint=buildLocalNowHint(),payload={now_hint:hint,updated_at:new Date().toISOString()};window.OPENPQ_HOME_LOCAL=payload;const key=JSON.stringify(hint||null);if(key!==lastLocalHintKey){lastLocalHintKey=key;window.dispatchEvent(new CustomEvent("openpq:local-ready",{detail:payload}))}}
function liveFor(binding){return binding?window.OPENPQ_HOME?.live_status?.[binding]||null:null}
function renderActivities(){if(!support)return;const host=$("#activityBoard");if(!host)return;host.innerHTML=(support.activity_board||[]).map(item=>{const e=entities.get(item.entity_id)||{},live=liveFor(item.operational_binding),opening=e.opening_hours||null,decision=scheduleDecision(opening);const state=live?.status||(opening?.state==="PUBLISHED_SCHEDULE"?"info":"unknown");const primary=live?(liveStateText[state]||live.primary||"Chưa có cập nhật mới"):(opening?.state==="PUBLISHED_SCHEDULE"?decision.label:(stateText[item.status_code]||"Chưa có cập nhật mới"));const context=live?.context||live?.secondary||(opening?scheduleSummary(opening):("Hợp nhất: "+(e.best_time||"chưa rõ")+" · "+(e.duration||"chưa rõ")));const fresh=live?.source_updated_at?ageText(live.source_updated_at):(opening?scheduleFreshness(opening):"Chưa có cập nhật mới");return'<a class="activity-status-card" data-state="'+esc(state)+'" href="'+esc(item.route)+'"><span>'+esc(primary)+'</span><strong>'+esc(e.name||item.entity_id)+'</strong><p>'+esc(context)+'</p><small>'+esc(fresh)+'</small><b>Xem hôm nay →</b></a>'}).join("");const live=window.OPENPQ_HOME?.live_status||{};const bad=live.cano?.status==="bad"||live.weather?.status==="watch";const plan=$("#planBCard");if(plan)plan.hidden=!bad}
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
  if(!utilitiesLoaded){host.innerHTML='<div><strong>Đang mở danh sách tiện ích...</strong><span>Chờ một chút nhé.</span></div>';return}
  let items=[...(support.near_me?.items||[])].map(resolveNearItem);
  if(selectedCategory)items=items.filter(x=>x.utility_type===selectedCategory);
  let gpsFallback=false;
  if(position){
    const withCoords=items.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
    if(withCoords.length){
      items=withCoords.map(x=>({...x,distance_km:haversine(position,{lat:x.lat,lon:x.lon})}))
        .sort((a,b)=>(a.current_status==="OPEN"?0:1)-(b.current_status==="OPEN"?0:1)||a.distance_km-b.distance_km);
    }else{
      gpsFallback=true;
      const fallbackArea=selectedArea&&selectedArea!=="all"?selectedArea:nearestNearArea(position);
      const areaItems=items.filter(x=>x.zone_id===fallbackArea||x.place_id===fallbackArea);
      if(areaItems.length){
        selectedArea=fallbackArea;
        items=areaItems;
      }else{
        items.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
      }
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
function renderHomeCurrency(payload=currencyPayload){const host=$("#homeCurrencyGrid"),status=$("#homeCurrencyStatus");if(!host||!status)return;const rates=payload?.rates||[];if(!rates.length){host.innerHTML='<div class="home-currency-empty">Tỷ giá đang tạm chưa tải được. <a href="currency/">Mở trang tỷ giá →</a></div>';status.textContent="Chưa lấy được tỷ giá mới nhất.";return}const flags={USD:"🇺🇸",KRW:"🇰🇷",CNY:"🇨🇳",RUB:"🇷🇺",EUR:"🇪🇺"},wanted=["USD","KRW","CNY","RUB","EUR"],by=new Map(rates.map(x=>[x.currency,x]));host.innerHTML=wanted.map(code=>{const r=by.get(code);if(!r)return"";const hasCash=r.cash_buy!==null&&r.cash_buy!==undefined&&r.cash_buy!==""&&Number(r.cash_buy)>0;const note=hasCash?"VCB mua tiền mặt · bán "+currencyRate(r.sell):"VCB chưa niêm yết mua tiền mặt · bán "+currencyRate(r.sell);return'<a class="home-currency-card" href="currency/?from='+code+'&amount=100"><span>'+esc((flags[code]||"¤")+" "+code)+'</span><strong>'+esc(currencyRate(r.cash_buy))+'</strong><small>'+esc(note)+'</small></a>'}).join("");const source=payload.source_updated_at||payload.fetched_at,when=source?new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(source)):"chưa rõ";status.textContent=(payload.data_status==="live"?"Vietcombank · cập nhật ":"Bản gần nhất · ")+when+" · mở /currency để quy đổi và xem 30 ngày."}
function renderHotNow(){
  const section=$("#hot-now"),host=$("#hotNowList");if(!section||!host)return;
  section.hidden=false;
  if(!support){host.innerHTML='<div class="surface-loading">Đang xem hôm nay có gì mới...</div>';return}
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
    DISPUTED:"CÒN NHIỀU CÁCH KỂ"
  };
  const rows=sessionRandomSlice(support.curiosity||[],support.curiosity_policy?.display_count||3);
  host.innerHTML=rows.map((x,index)=>{
    const s=stories.get(x.story_id)||{},answer=x.short_teaser||s.dek||"Câu chuyện này đang được bổ sung thêm tư liệu.";
    const image=s.image||x.image||"assets/hero-local.svg",alt=x.image_alt||s.title||x.question;
    const verify=x.verification_status==="NEEDS_VERIFICATION"?"Đang đối chiếu thêm tư liệu":x.verification_status==="PARTIAL_VERIFIED"?"Có nguồn tham khảo, một phần vẫn là lời kể":"Có nguồn tham khảo";
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
renderClock();setInterval(renderClock,60000);renderHotNow();renderHomeCurrency();
const supportTask=loadJson(SUPPORT,"home-support").then(data=>{if(!data)return;support=data;renderNearControls();bindNear();renderNearResults();renderHotNow();renderCuriosity();renderTripClock();renderActivities()});
const placesTask=loadJson(PLACES,"places").then(data=>{if(!data)return;(data.entities||[]).forEach(x=>entities.set(x.id,x));renderTripClock();renderActivities()});
const activitiesTask=loadJson(ACTIVITIES,"activities").then(data=>{if(!data)return;(data.entities||[]).forEach(x=>entities.set(x.id,x));renderTripClock();renderActivities()});
const utilitiesTask=loadJson(UTILITIES,"utilities").then(data=>{if(!data)return;(data.entities||[]).forEach(x=>entities.set(x.id,x));utilitiesLoaded=true;renderNearResults()});
const storiesTask=loadJson(STORIES,"stories").then(data=>{if(!data)return;(data.stories||[]).forEach(x=>stories.set(x.id,x));renderCuriosity()});
const currencyTask=loadJson(CURRENCY,"currency").then(data=>{currencyPayload=data;renderHomeCurrency()});
Promise.allSettled([supportTask,placesTask,activitiesTask,utilitiesTask,storiesTask,currencyTask]).then(()=>{renderClock();renderTripClock();renderActivities();renderNearResults();renderHotNow();renderCuriosity();renderHomeCurrency()});
window.addEventListener("openpq:live-ready",()=>{renderClock();renderTripClock();renderActivities()});
})();