/* CMS homepage only: conservative travel-aware attraction timing; no weather/airport side effects. */
(function tripClockModule(global){
"use strict";
const minute=v=>{const m=String(v||"").match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):NaN};
const durationMin=v=>{
 const s=String(v||"").toLowerCase(),r=s.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(giờ|phút)/);
 if(r)return Number(r[1].replace(",","."))*(r[3]==="giờ"?60:1);
 const m=s.match(/(\d+(?:[.,]\d+)?)\s*(giờ|phút)/);
 return m?Number(m[1].replace(",","."))*(m[2]==="giờ"?60:1):null;
};
const hhmm=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
function plan({items=[],entities=new Map(),nowMinute,sunsetMinute,weekday=0,sunsetWeather="unknown"}={}){
 const out=[];
 for(const item of items){
  const e=entities.get(item.entity_id)||{},opening=e.opening_hours||null;
  const duration=durationMin(e.duration),visitMin=Number.isFinite(item.minimum_visit_min)?item.minimum_visit_min:duration;
  const travel=Number.isFinite(item.planning_travel_min)?item.planning_travel_min:45;
  const entry=Number.isFinite(item.entry_buffer_min)?item.entry_buffer_min:0;
  const arrive=nowMinute+travel+entry;
  let effectiveEnd=NaN,latestLeave=NaN,decision=null,summary="",note=item.timing_note||"",eligible=false;
  let fixed=false;
  const validOpening=opening&&["PUBLISHED_SCHEDULE","APPROXIMATE_SCHEDULE"].includes(opening.state)&&!(opening.closed_weekdays||[]).includes(weekday);
  if(item.schedule_source==="SOFT_DAYLIGHT"){
   summary="Ghé thăm khi trời còn sáng";
   if(Number.isFinite(sunsetMinute)&&Number.isFinite(visitMin)){
    effectiveEnd=sunsetMinute;latestLeave=effectiveEnd-travel-visitMin;
    if(nowMinute<=latestLeave){
     eligible=true;decision={state:"active",label:"Có thể dành thời gian ghé chùa",endMin:effectiveEnd,remainingMin:effectiveEnd-nowMinute};
    }
   }
   note=item.timing_note||"Dành thời gian tĩnh tâm, dâng hương; không cần vội chỉ để ngắm cảnh.";
  }else if(item.schedule_source==="SOFT_EVENING"){
   const start=minute(item.preferred_start||"16:30"),end=minute(item.preferred_end||"23:00");
   summary="Hợp từ cuối chiều tới buổi tối";
   if(Number.isFinite(visitMin)){effectiveEnd=end;latestLeave=end-travel-visitMin;
    if(nowMinute<=latestLeave){
     eligible=true;
     decision=nowMinute<start?{state:"future",label:"Hợp hơn từ "+hhmm(start),nextMin:start,endMin:end}:{state:"active",label:"Có thể ghé buổi tối",endMin:end,remainingMin:end-nowMinute};
    }
   }
  }else if(validOpening&&opening.schedule_type==="FIXED_START"){
   fixed=true;
   summary="Theo lịch biểu diễn";
   const showAfter=minute(item.show_after);
   if(!Number.isFinite(showAfter)||nowMinute>=showAfter){
    const times=(opening.times||[]).map(t=>({label:t.label||e.name||"Show",start:t.start,startMin:minute(t.start)})).filter(t=>Number.isFinite(t.startMin)).sort((a,b)=>a.startMin-b.startMin);
    const next=times.find(t=>t.startMin>=arrive);
    if(next){
     eligible=true;effectiveEnd=next.startMin;latestLeave=next.startMin-travel-entry;
     decision={state:"future",label:(item.show_label||"Bắt đầu")+" lúc "+next.start,nextMin:next.startMin,endMin:next.startMin};
     summary=next.start+" · "+(e.duration||"Theo lịch show");
    }
   }
  }else if(validOpening&&Array.isArray(opening.windows)){
   const windows=opening.windows.map(w=>({start:minute(w.start),end:minute(w.end),startLabel:w.start,endLabel:w.end})).filter(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)).sort((a,b)=>a.start-b.start);
   for(const w of windows){
    effectiveEnd=w.end;
    const specialEnd=minute(item.full_visit_end_at);
    if(Number.isFinite(specialEnd))effectiveEnd=Math.min(effectiveEnd,specialEnd);
    const cutoff=minute(item.latest_sensible_start);
    latestLeave=effectiveEnd-travel-(Number.isFinite(visitMin)?visitMin:0);
    if(Number.isFinite(cutoff))latestLeave=Math.min(latestLeave,cutoff-travel);
    if(!Number.isFinite(visitMin)||Math.max(w.start,arrive)+visitMin>effectiveEnd||arrive>w.end||nowMinute>latestLeave)continue;
    eligible=true;summary=w.startLabel+"-"+w.endLabel;
    const preferred=minute(item.preferred_start);
    if(Number.isFinite(preferred)&&nowMinute<preferred&&preferred+travel+visitMin<=effectiveEnd){
     decision={state:"future",label:"Hợp hơn từ "+hhmm(preferred),nextMin:preferred,endMin:effectiveEnd,remainingMin:effectiveEnd-nowMinute};
    }else{
     const sunsetTrip=item.entity_id==="place_dinh_cau"&&Number.isFinite(sunsetMinute);
     if(sunsetTrip&&sunsetWeather==="bad"){
      decision={state:"active",label:"Có thể ghé Dinh Cậu, đừng canh hoàng hôn",endMin:effectiveEnd,remainingMin:effectiveEnd-nowMinute};
      note="Bờ Tây có tín hiệu mưa hoặc dông gần hoàng hôn; ưu tiên nơi gần và theo dõi thời tiết.";
     }else if(sunsetTrip&&nowMinute>sunsetMinute-travel-visitMin){
      decision={state:"active",label:"Có thể ghé, nhưng khó kịp ngắm chiều",endMin:effectiveEnd,remainingMin:effectiveEnd-nowMinute};
     }else{
      decision={state:"active",label:"Có thể cân nhắc ghé lúc này",endMin:effectiveEnd,remainingMin:effectiveEnd-nowMinute};
     }
    }
    break;
   }
  }
  if(!eligible) {
   out.push({item,e,opening,eligible:false,reason:fixed?"show_passed_or_not_yet_recommended":validOpening?"insufficient_time_or_travel":"no_verified_schedule"});
   continue;
  }
  if(fixed&&item.entity_id==="activity_once_show"){
   note="Cần vé vào VinWonders; kiểm tra lịch ONCE trong ngày trước khi đi.";
  }
  if(item.entity_id==="place_vinwonders"){
   note="Khung này dành cho các khu trò chơi; phần lớn có thể kết thúc từ 17:30-18:00. ONCE được gợi ý riêng.";
  }
  if(item.entity_id==="place_vinpearl_safari"){
   note="Safari đóng cửa lúc 16:00. Nên kiểm tra giờ nhận khách tại cổng trước khi đi.";
  }
  const bufferNote="Tạm dự trù "+travel+" phút đi đường, chưa biết vị trí xuất phát.";
  if(!fixed)note=(note?note+" ":"")+bufferNote;
  const state=decision.state;
  const score=state==="active"?(latestLeave-nowMinute):(240+Math.max(0,(decision.nextMin??effectiveEnd)-nowMinute));
  out.push({item,e,opening,eligible:true,decision,summary,note,score,latestLeave,minDuration:visitMin,travelBuffer:travel});
 }
 return out.sort((a,b)=>(a.eligible===b.eligible?(a.score??99999)-(b.score??99999):a.eligible?-1:1));
}
global.OpenPQTripClockPlanner={plan,minute,durationMin};
})(window);
