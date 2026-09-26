/* Open Phu Quoc /go V1. Pure decision composition: no provider fetches or booking claims. */
(function(root,factory){
  const api=factory();
  root.OpenPQGoEngine=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(){
  "use strict";
  const TZ="Asia/Ho_Chi_Minh";
  const fold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLowerCase();
  const minTime=s=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(s||""));return m?+m[1]*60 + +m[2]:NaN};
  const hhmm=n=>String(Math.floor(n/60)%24).padStart(2,"0")+":"+String(Math.round(n)%60).padStart(2,"0");
  // Vietnam has no DST; use the itinerary day as a calendar anchor and retain the UTC+7 offset.
  const localDateTime=(day,minute)=>new Date(Date.parse(day+"T00:00:00Z")+minute*60000).toISOString().slice(0,16)+"+07:00";
  function clock(now){
    const date=now instanceof Date?now:new Date(now||Date.now());
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);
    const get=k=>parts.find(p=>p.type===k)?.value||"";
    const day=[get("year"),get("month"),get("day")].join("-");
    return {day,minute:+get("hour")*60 + +get("minute"),weekday:new Date(day+"T12:00:00Z").getUTCDay()};
  }
  const ageDays=(iso,day)=>{if(!iso)return Infinity;const date=String(iso).slice(0,10);const delta=(Date.parse(day+"T00:00:00Z")-Date.parse(date+"T00:00:00Z"))/86400000;return Number.isFinite(delta)?Math.max(0,delta):Infinity};
  const duration=s=>{const m=fold(s).match(/(\d+(?:[.,]\d+)?)\s*(?:[-–]\s*\d+(?:[.,]\d+)?\s*)?(gio|phut)/);return m?Math.round(Number(m[1].replace(",","."))*(m[2]==="gio"?60:1)):null};
  const minutesByArea={
    zone_central_west:{zone_central_west:[8,25],zone_south:[40,70],zone_north:[45,75]},
    zone_south:{zone_central_west:[35,60],zone_south:[10,30],zone_north:[75,105]},
    zone_north:{zone_central_west:[45,75],zone_south:[85,120],zone_north:[10,30]}
  };
  function travel(origin,dest){
    if(!origin||!dest||!minutesByArea[origin]?.[dest])return null;
    const [low,high]=minutesByArea[origin][dest];
    return {low,high,minutes:high,explanation:"Ước lượng theo khu vực, không phải thời gian đường đi trực tiếp."};
  }
  function minutesBudget(value,now){
    if(value==="evening")return Math.max(0,23*60-Math.max(now,17*60));
    return ({two:120,half:300,full:720})[value]||120;
  }
  function windows(e,cfg,input){
    const oh=e.opening_hours||{};
    const status=oh.state||"";
    if((oh.closed_weekdays||[]).includes(input.weekday))return [];
    if(status==="PUBLISHED_SCHEDULE"||status==="APPROXIMATE_SCHEDULE"){
      if(oh.schedule_type==="FIXED_START")return(oh.times||[]).map(t=>({start:minTime(t.start),end:minTime(t.start)+(cfg.minimum_visit_min||30),fixed:true,label:t.label||e.name})).filter(w=>Number.isFinite(w.start));
      return(oh.windows||[]).map(w=>({start:minTime(w.start),end:minTime(w.end),fixed:cfg.schedule_exact_window===true,label:w.label||e.name})).filter(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start);
    }
    if(cfg.soft_window){
      const start=minTime(cfg.soft_window.start),end=minTime(cfg.soft_window.end);
      if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)return[{start,end,fixed:false,soft:true}];
    }
    return [];
  }
  function fit(e,cfg,input,drive,clockValue,budget){
    const now=clockValue.minute,originStart=input.available==="evening"?Math.max(now,17*60):now;
    const arrival=originStart+drive.minutes+(cfg.entry_buffer_min||10);
    const minVisit=cfg.minimum_visit_min||duration(e.duration)||45;
    const limit=Math.min(24*60,originStart+budget);
    const publishedWindows=windows(e,cfg,clockValue);
    if(cfg.split_return_schedule){
      const ride=Number.isFinite(cfg.ride_minutes)?cfg.ride_minutes:15;
      const options=[];
      // Published Hòn Thơm windows contain breaks: outbound and return
      // may occur in different windows. Never assume the cable runs between.
      for(const outbound of publishedWindows){
        const depart=Math.max(arrival,outbound.start);
        if(depart+ride>outbound.end)continue;
        const readyToReturn=depart+ride+minVisit;
        for(const inbound of publishedWindows){
          const returnAt=Math.max(readyToReturn,inbound.start);
          const finish=returnAt+ride+(cfg.return_buffer_min||0);
          if(returnAt<inbound.start||finish>inbound.end||finish>limit)continue;
          options.push({
            start:depart,finish,arrival,
            deadline:Math.max(0,Math.min(outbound.end-ride,returnAt-ride-minVisit)-drive.minutes-(cfg.entry_buffer_min||10)),
            window:{fixed:true,return_start:returnAt,label:"Cáp đi "+hhmm(depart)+" · cáp về "+hhmm(returnAt)},
            margin:Math.min(inbound.end-finish,limit-finish)
          });
          break;
        }
      }
      return options.sort((a,b)=>a.finish-b.finish)[0]||null;
    }
    const opts=publishedWindows.map(w=>{
      if(w.fixed){
        if(arrival>w.start||w.end>limit)return null;
        return {start:w.start,finish:w.end,arrival,deadline:w.start-(cfg.entry_buffer_min||10)-drive.minutes,window:w,margin:w.start-arrival};
      }
      const start=Math.max(arrival,w.start);
      const finish=start+minVisit+(cfg.return_buffer_min||0);
      if(finish>w.end||finish>limit)return null;
      return {start,finish,arrival,deadline:Math.min(w.end-minVisit-(cfg.return_buffer_min||0),limit-minVisit-(cfg.return_buffer_min||0))-drive.minutes-(cfg.entry_buffer_min||10),window:w,margin:Math.min(w.end,limit)-finish};
    }).filter(Boolean).sort((a,b)=>a.finish-b.finish);
    return opts[0]||null;
  }
  function matches(e,cfg,interest){
    if(!interest||interest==="all")return true;
    return [...(e.intents||[]),...(e.categories||[]),...(cfg.intents||[])].some(x=>fold(x)===fold(interest));
  }
  function freshOperational(record,day,now,kind){
    if(!record||!["fresh","aging"].includes(record.freshness))return false;
    if(record.category&&kind&&record.category!==kind)return false;
    if(record.source_date&&record.source_date!==day)return false;
    if(record.day&&record.day!==day)return false;
    if(record.evidence_count===0)return false;
    const stamp=record.source_updated_at||record.verified_at||record.updated_at||record.observed_at;
    const time=Date.parse(stamp||""),current=+new Date(now);
    if(!Number.isFinite(time)||!Number.isFinite(current))return false;
    const minutes=(current-time)/60000;
    return minutes>=-5&&minutes<=720&&clock(new Date(time)).day===day;
  }
  const unknownWeather=()=>({status:"unknown",freshness:"unknown",source_updated_at:null,scope:"POINT"});
  function destinationWeather(live,zone,originZone){
    if(live?.weather_by_zone)return live.weather_by_zone[zone]||unknownWeather();
    // Legacy callers may supply only their origin point, never assume it
    // describes a different destination or an offshore travel route.
    return zone===originZone?live?.weather||unknownWeather():unknownWeather();
  }
  function assessLive(e,cfg,live,notices,day,now,originZone){
    const warnings=[];
    const cancelled=(notices||[]).some(n=>
      n.entity_id===e.id&&n.date===day&&
      ["CANCELLED","SUSPENDED","CLOSED","TEMPORARILY_CLOSED"].includes(String(n.status).toUpperCase())
    );
    if(cancelled)return {blocked:true,reason:"Hoạt động có thông báo tạm hủy hoặc tạm ngưng hôm nay."};

    const binding=cfg.operational_binding||null;
    if(cfg.marine&&!binding){
      warnings.push("Chưa gắn nguồn xác nhận riêng cho phương tiện của hoạt động này.");
    }else if(binding){
      const record=live?.[binding]||{};
      const fresh=freshOperational(record,day,now,binding);
      const state=String(record.state||record.raw_state||"UNKNOWN").toUpperCase();
      if(fresh&&["SUSPENDED","CANCELLED","CLOSED","STOPPED"].includes(state)){
        const label=binding==="cano"?"Cano":binding==="charter_boat"?"Tàu câu cá":
          binding==="cable_car"?"Cáp treo":binding==="fast_boat"?"Tàu cao tốc":
          binding==="ferry"?"Phà":"Phương tiện";
        return {blocked:true,reason:label+" được xác nhận tạm dừng cho ngày hôm nay."};
      }
      if(fresh&&["fast_boat","ferry"].includes(binding)&&state==="DIRECT_CONFIRMED"){
        warnings.push("Đã xác nhận một số chuyến rời cảng, chưa xác nhận chuyến bạn định đi.");
      }
      if(!fresh||!["DIRECT_CONFIRMED","RUNNING"].includes(state)){
        if(binding==="cable_car"&&cfg.schedule_owner_confirmed===true&&
           e.opening_hours?.state==="PUBLISHED_SCHEDULE"){
          warnings.push("Lịch cáp đã được xác nhận. Theo dõi thay đổi vận hành trong ngày đi.");
        }else warnings.push(binding==="charter_boat"
          ?"Chưa có xác nhận riêng cho chuyến tàu câu cá hôm nay; liên hệ đơn vị tổ chức."
          :binding==="cano"?"Chưa có xác nhận cano hoạt động đủ mới trong ngày."
          :binding==="cable_car"?"Cần xác nhận lịch cáp treo và lượt về trong ngày."
          :"Chưa có xác nhận vận hành đủ mới cho phương tiện này.");
      }
    }

    const weather=destinationWeather(live,e.zone_id,originZone);
    const outdoor=cfg.environment==="outdoor"||cfg.environment==="marine";
    if(outdoor){
      if(!weather.source_updated_at||!["fresh","aging"].includes(weather.freshness)||
         !["normal","watch","advisory"].includes(weather.status)){
        warnings.push("Chưa có dữ liệu thời tiết đủ mới tại khu vực điểm đến.");
      }else if(["watch","advisory","bad"].includes(weather.status)){
        warnings.push("Thời tiết tại khu vực điểm đến cần theo dõi trước khi đi.");
      }
    }
    if(cfg.marine){
      const route=cfg.marine_route&&live?.marine_route?.[cfg.marine_route];
      if(!route||!["fresh","aging"].includes(route.freshness)||
         !["normal","watch","advisory"].includes(route.status)){
        warnings.push("Chưa có đánh giá sóng/gió đủ mới theo tuyến ra khơi; cần xác nhận riêng.");
      }else if(route.status!=="normal"){
        warnings.push("Điều kiện biển trên tuyến cần kiểm tra trực tiếp trước khi xuất bến.");
      }
    }
    if(cfg.return_check)warnings.push("Cần xác nhận lịch hoặc phương tiện lượt về.");
    return {blocked:false,warnings};
  }
  function plan(input){
    const when=clock(input.now),cfgList=input.config?.activities||[],entities=input.entities instanceof Map?input.entities:new Map((input.entities||[]).map(e=>[e.id,e]));
    const budget=minutesBudget(input.available,when.minute),results=[],excluded=[];
    for(const cfg of cfgList){
      const e=entities.get(cfg.entity_id);
      if(!e){excluded.push({id:cfg.entity_id,reason:"Thiếu dữ liệu địa điểm"});continue}
      if(!matches(e,cfg,input.interest))continue;
      const geo=typeof window!=="undefined"?window.OpenPQGoGeo:globalThis.OpenPQGoGeo;
      const point=geo?.destinationPoint?.(e);
      const straightKm=geo?.valid?.(input.position)&&point?geo.distanceKm(input.position,point):null;
      // V1.1 radius is a straight-line discovery filter. Unknown coordinates
      // are never represented as being inside the selected circle.
      if(geo?.valid?.(input.position)&&input.radiusKm){
        if(straightKm===null){excluded.push({id:e.id,reason:"Chưa có tọa độ đủ rõ để xét bán kính"});continue}
        if(straightKm>Number(input.radiusKm)){excluded.push({id:e.id,reason:"Nằm ngoài bán kính bạn chọn"});continue}
      }
      const drive=travel(input.originZone,e.zone_id);
      if(!drive){excluded.push({id:e.id,reason:"Chưa có vị trí đủ rõ để tính đường đi"});continue}
      const liveCheck=assessLive(e,cfg,input.live,input.notices,when.day,input.now||new Date(),input.originZone);
      if(liveCheck.blocked){excluded.push({id:e.id,reason:liveCheck.reason});continue}
      const match=fit(e,cfg,input,drive,when,budget);
      if(!match){excluded.push({id:e.id,reason:"Không đủ thời gian theo lịch công bố và thời lượng trải nghiệm"});continue}
      const opening=e.opening_hours||{};
      const warnings=[...liveCheck.warnings];
      if(opening.state!=="PUBLISHED_SCHEDULE")warnings.push("Khung giờ tham khảo, chưa phải xác nhận đang mở.");
      if(!cfg.schedule_owner_confirmed&&ageDays(opening.verified_at,when.day)>(opening.schedule_type==="FIXED_START"?7:30))warnings.push("Nên xác nhận lại giờ hoạt động của ngày đi.");
      if(match.margin<20)warnings.push("Lịch trình khá sát giờ, nên kiểm tra đường đi và giờ nhận khách.");
      const badge=warnings.length?"CHECK":"POSSIBLE";
      results.push({
        id:e.id,name:e.name,zone:e.zone_id,route:cfg.route||"/explore/",
        category:cfg.category||"TRẢI NGHIỆM",badge,travel:drive,distance_km:straightKm,weather_scope:cfg.marine?"marine":(cfg.environment==="indoor"||cfg.environment==="covered"?"indoor":"outdoor"),
        arrival:hhmm(match.arrival),starts_at:hhmm(match.start),finish_at:hhmm(match.finish),
        arrival_at:localDateTime(when.day,match.arrival),starts_at_local:localDateTime(when.day,match.start),finish_at_local:localDateTime(when.day,match.finish),
        time_left:Math.max(0,match.deadline-when.minute),
        timing:cfg.split_return_schedule?match.window.label:match.window.fixed?"Suất theo lịch "+hhmm(match.start)+" - "+hhmm(match.finish):"Dự kiến bắt đầu "+hhmm(match.start),
        note:cfg.description||e.what_it_is||"",
        warnings,source:"Lịch công bố · di chuyển ước tính",
        score:(badge==="POSSIBLE"?0:10000)+(matches(e,cfg,input.interest)&&input.interest!=="all"?-150:0)+Math.max(0,match.deadline-when.minute)*-0.2+drive.minutes*1.4+(straightKm===null?0:straightKm*2)+(cfg.order||0)
      });
    }
    results.sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,"vi"));
    return {day:when.day,now:hhmm(when.minute),budget,results:results.slice(0,3),remaining:results.slice(3),eligible:results,excluded,eligible_count:results.length,has_live:!!input.live};
  }

  function weatherWindowItems(view,config,entities){
    const geo=typeof window!=="undefined"?window.OpenPQGoGeo:globalThis.OpenPQGoGeo;
    const candidates=Array.isArray(view?.eligible)?view.eligible:[];
    const cfgById=new Map((config?.activities||[]).map(item=>[item.entity_id,item]));
    const entityMap=entities instanceof Map?entities:new Map((entities||[]).map(item=>[item.id,item]));
    const allowedPrecision=new Set(["verified_point","site_centroid","area_anchor"]);
    const out=[];
    for(const candidate of candidates){
      if(!["outdoor","marine"].includes(candidate.weather_scope)||out.length>=20)continue;
      const cfg=cfgById.get(candidate.id)||{};
      const from=candidate.arrival_at,to=candidate.finish_at_local;
      const hasOffset=value=>typeof value==="string"&&/(?:Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value));
      if(!hasOffset(from)||!hasOffset(to)||Date.parse(to)<=Date.parse(from))continue;
      if(candidate.weather_scope==="marine"){
        out.push({entity_id:candidate.id,activity_scope:"marine",route_id:cfg.marine_route||cfg.marine_route_id||null,
          window:{from,to}});
        continue;
      }
      const entity=entityMap.get(candidate.id);
      let point=geo?.destinationPoint?.(entity),precision=point?.precision;
      if(!point||!geo?.valid?.(point)||!allowedPrecision.has(precision)){
        const anchor=geo?.anchors?.[candidate.zone||entity?.zone_id];
        if(!anchor||!geo?.valid?.(anchor))continue;
        point=anchor;precision="area_anchor";
      }
      out.push({entity_id:candidate.id,activity_scope:"outdoor",
        location:{lat:Number(point.lat),lon:Number(point.lon),precision},
        window:{from,to}});
    }
    return out;
  }

  function applyWeatherContext(view,payload,{pending=false}={}){
    if(!view||!Array.isArray(view.eligible))return view;
    const byId=new Map((Array.isArray(payload?.items)?payload.items:[]).map(item=>[item?.entity_id,item]));
    for(const candidate of view.eligible){
      if(!["outdoor","marine"].includes(candidate.weather_scope))continue;
      const item=byId.get(candidate.id)||null;
      const oldCheck=candidate.badge==="CHECK";
      const baseScore=Number.isFinite(candidate.score)?candidate.score-(oldCheck?10000:0):candidate.score;
      const keep=(candidate.warnings||[]).filter(text=>!String(text).startsWith("Dự báo khung giờ:"));
      let note,status;
      if(candidate.weather_scope==="marine"){
        status=item?.status|| (pending?"PENDING":"UNKNOWN");
        note="Dự báo khung giờ: Chưa có nguồn Weather theo tuyến biển; cần kiểm tra thời tiết và xác nhận vận hành trước khi đi.";
      }else if(pending){
        status="PENDING";
        note="Dự báo khung giờ: Đang kiểm tra dữ liệu theo thời gian dự kiến.";
      }else if(item?.status==="OK"&&item?.temporal_coverage?.status==="IN_WINDOW_FRAMES"&&Array.isArray(item.frames)&&item.frames.length){
        status="OK";
        const distances=item.frames.map(frame=>frame?.native_cell?.distance_from_target_km).filter(Number.isFinite);
        const near=distances.length?"; ô lưới gần nhất cách "+Math.min(...distances).toFixed(1)+" km":"";
        const cadence=item.temporal_coverage.frame_cadence_hours;
        const cadenceLabel=Number.isFinite(cadence)?"; nhịp mốc "+cadence+" giờ":"";
        const targetLabel=item.target?.precision==="area_anchor"?"tâm khu vực":item.target?.precision==="site_centroid"?"tâm khuôn viên":"điểm đã chọn";
        note="Dự báo khung giờ: Có "+item.frames.length+" mốc tại "+targetLabel+cadenceLabel+near+"; chưa có đánh giá an toàn tự động.";
      }else if(item?.temporal_coverage?.status==="BRACKET_ONLY"){
        status=item.status||"PARTIAL";
        note="Dự báo khung giờ: Chỉ có mốc trước/sau khung giờ, không nội suy; cần kiểm tra trực tiếp.";
      }else if(candidate.weather_scope==="marine"||item?.reason_codes?.includes("ROUTE_SOURCE_UNSUPPORTED")){
        status=item?.status||"UNKNOWN";
        note="Dự báo khung giờ: Chưa có nguồn Weather theo tuyến biển; cần kiểm tra thời tiết và xác nhận vận hành trước khi đi.";
      }else{
        status=item?.status||payload?.source_status||"UNAVAILABLE";
        note="Dự báo khung giờ: Chưa có đủ dữ liệu cho toàn bộ khoảng dự kiến; hãy xem Weather trước khi đi.";
      }
      candidate.weather_context={status,temporal_coverage:item?.temporal_coverage||{status:"NOT_EVALUATED"},source:item?.source||null};
      candidate.warnings=[...keep,note];
      candidate.badge="CHECK";
      if(Number.isFinite(baseScore))candidate.score=baseScore+10000;
    }
    view.eligible.sort((a,b)=>(a.score||0)-(b.score||0)||String(a.name).localeCompare(String(b.name),"vi"));
    view.results=view.eligible.slice(0,3);
    view.remaining=view.eligible.slice(3);
    view.eligible_count=view.eligible.length;
    return view;
  }

  return {plan,clock,travel,minutesBudget,minTime,weatherWindowItems,applyWeatherContext};
});