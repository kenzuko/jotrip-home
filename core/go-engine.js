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
  const coordinate=(value)=>value&&Number.isFinite(Number(value.lat))&&Number.isFinite(Number(value.lon))?{lat:Number(value.lat),lon:Number(value.lon)}:null;
  function distanceKm(a,b){
    const from=coordinate(a),to=coordinate(b);
    if(!from||!to)return null;
    const r=Math.PI/180,dl=(to.lat-from.lat)*r,dn=(to.lon-from.lon)*r;
    const h=Math.sin(dl/2)**2+Math.cos(from.lat*r)*Math.cos(to.lat*r)*Math.sin(dn/2)**2;
    return 12742*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function islandLocation(value){
    const p=coordinate(value);
    return !!p&&p.lat>=9.8&&p.lat<=10.55&&p.lon>=103.72&&p.lon<=104.22;
  }
  function travel(origin,dest,originCoords,place){
    if(!origin||!dest||!minutesByArea[origin]?.[dest])return null;
    const [zoneLow,zoneHigh]=minutesByArea[origin][dest];
    const approx={low:zoneLow,high:zoneHigh,minutes:zoneHigh,mode:"zone",explanation:"Ước lượng theo khu vực, không phải thời gian đường đi trực tiếp."};
    // A geo estimate is allowed only for a verified site point, never for an area
    // anchor, borrowed island centroid or a low-accuracy GPS fix.
    if(!islandLocation(originCoords)||Number(originCoords?.accuracy)>1000||!place||place.precision!=="site_centroid"||!place.verified_at)return approx;
    const km=distanceKm(originCoords,place);
    if(km===null||km>65)return approx;
    const low=Math.max(5,Math.ceil(km*1.2/35*60+5));
    const high=Math.max(low+6,Math.ceil(km*1.65/25*60+8));
    return {low,high,minutes:high,mode:"gps-estimate",straightKm:km,explanation:"Khoảng cách đường thẳng từ GPS; thời gian xe chỉ là ước lượng, chưa có dữ liệu tuyến đường."};
  }
  function minutesBudget(value,now){
    if(value==="evening")return Math.max(0,23*60-Math.max(now,17*60));
    return ({two:120,half:300,full:600})[value]||120;
  }
  function windows(e,cfg,input){
    const oh=e.opening_hours||{};
    const status=oh.state||"";
    if((oh.closed_weekdays||[]).includes(input.weekday))return [];
    if(status==="PUBLISHED_SCHEDULE"||status==="APPROXIMATE_SCHEDULE"){
      if(oh.schedule_type==="FIXED_START")return(oh.times||[]).map(t=>({start:minTime(t.start),end:minTime(t.start)+(cfg.minimum_visit_min||30),fixed:true,label:t.label||e.name})).filter(w=>Number.isFinite(w.start));
      return(oh.windows||[]).map(w=>({start:minTime(w.start),end:minTime(w.end),fixed:false})).filter(w=>Number.isFinite(w.start)&&Number.isFinite(w.end)&&w.end>w.start);
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
    const opts=windows(e,cfg,clockValue).map(w=>{
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
  function freshOperational(record,day){
    if(!record)return false;
    const stamp=record.source_updated_at||record.verified_at||record.updated_at||record.observed_at;
    return !!stamp&&String(stamp).slice(0,10)===day&&record.freshness!=="stale";
  }
  function assessLive(e,cfg,live,notices,day){
    const warnings=[];
    const cancelled=(notices||[]).some(n=>
      n.entity_id===e.id&&n.date===day&&
      ["CANCELLED","SUSPENDED","CLOSED","TEMPORARILY_CLOSED"].includes(String(n.status).toUpperCase())
    );
    if(cancelled)return {blocked:true,reason:"Hoạt động có thông báo tạm hủy hoặc tạm ngưng hôm nay."};
    if(cfg.marine){
      const cano=live?.cano||{},state=cano.state||cano.raw_state||"UNKNOWN";
      if(freshOperational(cano,day)&&state==="SUSPENDED")return {blocked:true,reason:"Cano được xác nhận tạm dừng hôm nay."};
      if(!freshOperational(cano,day)||!["DIRECT_CONFIRMED","RUNNING"].includes(state))
        warnings.push("Chưa có xác nhận cano hoạt động hôm nay.");
    }
    const weather=live?.weather||{},outdoor=cfg.environment==="outdoor"||cfg.environment==="marine";
    if(outdoor){
      if(!weather.source_updated_at||["stale","unknown"].includes(weather.freshness||"unknown")||!["fresh","aging"].includes(weather.freshness))
        warnings.push("Chưa có cập nhật thời tiết đủ mới cho khu vực.");
      else if(["watch","advisory","bad"].includes(weather.status))
        warnings.push("Thời tiết cần theo dõi trước khi đi.");
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
      const gps=islandLocation(input.originCoords)&&Number(input.originCoords.accuracy)<=1000?input.originCoords:null;
      const point=e.map&&islandLocation(e.map)?e.map:null;
      const directKm=gps&&point?distanceKm(gps,point):null;
      if(gps&&Number.isFinite(Number(input.radiusKm))&&Number(input.radiusKm)>0){
        if(directKm===null){excluded.push({id:e.id,reason:"Chưa có tọa độ đủ rõ để lọc theo bán kính GPS"});continue}
        if(directKm>Number(input.radiusKm)){excluded.push({id:e.id,reason:"Nằm ngoài bán kính bạn chọn"});continue}
      }
      const drive=travel(input.originZone,e.zone_id,gps,point);
      if(!drive){excluded.push({id:e.id,reason:"Chưa có vị trí đủ rõ để tính đường đi"});continue}
      const liveCheck=assessLive(e,cfg,input.live,input.notices,when.day);
      if(liveCheck.blocked){excluded.push({id:e.id,reason:liveCheck.reason});continue}
      const match=fit(e,cfg,input,drive,when,budget);
      if(!match){excluded.push({id:e.id,reason:"Không đủ thời gian theo lịch công bố và thời lượng trải nghiệm"});continue}
      const opening=e.opening_hours||{};
      const warnings=[...liveCheck.warnings];
      if(gps&&point&&point.precision!=="site_centroid")warnings.push("Pin chỉ vị trí khu vực, chưa xác nhận đúng cổng vào.");
      if(drive.mode==="gps-estimate")warnings.push("Thời gian di chuyển là ước lượng, hãy xem đường đi thực tế trước khi xuất phát.");
      if(opening.state!=="PUBLISHED_SCHEDULE")warnings.push("Khung giờ tham khảo, chưa phải xác nhận đang mở.");
      if(ageDays(opening.verified_at,when.day)>(opening.schedule_type==="FIXED_START"?7:30))warnings.push("Nên xác nhận lại giờ hoạt động của ngày đi.");
      if(match.margin<20)warnings.push("Lịch trình khá sát giờ, nên kiểm tra đường đi và giờ nhận khách.");
      const badge=warnings.length?"CHECK":"POSSIBLE";
      results.push({
        id:e.id,name:e.name,zone:e.zone_id,route:cfg.route||"/explore/",
        category:cfg.category||"TRẢI NGHIỆM",badge,travel:drive,
        geoDistanceKm:directKm,geoPrecision:point?.precision||null,geoPoint:point?{lat:point.lat,lon:point.lon}:null,
        arrival:hhmm(match.arrival),starts_at:hhmm(match.start),finish_at:hhmm(match.finish),
        time_left:Math.max(0,match.deadline-when.minute),
        timing:match.window.fixed?"Suất theo lịch "+hhmm(match.start):"Dự kiến bắt đầu "+hhmm(match.start),
        note:cfg.description||e.what_it_is||"",
        warnings,source:"Lịch công bố · di chuyển ước tính",
        score:(badge==="POSSIBLE"?0:10000)+(matches(e,cfg,input.interest)&&input.interest!=="all"?-150:0)+Math.max(0,match.deadline-when.minute)*-0.2+drive.minutes*1.4+(cfg.order||0)
      });
    }
    results.sort((a,b)=>a.score-b.score||a.name.localeCompare(b.name,"vi"));
    return {day:when.day,now:hhmm(when.minute),budget,results:results.slice(0,3),remaining:results.slice(3),excluded,eligible_count:results.length,has_live:!!input.live};
  }
  return {plan,clock,travel,distanceKm,islandLocation,minutesBudget,minTime};
});