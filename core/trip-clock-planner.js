/* CMS homepage: opening hours and visitor context only; travel time belongs to the visitor. */
(function tripClockModule(global) {
 "use strict";
 const minute=v=>{const m=String(v||"").match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):NaN;};
 const durationMin=v=>{const s=String(v||"").toLowerCase(),r=s.match(/(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)\s*(giờ|phút)/);if(r)return Number(r[1].replace(",","."))*(r[3]==="giờ"?60:1);const m=s.match(/(\d+(?:[.,]\d+)?)\s*(giờ|phút)/);return m?Number(m[1].replace(",","."))*(m[2]==="giờ"?60:1):null;};
 const hhmm=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
 const remaining=n=>{const h=Math.floor(n/60),m=n%60;return h?("Còn "+h+" giờ"+(m?" "+m+" phút":"")+" theo giờ niêm yết"):("Còn "+n+" phút theo giờ niêm yết");};

 // Order by the next useful moment, then by explicit urgency level.
 // Levels are presentation priorities, not claims that a show is operating.
 function importance(row) {
  const value=Number(row.item.priority_level);
  if(Number.isFinite(value)&&value>=1&&value<=3)return value;
  const id=row.item.entity_id;
  if(row.opening?.schedule_type==="FIXED_START"||id==="place_vinpearl_safari"||id==="place_vinwonders")return 3;
  if(id==="activity_hon_thom"||row.decision?.state==="watch")return 2;
  return row.item.schedule_source?.startsWith("SOFT_")?1:2;
 }
 function urgency(row,nowMinute){
  const d=row.decision||{},id=row.item.entity_id,scheduled=row.opening?.schedule_type==="FIXED_START";
  let at;
  if(scheduled)at=d.state==="future"?d.nextMin:d.endMin;
  else if(id==="place_vinpearl_safari"||id==="place_vinwonders")at=d.endMin;
  else if(d.state==="future")at=d.nextMin;
  else if(Number.isFinite(row.latestStart))at=Math.max(nowMinute,row.latestStart);
  else at=d.endMin;
  const until=Number.isFinite(at)?Math.max(0,at-nowMinute):Infinity;
  // Time buckets ensure an imminent activity beats a distant marquee show.
  const bucket=until<=60?0:until<=180?1:until<=360?2:until<Infinity?3:4;
  return {bucket,level:importance(row),until,eventMin:Number.isFinite(at)?at:null};
 }
 function comparePriority(a,b){
  const x=a.urgency||{bucket:4,level:1,until:Infinity};
  const y=b.urgency||{bucket:4,level:1,until:Infinity};
  return x.bucket-y.bucket||y.level-x.level||x.until-y.until||(a.score??99999)-(b.score??99999);
 }
 // Show at most ten detailed cards initially. A small guaranteed share for
 // today's featured evening shows prevents them being buried all afternoon,
 // but never displaces a genuinely imminent high-priority activity.
 function select(rows,limit=8){
  const available=rows.filter(x=>x.eligible&&["active","future","watch"].includes(x.decision?.state)).sort(comparePriority);
  const visible=available.slice(0,limit);
  const featured=available.filter(x=>x.item.feature_in_today===true);
  for(const pin of featured){
   if(visible.includes(pin))continue;
   let replacement=-1;
   for(let i=visible.length-1;i>=0;i--){
    const row=visible[i];
    if(row.item.feature_in_today===true)continue;
    if((row.urgency?.bucket===0&&row.urgency.level>=2)||(row.urgency?.bucket<=1&&row.urgency.level>=3))continue;
    replacement=i;break;
   }
   if(replacement>=0)visible[replacement]=pin;
  }
  visible.sort(comparePriority);
  const kept=new Set(visible);
  return {visible,hidden:available.filter(x=>!kept.has(x)),total:available.length};
 }
 function plan({items=[],entities=new Map(),nowMinute,sunsetMinute,weekday=0,sunsetWeather="unknown"}={}) {
  const out=[];
  const sunsetWx=typeof sunsetWeather==="string"?{level:sunsetWeather}:sunsetWeather||{level:"unknown"};
  const sunsetLevel=sunsetWx.level||"unknown";
  for(const item of items){
   const e=entities.get(item.entity_id)||{},opening=e.opening_hours||null,id=item.entity_id;
   // Do not recommend Dinh Cậu as a sunset visit once it is dark.
   if(id==="place_dinh_cau"&&nowMinute>=19*60){
    out.push({item,e,opening,eligible:false,reason:"evening_sunset_window_ended"});
    continue;
   }
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
    const listedLength=Number(item.performance_duration_min)||durationMin(e.duration);
    const displayLength=Number.isFinite(listedLength)&&listedLength>0?listedLength:15;
    const live=times.find(t=>nowMinute>=t.startMin&&nowMinute<t.startMin+displayLength);
    if(live){
     decision={state:"watch",label:id==="activity_once_show"?"ONCE đã bắt đầu theo lịch":"Đã bắt đầu theo lịch",nextMin:live.startMin,endMin:live.startMin+displayLength};
     summary=id==="activity_once_show"?
      hhmm(live.startMin)+"-"+hhmm(live.startMin+20)+" · show ONCE":
      Number.isFinite(listedLength)&&listedLength>0?
      hhmm(live.startMin)+"-"+hhmm(live.startMin+displayLength)+" · "+(e.duration||"Theo lịch show"):
      hhmm(live.startMin)+" · Giờ bắt đầu niêm yết";
     note=id==="activity_once_show"?
      "Show đang trong khung giờ niêm yết; cần vé vào công viên. Kiểm tra tình trạng thực tế tại điểm.":
      "Show đã đến giờ bắt đầu theo lịch. Kiểm tra tình trạng thực tế tại điểm; không phải xác nhận đang diễn.";
     score=4;
    }else if(next){
     decision={state:"future",label:id==="activity_once_show"?"ONCE lúc "+next.start:"Bắt đầu lúc "+next.start,nextMin:next.startMin};
     const length=Number(item.performance_duration_min)||durationMin(e.duration),end=Number.isFinite(length)?next.startMin+length:NaN;
     summary=Number.isFinite(end)?next.start+"-"+hhmm(end)+" · "+(e.duration||"Theo lịch show"):next.start+" · Theo lịch show";
     if(id==="activity_once_show")note="Sau khoảng 17:00, phần lớn trò chơi đã ngừng. ONCE 18:45-19:05 theo lịch; cần vé vào VinWonders.";
     score=id==="activity_once_show"?235+(next.startMin-nowMinute)/20:250+(next.startMin-nowMinute)/12;
    }

   }else if(id==="activity_hon_thom"&&valid&&opening.schedule_type==="MULTI_WINDOW"){
    // The first cable pause does not end the day's Hòn Thơm service.
    const windows=(opening.windows||[]).map(w=>({...w,startMin:minute(w.start),endMin:minute(w.end)}))
      .filter(w=>Number.isFinite(w.startMin)&&Number.isFinite(w.endMin)&&w.endMin>w.startMin)
      .sort((a,b)=>a.startMin-b.startMin);
    const current=windows.find(w=>nowMinute>=w.startMin&&nowMinute<w.endMin);
    const following=windows.find(w=>w.startMin>nowMinute);
    summary=windows.map(w=>w.start+"-"+w.end).join(" · ");
    if(current){
     const later=windows.find(w=>w.startMin>=current.endMin);
     const left=current.endMin-nowMinute,nearEnd=left<=15;
     if(later){
      decision={state:nearEnd?"watch":"active",
       label:nearEnd?"Sắp nghỉ lúc "+current.end:"Nghỉ lúc "+current.end+", chiều vẫn còn cáp",
       endMin:current.endMin,remainingMin:left,nextMin:later.startMin};
      const rest=windows.filter(w=>w.startMin>=current.endMin);
       const laterTimes=rest.map(w=>w.start+"-"+w.end).join(rest.length===2?" và ": ", ");
       note="Cáp nghỉ từ "+current.end+" đến "+later.start+". "+
         (rest.length===1?"Còn một khung giờ: ":rest.length===2?"Buổi chiều vẫn còn hai khung giờ: ":"Các khung giờ còn lại: ")+laterTimes+".";
      score=nearEnd?34:54;
     }else{
      decision={state:nearEnd?"watch":"active",
       label:nearEnd?"Sắp hết giờ cáp hôm nay":"Đây là khung giờ cáp cuối hôm nay",
       endMin:current.endMin,remainingMin:left};
      note="Cáp kết thúc lúc "+current.end+" theo lịch. Nhớ kiểm tra giờ cáp lượt về trước khi lên đảo.";
      score=nearEnd?17:65;
     }
    }else if(following){
     const paused=windows.some(w=>w.endMin<=nowMinute);
     decision={state:"future",
      label:paused?"Đang nghỉ theo lịch, chạy lại lúc "+following.start:"Cáp bắt đầu lúc "+following.start,
      nextMin:following.startMin,endMin:following.endMin};
     note="Các khung cáp còn lại: "+windows.filter(w=>w.startMin>=following.startMin).map(w=>w.start+"-"+w.end).join(" · ")+". Kiểm tra giờ cáp lượt về trước khi đi.";
     score=paused?145+(following.startMin-nowMinute)/20:185+(following.startMin-nowMinute)/20;
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
      decision={state:nowMinute>=11*60?"watch":"active",label:"Nhiều trò chơi kết thúc khoảng 17:00",endMin:gamesEnd,remainingMin:gamesEnd-nowMinute};
      note="Công viên đóng lúc 19:30. Nhiều trò chơi kết thúc khoảng 17:00; show ONCE diễn ra 18:45-19:05 theo lịch.";
     }else if(nowMinute<onceEnd){
      decision={state:"watch",label:nowMinute<onceStart?"Nhiều trò chơi đã kết thúc":"Đã đến giờ ONCE theo lịch",endMin:onceEnd,remainingMin:onceEnd-nowMinute};
      note="Nhiều trò chơi đã kết thúc. ONCE diễn ra 18:45-19:05 theo lịch; kiểm tra lịch thực tế trước khi đến.";
     }else{
      decision={state:"watch",label:"ONCE đã kết thúc theo lịch",endMin:w.endMin,remainingMin:remain};
      note="Nhiều trò chơi đã kết thúc và ONCE đã qua giờ theo lịch. Công viên đóng lúc 19:30.";
     }
     summary="Công viên "+w.start+"-"+w.end+" · Nhiều trò chơi đến khoảng 17:00";
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
     if(id==="place_dinh_cau"&&Number.isFinite(sunsetMinute)&&nowMinute>=sunsetMinute){
      note="Hoàng hôn đã qua. Nếu đang ở gần, xem giờ tham quan còn lại; không cần chạy xa chỉ để ghé lúc này.";
     }else if(id==="place_dinh_cau" && sunsetLevel==="bad"){
      note=sunsetWx.reason==="observed_weather"
       ?"Quan trắc gần bờ Tây đang ghi nhận thời tiết xấu. Xem khu vực cụ thể trước khi di chuyển."
       :"Dự báo quanh giờ hoàng hôn cho thấy khả năng mưa đáng kể hơn. Đây là dự báo, không phải xác nhận đang mưa.";
     }else if(id==="place_dinh_cau" && sunsetLevel==="watch"){
      if(sunsetWx.reason==="observed_rain"){
       note="Có điểm bờ Tây đang ghi nhận mưa. Xem khu vực mình sắp tới trước khi đi.";
      }else if(sunsetWx.reason==="horizon_cloud"){
       const areas=Array.isArray(sunsetWx.horizon_cloud_points)?sunsetWx.horizon_cloud_points.filter(Boolean):[];
       note=areas.length===1
        ?"Mây đang dày hơn trên hướng chân trời ở "+areas[0]+". Mặt trời có thể bị che lúc lặn."
        :areas.length>1
         ?"Mây đang dày hơn trên hướng chân trời ở "+areas.join(" và ")+". Một phần bờ Tây có thể bị che lúc mặt trời lặn."
         :"Ảnh vệ tinh đang thấy mây dày hơn trên hướng chân trời hoàng hôn. Mặt trời có thể bị che lúc lặn.";
      }else if(sunsetWx.reason==="cloud_approaching"){
       note="Mây đối lưu đang có quỹ đạo tiến về bờ Tây. Khả năng thấy mặt trời lặn có thể giảm.";
      }else if(sunsetWx.reason==="low_visibility"){
       note="Tầm nhìn đang giảm. Hoàng hôn có thể kém rõ dù không nhất thiết có mưa.";
      }else if(sunsetWx.reason==="satellite_convection"){
       note="Có mây đối lưu quanh khu vực, nhưng chưa đủ bằng chứng để coi là mưa tại bờ Tây.";
      }else{
       note="Dự báo quanh giờ hoàng hôn có tín hiệu mưa cục bộ. Sẽ tiếp tục cập nhật khi gần giờ.";
      }
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
   const row={item,e,opening,eligible:true,decision,summary,note,score,latestStart};
   row.urgency=urgency(row,nowMinute);
   out.push(row);
  }
  return out.sort((a,b)=>(a.eligible===b.eligible?comparePriority(a,b):a.eligible?-1:1));
 }
 global.OpenPQTripClockPlanner={plan,select,minute,durationMin};
})(window);
