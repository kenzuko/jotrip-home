/* CMS homepage: opening hours and visitor context only; travel time belongs to the visitor. */
(function tripClockModule(global) {
 "use strict";
 const minute=v=>{const m=String(v||"").match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):NaN;};
 const durationMin=v=>{const s=String(v||"").toLowerCase(),r=s.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(giờ|phút)/);if(r)return Number(r[1].replace(",","."))*(r[3]==="giờ"?60:1);const m=s.match(/(\d+(?:[.,]\d+)?)\s*(giờ|phút)/);return m?Number(m[1].replace(",","."))*(m[2]==="giờ"?60:1):null;};
 const hhmm=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
 const remaining=n=>{const h=Math.floor(n/60),m=n%60;return h?("Còn "+h+" giờ"+(m?" "+m+" phút":"")+" theo giờ niêm yết"):("Còn "+n+" phút theo giờ niêm yết");};
 function plan({items=[],entities=new Map(),nowMinute,sunsetMinute,weekday=0,sunsetWeather="unknown"}={}) {
  const out=[];
  for(const item of items){
   const e=entities.get(item.entity_id)||{},opening=e.opening_hours||null,id=item.entity_id;
   const valid=opening&&["PUBLISHED_SCHEDULE","APPROXIMATE_SCHEDULE"].includes(opening.state)&&!(opening.closed_weekdays||[]).includes(weekday);
   const minVisit=Number.isFinite(item.minimum_visit_min)?item.minimum_visit_min:durationMin(e.duration);
   const activeWindow=valid&&(opening.windows||[]).map(w=>({...w,startMin:minute(w.start),endMin:minute(w.end)})).find(w=>Number.isFinite(w.startMin)&&Number.isFinite(w.endMin)&&nowMinute>=w.startMin&&nowMinute<w.endMin);
   const nextWindow=valid&&(opening.windows||[]).map(w=>({...w,startMin:minute(w.start),endMin:minute(w.end)})).find(w=>Number.isFinite(w.startMin)&&w.startMin>nowMinute);
   let decision=null,summary="",note=item.timing_note||"",score=9999,latestStart=NaN;
   if(item.schedule_source==="SOFT_DAYLIGHT"){
    if(Number.isFinite(sunsetMinute)&&nowMinute<sunsetMinute){
     decision={state:"active",label:"Dành thời gian tĩnh tâm",endMin:sunsetMinute,remainingMin:sunsetMinute-nowMinute};
     summary="Tham quan ban ngày";
     note="Tĩnh tâm, dâng hương và cầu nguyện. Giữ yên tĩnh và trang phục phù hợp.";
     score=60;
    }
   }else if(item.schedule_source==="SOFT_EVENING"){
    const start=minute(item.preferred_start||"16:30"),end=minute(item.preferred_end||"23:00");
    if(nowMinute<end){
     decision=nowMinute<start?{state:"future",label:"Hợp hơn từ "+hhmm(start),nextMin:start,endMin:end}:{state:"active",label:"Có thể ghé buổi tối",endMin:end,remainingMin:end-nowMinute};
     summary="Từ cuối chiều tới buổi tối";score=decision.state==="active"?115:200+Math.max(0,start-nowMinute)/12;
    }
   }else if(valid&&opening.schedule_type==="FIXED_START"){
    const times=(opening.times||[]).map(t=>({...t,startMin:minute(t.start)})).filter(t=>Number.isFinite(t.startMin)).sort((a,b)=>a.startMin-b.startMin);
    const next=times.find(t=>t.startMin>nowMinute);
    const live= id==="activity_once_show" && times.find(t=>nowMinute>=t.startMin&&nowMinute<t.startMin+20);
    if(live){
     decision={state:"watch",label:"ONCE đã bắt đầu theo lịch",nextMin:live.startMin,endMin:live.startMin+20};
     summary=hhmm(live.startMin)+"-"+hhmm(live.startMin+20)+" · show ONCE";
     note="Show đang trong khung giờ niêm yết; cần vé vào công viên. Kiểm tra tình trạng thực tế tại điểm.";
     score=4;
    }else if(next){
     decision={state:"future",label:id==="activity_once_show"?"ONCE lúc "+next.start:"Bắt đầu lúc "+next.start,nextMin:next.startMin};
     const length=durationMin(e.duration),end=Number.isFinite(length)?next.startMin+length:NaN;
     summary=Number.isFinite(end)?next.start+"-"+hhmm(end)+" · "+(e.duration||"Theo lịch show"):next.start+" · Theo lịch show";
     if(id==="activity_once_show")note="Sau khoảng 17:00, phần lớn trò chơi đã ngừng. ONCE 18:45-19:05 theo lịch; cần vé vào VinWonders.";
     score=id==="activity_once_show"?235+(next.startMin-nowMinute)/20:250+(next.startMin-nowMinute)/12;
    }
   }else if(activeWindow){
    const w=activeWindow,remain=w.endMin-nowMinute;
    if(id==="place_vinpearl_safari"){
     decision={state:nowMinute>=12*60?"watch":"active",label:"Safari đóng cửa lúc "+w.end,remainingMin:remain,endMin:w.endMin};
     summary=w.start+"-"+w.end+" · Tham quan khoảng "+e.duration;
     note=remaining(remain)+". "+(Number.isFinite(minVisit)&&remain<minVisit?"Thời gian còn lại ngắn hơn thời lượng tham quan thông thường. ":"")+"Kiểm tra giờ nhận khách tại cổng.";
     score=nowMinute>=12*60?-100+remain/60:48;
    }else if(id==="place_vinwonders"){
     const gamesEnd=minute(item.full_visit_end_at||"17:00"),onceStart=minute("18:45"),onceEnd=minute("19:05");
     if(nowMinute<gamesEnd){
      decision={state:nowMinute>=11*60?"watch":"active",label:"Phần lớn trò chơi ngừng khoảng 17:00",endMin:gamesEnd,remainingMin:gamesEnd-nowMinute};
      note="Công viên mở đến 19:30, nhưng phần lớn trò chơi ngừng khoảng 17:00. Show ONCE 18:45-19:05 theo lịch.";
     }else if(nowMinute<onceEnd){
      decision={state:"watch",label:nowMinute<onceStart?"Phần lớn trò chơi đã ngừng":"Đang trong khung ONCE theo lịch",endMin:onceEnd,remainingMin:onceEnd-nowMinute};
      note="Sau khoảng 17:00, phần lớn trò chơi đã ngừng. Show ONCE 18:45-19:05 theo lịch; cần kiểm tra tình trạng thực tế.";
     }else{
      decision={state:"watch",label:"ONCE đã kết thúc theo lịch",endMin:w.endMin,remainingMin:remain};
      note="Phần lớn trò chơi đã ngừng; ONCE đã kết thúc theo lịch. Công viên đóng lúc 19:30.";
     }
     summary="Công viên "+w.start+"-"+w.end+" · Trò chơi khoảng 17:00";
     score=nowMinute>=12*60?-80:52;
    }else{
     const preferred=minute(item.preferred_start),tooShort=Number.isFinite(minVisit)&&remain<minVisit;
     latestStart=Number.isFinite(minVisit)?w.endMin-minVisit:NaN;
     if(Number.isFinite(preferred)&&nowMinute<preferred){
      decision={state:"future",label:"Hợp hơn từ "+hhmm(preferred),nextMin:preferred,endMin:w.endMin};
      score=170+(preferred-nowMinute)/10;
     }else if(tooShort){
      decision={state:"watch",label:"Sắp hết khung giờ tham quan",endMin:w.endMin,remainingMin:remain};
      score=25+remain/12;
     }else{
      decision={state:"active",label:"Có thể ghé lúc này",endMin:w.endMin,remainingMin:remain};
      score=70+Math.max(0,remain-Math.max(0,minVisit||0))/45;
     }
     summary=w.start+"-"+w.end;
     if(id==="place_dinh_cau" && sunsetWeather==="bad"){
      note="Bờ Tây có tín hiệu mưa hoặc dông gần hoàng hôn. Quan sát thêm dự báo trước khi di chuyển.";
     }else if(id==="place_dinh_cau" && sunsetWeather==="watch"){
      note="Cuối chiều có thể có mưa cục bộ ở bờ Tây. Quan sát thêm dự báo trước khi di chuyển.";
     }
    }
   }else if(nextWindow){
    const w=nextWindow;
    decision={state:"future",label:"Mở từ "+w.start,nextMin:w.startMin,endMin:w.endMin};
    summary=w.start+"-"+w.end;score=210+(w.startMin-nowMinute)/10;
   }
   if(!decision){
    out.push({item,e,opening,eligible:false,reason:!valid&&item.schedule_source?.startsWith("canonical")?"no_verified_schedule":"outside_suggested_window"});
    continue;
   }
   out.push({item,e,opening,eligible:true,decision,summary,note,score,latestStart});
  }
  return out.sort((a,b)=>(a.eligible===b.eligible?(a.score??99999)-(b.score??99999):a.eligible?-1:1));
 }
 global.OpenPQTripClockPlanner={plan,minute,durationMin};
})(window);
