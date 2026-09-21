const DATA_BASE='https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-sunairport/data/sunairport';
const LIVE_API_URL=(window.JOTRIP_LIVE_API_URL||'').replace(/\/$/,'');
const AUTO_REFRESH_MS=60*1000;
const LIVE_TIMEOUT_MS=4500;
const SNAPSHOT_TIMEOUT_MS=6500;
async function fetchWithTimeout(url,init={},ms=LIVE_TIMEOUT_MS){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try{return await fetch(url,{...init,signal:controller.signal})}
  finally{clearTimeout(timer)}
}
const state={latest:null,health:null,direction:'arrival',filter:'all',query:'',limit:8,mode:'live',lastFetchAt:0,loading:false,versionChecking:false,versionEndpointDisabled:false,liveVersion:null,dataSource:'snapshot',liveError:null,fidsEvents:[],fidsHistoryLoaded:false,fidsHistoryLoading:false,fidsHistoryDate:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function uiT(key,fallback,vars){try{return typeof window.JT_T==='function'?window.JT_T(key,vars):fallback}catch(_){return fallback}}
function uiStatus(value){try{return typeof window.JT_STATUS==='function'?window.JT_STATUS(value):value}catch(_){return value}}
const typographyLink=document.createElement('link');typographyLink.rel='stylesheet';typographyLink.href='./typography.css?v=20260916a';document.head.appendChild(typographyLink);

function vnNowParts(date=new Date()){
  const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const o={};p.forEach(x=>o[x.type]=x.value);return o;
}
function mins(t){if(!t)return null;const m=String(t).match(/(\d{1,2}):(\d{2})/);return m?+m[1]*60 + +m[2]:null}
function nowMinutes(){const p=vnNowParts();return +p.hour*60 + +p.minute}
function foldText(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toUpperCase().replace(/\s+/g,' ').trim()}
function ageInfo(iso){if(!iso)return {level:'bad',label:'Không rõ',minutes:null};const m=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));if(m<=8)return{level:'good',label:m+' phút',minutes:m};if(m<=15)return{level:'watch',label:m+' phút',minutes:m};return{level:'stale',label:m+' phút',minutes:m}}
function stationLabel(s){const base=(s||'').replace('HO CHI MINH','TP.HCM').replace('HA NOI','HÀ NỘI').replace('DA NANG','ĐÀ NẴNG').replace('HAI PHONG','HẢI PHÒNG').replace('CAN THO','CẦN THƠ').replace('CAM RANH','CAM RANH').replace('PUDONG- SHANGHAI','SHANGHAI').replace('XIANYANG-XI AN','XI\'AN');try{return typeof window.JT_STATION==='function'?window.JT_STATION(base):base}catch(_){return base}}
function airlineFromContext(c){const m=(c||'').match(/•\s*([^|]+)/);return m?m[1].trim():''}
function airlineFor(r){return r?.airline_name||airlineFromContext(r?.context)||r?.airline_code||''}

// FR24 live lookup uses the operator's ICAO designator + flight number.
// Verified 2026-09-20 against the active PQC carrier set and current aviation/tracker references.
// Unknown/new carriers intentionally fall back to the published flight number.
const FR24_ICAO_BY_IATA=Object.freeze({
  '9G':'SPQ', // Sun PhuQuoc Airways
  'MU':'CES', // China Eastern
  'WE':'PTA', // Parata Air
  'DR':'RLH', // Ruili Airlines
  'VJ':'VJC', // VietJet Air
  'VN':'HVN', // Vietnam Airlines
  'AK':'AXM', // AirAsia Malaysia
  'VZ':'TVJ', // Thai VietJet
  'BL':'PIC', // Pacific Airlines
  'TR':'TGW', // Scoot
  'FD':'AIQ', // Thai AirAsia
  'K6':'KHV', // Air Cambodia
  '0V':'VFC', // VASCO
  'UO':'HKE', // HK Express
  'VU':'VAG', // Vietravel Airlines
  'TV':'TBA', // Tibet / Xizang Airlines
  '7C':'JJA', // Jeju Air
  'ZE':'ESR', // Eastar Jet
  'KE':'KAL', // Korean Air
  'LJ':'JNA', // Jin Air
  'TW':'TWB'  // T'way / Trinity Airways
});
function fr24LookupIdentifier(r){
  const flight=String(r?.operating_flight_number||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!flight)return '';
  const iata=String(r?.airline_code||flight.slice(0,2)).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const icao=FR24_ICAO_BY_IATA[iata];
  if(!icao)return flight;
  let suffix=flight.startsWith(iata)?flight.slice(iata.length):flight.slice(2);
  suffix=suffix.replace(/^0+(?=\d)/,'');
  return suffix?icao+suffix:flight;
}
function isDelayed(r){return /DELAYED|RESCHEDULED|POSTPONED/.test(r?.status_code||'')||/TRỄ|DELAYED|RESCHEDULED|HOÃN/i.test(r?.status||'')}
function isAbnormal(r){return /DELAYED|RESCHEDULED|POSTPONED|CANCELLED/.test(r?.status_code||'')||/TRỄ|DELAYED|RESCHEDULED|HOÃN|HỦY|CANCELLED/i.test(r?.status||'')}
function statusClass(s){s=(s||'').toUpperCase();if(/ĐÃ HẠ CÁNH|ĐÃ CẤT CÁNH|BÃI ĐỖ/.test(s))return'green';if(/ĐÚNG GIỜ|LÀM THỦ TỤC|CHECK-IN|BOARDING|LÊN MÁY BAY/.test(s))return'blue';if(/TRỄ|CHẬM|DELAY|HOÃN|RESCHEDULED/.test(s))return'amber';if(/HỦY|CANCEL/.test(s))return'red';return'gray'}
function scheduledTime(r){return r?.scheduled_time||r?.times?.[0]||null}
function expectedTime(r){if(r?.estimated_time)return r.estimated_time;if(!isDelayed(r))return null;const ts=r?.times||[];return ts.length>1?ts[ts.length-1]:null}
function signedTimeDiff(from,to){const a=mins(from),b=mins(to);if(a==null||b==null)return null;let d=b-a;if(d>720)d-=1440;if(d<-720)d+=1440;return d}
function positiveTimeDiff(from,to){const d=signedTimeDiff(from,to);return d==null?null:Math.max(0,d)}
function scheduleDeviation(r){const scheduled=scheduledTime(r),expected=expectedTime(r),delta=expected?signedTimeDiff(scheduled,expected):null;return{scheduled,expected,delta}}
function isEarly(r,threshold=10){const d=scheduleDeviation(r).delta;return d!=null&&d<=-threshold}
function snapshotMinutes(){const iso=state.latest?.collected_at_vn;if(!iso)return null;const p=vnNowParts(new Date(iso));return +p.hour*60 + +p.minute}
function timingInfo(r){
  const scheduled=scheduledTime(r),expected=expectedTime(r);
  const delta=expected?signedTimeDiff(scheduled,expected):null;
  let delay=Number.isFinite(Number(r?.delay_minutes))?Number(r.delay_minutes):null;
  if((delay==null||delay===0)&&delta!=null&&delta>0)delay=delta;
  if(delta!=null&&delta<0)delay=null;
  let minimum=null;
  if(isDelayed(r)&&delay==null&&scheduled){
    const snap=snapshotMinutes(),sm=mins(scheduled);
    if(snap!=null&&sm!=null){let d=snap-sm;if(d<0&&sm>1200&&snap<240)d+=1440;if(d>=0&&d<=720)minimum=d;}
  }
  return {scheduled,expected,delay,minimum,delta};
}
function delayStatusLabel(r){const t=timingInfo(r);if(t.delta!=null&&t.delta<=-10)return `DỰ KIẾN SỚM ${Math.abs(t.delta)} PHÚT`;if(!isDelayed(r))return r.status||'CHƯA RÕ';if(t.delay!=null&&t.delay>0)return `TRỄ ${t.delay} PHÚT`;if(t.minimum!=null&&t.minimum>0)return `TRỄ ≥ ${t.minimum} PHÚT`;return 'TRỄ'}
function displayStatusLabel(r){
  if(isDelayed(r))return delayStatusLabel(r);
  const code=r?.status_code||'';
  if(code==='CHECKIN_SCHEDULED')return r.checkin_time?`Check-in từ ${r.checkin_time}`:'Sắp mở check-in';
  if(code==='CHECKIN_OPEN')return 'Đang check-in';
  if(code==='CHECKIN_CLOSED')return 'Check-in đã đóng';
  if(code==='ARRIVED')return r.actual_time?`Đã hạ cánh · ${r.actual_time}`:'Đã hạ cánh';
  if(code==='DEPARTED')return r.actual_time?`Đã cất cánh · ${r.actual_time}`:'Đã cất cánh';
  if(code==='BOARDING')return 'Đang lên máy bay';
  if(code==='ON_TIME')return 'Đúng giờ';
  if(code==='CANCELLED')return 'Hủy';
  return r?.status||r?.raw_status||'CHƯA RÕ';
}
function isPastRecord(r){const t=mins(scheduledTime(r));if(t==null)return false;const now=nowMinutes();if(r.direction==='arrival'&&(/ARRIVED|ON_BLOCK/.test(r.status_code||'')||/ĐÃ HẠ CÁNH|BÃI ĐỖ/.test(r.status||'')))return true;if(r.direction==='departure'&&(/DEPARTED/.test(r.status_code||'')||/ĐÃ CẤT CÁNH/.test(r.status||'')))return true;return t<now-45}
function isNext3(r){const t=mins(scheduledTime(r));if(t==null)return false;const d=t-nowMinutes();return d>=-30&&d<=180}

const FIDS_FIELDS={
  gate:{label:'CỬA',current:'gate',history:'gate'},
  checkin_row:{label:'QUẦY',current:'checkin_row',history:'ckRow'},
  belt:{label:'BĂNG CHUYỀN',current:'belt',history:'belt'}
};
function flightKey(r){return `${r?.direction||''}|${r?.operating_flight_number||r?.flight_number||''}`}
function cleanFidsValue(v){const s=String(v??'').trim();return s&&s!=='-'&&s.toLowerCase()!=='null'?s:''}
function fidsEventId(e){return [e.flightKey,e.field,e.from,e.to].join('|')}
function upsertFidsEvent(e){
  if(!e?.flightKey||!e?.field||!cleanFidsValue(e.from)||!cleanFidsValue(e.to)||String(e.from)===String(e.to))return;
  const id=fidsEventId(e),i=state.fidsEvents.findIndex(x=>fidsEventId(x)===id);
  if(i>=0){if(new Date(e.at).getTime()>new Date(state.fidsEvents[i].at).getTime())state.fidsEvents[i]=e;}
  else state.fidsEvents.push(e);
  state.fidsEvents.sort((a,b)=>new Date(b.at)-new Date(a.at));
  state.fidsEvents=state.fidsEvents.slice(0,40);
}
function captureFidsSnapshotChanges(previous,current){
  const prev=new Map((previous||[]).map(r=>[flightKey(r),r]));
  for(const r of current||[]){
    const p=prev.get(flightKey(r));if(!p)continue;
    for(const [field,cfg] of Object.entries(FIDS_FIELDS)){
      const from=cleanFidsValue(p[cfg.current]),to=cleanFidsValue(r[cfg.current]);
      if(from&&to&&from!==to)upsertFidsEvent({at:new Date().toISOString(),flightKey:flightKey(r),flightNumber:r.operating_flight_number,direction:r.direction,field,from,to,source:'live'});
    }
  }
}
function activeFidsEvents(){
  const records=state.latest?.records||[],byKey=new Map(records.map(r=>[flightKey(r),r])),latestByField=new Map(),cutoff=Date.now()-12*60*60*1000;
  for(const e of state.fidsEvents){
    const r=byKey.get(e.flightKey);if(!r||isPastRecord(r))continue;
    const ts=new Date(e.at).getTime();if(Number.isFinite(ts)&&ts<cutoff)continue;
    const cfg=FIDS_FIELDS[e.field];if(!cfg)continue;
    const current=cleanFidsValue(r[cfg.current]);if(current!==cleanFidsValue(e.to))continue;
    const k=`${e.flightKey}|${e.field}`;if(!latestByField.has(k))latestByField.set(k,{...e,record:r});
  }
  return [...latestByField.values()].sort((a,b)=>new Date(b.at)-new Date(a.at));
}
function hasFidsAlert(r){const k=flightKey(r);return activeFidsEvents().some(e=>e.flightKey===k)}
function fidsAlertText(e){const cfg=FIDS_FIELDS[e.field];return `ĐỔI ${cfg?.label||'THÔNG TIN'} ${e.from} → ${e.to}`}
function todayVn(){const p=vnNowParts();return `${p.year}-${p.month}-${p.day}`}
async function loadFidsHistory(){
  const targetDate=window.JOTRIP_BOARD_DATE||state.latest?.source_date||todayVn();
  if(state.fidsHistoryLoading)return;
  if(state.fidsHistoryLoaded&&state.fidsHistoryDate===targetDate)return;
  state.fidsHistoryLoading=true;
  try{
    if(state.fidsHistoryDate!==targetDate){
      state.fidsEvents=[];
      state.fidsHistoryLoaded=false;
      state.fidsHistoryDate=targetDate;
    }
    const res=await fetch(`${DATA_BASE}/history/${targetDate}/events.jsonl?t=${Date.now()}`,{cache:'no-store'});
    if(res.status===404){
      state.fidsHistoryLoaded=true;
      renderAll();
      return;
    }
    if(!res.ok)throw new Error(`FIDS history HTTP ${res.status}`);
    const text=await res.text(),records=state.latest?.records||[],byFlight=new Map(records.map(r=>[flightKey(r),r]));
    for(const line of text.split('\n')){
      if(!line.trim())continue;
      let ev;try{ev=JSON.parse(line)}catch(_){continue}
      if(ev.type!=='CHANGED'||!ev.changes)continue;
      const k=`${ev.direction||''}|${ev.flight_number||''}`;if(!byFlight.has(k))continue;
      for(const [field,cfg] of Object.entries(FIDS_FIELDS)){
        const ch=ev.changes[cfg.history];if(!ch)continue;
        const from=cleanFidsValue(ch.from),to=cleanFidsValue(ch.to);
        if(from&&to&&from!==to)upsertFidsEvent({at:ev.at,flightKey:k,flightNumber:ev.flight_number,direction:ev.direction,field,from,to,source:'history'});
      }
    }
    state.fidsHistoryLoaded=true;
    renderAll();
  }catch(e){console.warn('FIDS history unavailable:',e)}
  finally{state.fidsHistoryLoading=false}
}
function changed(r){return isAbnormal(r)||isEarly(r,10)||hasFidsAlert(r)}

async function fetchJson(path){\n  const snapshotFetch=window.JOTRIP_NATIVE_FETCH||window.fetch.bind(window);\n  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),SNAPSHOT_TIMEOUT_MS);\n  try{\n    const res=await snapshotFetch(`${DATA_BASE}/${path}?t=${Date.now()}`,{cache:'no-store',signal:controller.signal});\n    if(!res.ok)throw new Error(`${path}: HTTP ${res.status}`);\n    return res.json();\n  }finally{clearTimeout(timer)}\n}
async function fetchSnapshotPayload(){const [latest,health]=await Promise.all([fetchJson('latest.json'),fetchJson('health.json')]);return{latest,health}}
async function fetchLivePayload(){
  if(!LIVE_API_URL)throw new Error('Live API chưa cấu hình');
  const res=await fetchWithTimeout(`${LIVE_API_URL}?t=${Date.now()}`,{cache:'no-store',headers:{accept:'application/json'}},LIVE_TIMEOUT_MS);
  if(!res.ok)throw new Error(`JoTrip Live API HTTP ${res.status}`);
  const payload=await res.json();
  if(!payload?.latest?.records||!payload?.health)throw new Error('JoTrip Live API trả dữ liệu không hợp lệ');
  return payload;
}
function payloadVersion(payload){return payload?.latest?.board_version||payload?.health?.board_version||null}
async function checkLiveVersion(){
  if(!LIVE_API_URL||state.versionEndpointDisabled||state.loading||state.versionChecking||document.visibilityState==='hidden')return;
  state.versionChecking=true;
  try{
    const res=await fetchWithTimeout(`${LIVE_API_URL}/version?t=${Date.now()}`,{cache:'no-store',headers:{accept:'application/json'}},3000);
    if(res.status===404){state.versionEndpointDisabled=true;return;}
    if(!res.ok)return;
    const meta=await res.json(),version=meta?.version||null;
    if(!version)return;
    if(!state.liveVersion){state.liveVersion=version;return;}
    if(version!==state.liveVersion)await load();
  }catch(e){console.warn('Live version check unavailable:',e)}
  finally{state.versionChecking=false}
}
async function load(){
  if(state.loading)return;
  state.loading=true;setLoading(true);
  try{
    let payload=null,liveError=null;
    if(LIVE_API_URL){
      try{payload=await fetchLivePayload();state.dataSource='live';}
      catch(e){liveError=e;console.warn('Live API fallback:',e);}
    }
    if(!payload){payload=await fetchSnapshotPayload();state.dataSource=LIVE_API_URL?'fallback':'snapshot';}
    const previousLatest=state.latest;
    state.latest=payload.latest;state.health=payload.health;state.liveError=liveError;state.lastFetchAt=Date.now();state.liveVersion=payloadVersion(payload)||state.liveVersion;
    const previousDate=previousLatest?.source_date||null,nextDate=payload.latest?.source_date||null;
    if(previousLatest?.records&&previousDate&&nextDate&&previousDate===nextDate){
      captureFidsSnapshotChanges(previousLatest.records,payload.latest?.records||[]);
    }
    renderAll();
    if(!state.fidsHistoryLoaded&&!state.fidsHistoryLoading)loadFidsHistory();
    if(state.dataSource==='fallback'){$('#errorBox').textContent=uiT('fallbackError','Luồng live tạm gián đoạn - đang dùng bản lưu JoTrip AutoSync gần nhất.');$('#errorBox').classList.remove('hidden');}
    else $('#errorBox').classList.add('hidden');
  }catch(e){
    console.error(e);$('#errorBox').textContent=uiT('loadError','Không đọc được dữ liệu chuyến bay lúc này. Trang sẽ không dùng dữ liệu cũ như dữ liệu live.');$('#errorBox').classList.remove('hidden');setHealth('bad',uiT('healthLostTitle','MẤT DỮ LIỆU'),uiT('healthLostDesc','Không thể tải nguồn live hoặc bản lưu dự phòng.'));
  }finally{state.loading=false;setLoading(false)}
}
function setLoading(on){\n  const refresh=$('#refreshBtn'),mobile=$('#mobileRefresh');\n  if(refresh){refresh.textContent=on?'…':'↻';refresh.disabled=!!on}\n  const icon=mobile?.querySelector('span');if(icon)icon.textContent=on?'…':'↻';\n  if(mobile)mobile.disabled=!!on;\n}
function setHealth(level,title,desc){const pill=$('#healthPill');pill.className='health-pill '+level;pill.textContent=title;const icon=$('#healthIcon');icon.className='health-icon '+level;icon.textContent=level==='good'?'✓':level==='watch'||level==='stale'?'!':'×';$('#healthTitle').textContent=title;$('#healthDescription').textContent=desc}
function renderAll(){renderSummary();renderHealth();renderFlights();renderNextWindow();renderWatch();renderAnalytics()}
function buildOperationWatchItems(){
  const tr=(key,fallback,vars)=>{try{return typeof window.JT_T==='function'?window.JT_T(key,vars):fallback}catch(_){return fallback}};
  const now=nowMinutes(),records=[...(state.latest?.records||[])],items=[];
  const completed=r=>{
    const code=String(r?.status_code||'').toUpperCase(),raw=foldText(r?.status||r?.raw_status||'');
    if(r?.direction==='arrival')return !!r?.actual_time||/ARRIVED|ON_BLOCK/.test(code)||/DA HA CANH|BAI DO/.test(raw);
    return !!r?.actual_time||code==='DEPARTED'||/DA CAT CANH/.test(raw);
  };
  const minutesAfter=(hhmm)=>{
    const t=mins(hhmm);if(t==null)return null;let d=now-t;if(d<0)d+=1440;return d;
  };
  const age=ageInfo(state.latest?.collected_at_vn);
  if(age.level==='stale'||age.level==='bad'){
    items.push({kind:'data',priority:0,title:tr('quickDataOld','Dữ liệu đang cũ'),body:tr('quickDataOldBody','Luồng live đang chậm. Hãy kiểm tra thời gian cập nhật trước khi dùng thông tin.'),icon:'!'});
  }

  // FIDS changes from today remain in Watch while the information is still operationally relevant.
  const byKey=new Map(records.map(r=>[flightKey(r),r])),latestByField=new Map();
  for(const e of state.fidsEvents||[]){
    const eventDay=(()=>{try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.at))}catch(_){return''}})();
    if(eventDay!==todayVn())continue;
    const r=byKey.get(e.flightKey);if(!r)continue;
    const cfg=FIDS_FIELDS[e.field];if(!cfg)continue;
    if(cleanFidsValue(r[cfg.current])!==cleanFidsValue(e.to))continue;
    const k=e.flightKey+'|'+e.field;if(!latestByField.has(k))latestByField.set(k,{...e,record:r});
  }
  for(const e of latestByField.values()){
    const r=e.record;
    // Operational relevance: departures care about check-in, arrivals care about baggage belt.
    if(r.direction==='departure'&&e.field==='belt')continue;
    if(r.direction==='arrival'&&(e.field==='checkin_row'||e.field==='gate'))continue;
    if(r.direction==='departure'&&completed(r))continue;
    if(r.direction==='arrival'&&completed(r)){
      if(e.field!=='belt')continue;
      const after=minutesAfter(r.actual_time);if(after==null||after>60)continue;
    }
    const label=e.field==='gate'?tr('watchChangeGate','Cửa hiện tại {to} · trước {from}',{from:e.from,to:e.to}):e.field==='checkin_row'?tr('watchChangeCounter','Quầy check-in hiện tại {to} · trước {from}',{from:e.from,to:e.to}):tr('watchChangeBelt','Băng hành lý hiện tại {to} · trước {from}',{from:e.from,to:e.to});
    items.push({kind:'fids',priority:1,title:`${r.operating_flight_number} · ${label}`,body:r.direction==='arrival'?`${stationLabel(r.station)} → PQC`:`PQC → ${stationLabel(r.station)}`,icon:'⇄',at:new Date(e.at).getTime(),sort:mins(scheduledTime(r))??9999,flight:r.operating_flight_number,direction:r.direction});
  }

  // Flight-time changes remain until the flight is completed. Cancellations remain until 60 min after schedule.
  records.forEach(r=>{
    const sched=mins(scheduledTime(r));if(sched==null)return;
    const cancelled=/CANCELLED/.test(r?.status_code||'')||/HỦY|CANCELLED/i.test(r?.status||'');
    if(completed(r)&&!cancelled)return;
    if(cancelled){const after=minutesAfter(scheduledTime(r));if(after!=null&&after>60&&after<720)return;}
    const dev=scheduleDeviation(r).delta;
    if(!cancelled&&!isDelayed(r)&&!(dev!=null&&Math.abs(dev)>=10))return;
    const rawStatus=displayStatusLabel(r),status=uiStatus(rawStatus),route=r.direction==='arrival'?stationLabel(r.station)+' → PQC':'PQC → '+stationLabel(r.station);
    items.push({kind:'flight',priority:cancelled?0:2,title:`${r.operating_flight_number} · ${status}`,body:`${route} · ${tr('scheduleWord','lịch')} ${scheduledTime(r)||'--:--'}`,icon:cancelled?'×':'!',sort:sched,flight:r.operating_flight_number,direction:r.direction});
  });

  items.sort((a,b)=>(a.priority??9)-(b.priority??9)||((b.at??0)-(a.at??0))||((a.sort??9999)-(b.sort??9999)));
  return items;
}
function renderSummary(){const l=state.latest;$('#totalFlights').textContent=l.counts?.total??'-';$('#arrivalsCount').textContent=l.counts?.arrivals??'-';$('#departuresCount').textContent=l.counts?.departures??'-';$('#internationalCount').textContent=l.summary?.arrivals_market?.international??'-';const age=ageInfo(l.collected_at_vn);const sourceText=state.dataSource==='live'?'JoTrip Live':state.dataSource==='fallback'?'AutoSync fallback':'JoTrip AutoSync';const time=new Date(l.collected_at_vn).toLocaleTimeString(typeof window.JT_LOCALE==='function'?window.JT_LOCALE():'vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});$('#updatedAt').textContent=uiT('updated','Cập nhật {time} · {age} phút trước · {source} · tự làm mới 1 phút',{time,age:age.minutes??0,source:sourceText});const sl=$('.source-label');if(sl)sl.textContent=uiT('sourceLive','JoTrip Live · Tự động làm mới');const abnormal=buildOperationWatchItems().filter(x=>x.kind!=='data').length;const ops=$('#opsState');ops.className='ops-state';if(age.level==='stale'||age.level==='bad'){ops.textContent=uiT('dataStale','DATA STALE');ops.classList.add('bad')}else if(abnormal>0||age.level==='watch'){ops.textContent=uiT('opsWatchCount','WATCH · {n} CẢNH BÁO',{n:abnormal});ops.classList.add('watch')}else ops.textContent=uiT('opsNormal','OPERATIONS NORMAL')}
function renderHealth(){const l=state.latest,h=state.health,age=ageInfo(l.collected_at_vn);const qa=!!(h?.collector_completed&&h?.parser_passed&&h?.normalization_passed&&h?.qa_passed&&l?.quality?.usable);$('#qaText').textContent=qa?'PASS':'FAIL';$('#qaBadge').textContent=qa?'QA PASS':'QA FAIL';$('#qaBadge').className='qa-badge '+(qa?'good':'bad');$('#dataAge').textContent=age.minutes==null?uiT('unknown','CHƯA RÕ'):uiT('minutesAgo','{n} phút',{n:age.minutes});let title,desc,level=age.level;if(!qa){level='bad';title=uiT('healthQaFailTitle','QA FAILED');desc=uiT('healthQaFailDesc','Luồng thu thập hoặc chuẩn hóa chưa đạt. Không nên dùng số liệu để điều hành.')}else if(age.level==='good'){title=uiT('healthGoodTitle','GOOD · dữ liệu đang mới');desc=uiT('healthGoodDesc','JoTrip Live đang cập nhật tự động, có cache ngắn để giữ ổn định.')}else if(age.level==='watch'){title=uiT('healthWatchTitle','WATCH · dữ liệu chậm cập nhật');desc=uiT('healthWatchDesc','Dữ liệu đang có độ trễ cao hơn bình thường. Trang sẽ tự kiểm tra lại mỗi phút.')}else{title=uiT('healthStaleTitle','STALE · không còn là dữ liệu live');desc=uiT('healthStaleDesc','Dữ liệu đã quá 15 phút. Không nên xem đây là trạng thái tức thời của sân bay.')}if(state.dataSource==='fallback'&&qa){level=age.level==='stale'?'stale':'watch';title=uiT('healthFallbackTitle','FALLBACK · đang dùng AutoSync');desc=uiT('healthFallbackDesc','Luồng live tạm không phản hồi. Giao diện đã chuyển sang bản lưu gần nhất.')}setHealth(level,title,desc)}
function recordsFiltered(){let a=[...(state.latest?.records||[])];if(state.direction!=='all')a=a.filter(r=>r.direction===state.direction);if(state.filter==='next3')a=a.filter(isNext3);if(state.filter==='international')a=a.filter(r=>r.market==='international');if(state.filter==='domestic')a=a.filter(r=>r.market==='domestic');if(state.filter==='changed')a=a.filter(changed);if(state.query){const q=foldText(state.query);a=a.filter(r=>foldText([r.operating_flight_number,...(r.marketing_flight_numbers||[]),r.station,stationLabel(r.station),airlineFor(r),r.status,r.raw_status,r.context].join(' ')).includes(q))}a.sort((x,y)=>(mins(scheduledTime(x))??9999)-(mins(scheduledTime(y))??9999));return a}
function rowHtml(r){const info=timingInfo(r),t=info.scheduled||'--:--',air=airlineFor(r),to=r.direction==='arrival'?'PQC':stationLabel(r.station),from=r.direction==='arrival'?stationLabel(r.station):'PQC';let timeSub=r.direction==='arrival'?uiT('toPqc','Đến PQC'):uiT('fromPqc','Rời PQC');if((isDelayed(r)||isEarly(r,10))&&info.expected)timeSub=uiT('estimatedTime','Dự kiến {time}',{time:info.expected});else if(isDelayed(r))timeSub=uiT('noEstimate','Chưa có giờ dự kiến');const rawStatus=displayStatusLabel(r),status=uiStatus(rawStatus);return `<div class="flight-row" data-flight="${escapeHtml(r.operating_flight_number)}" data-direction="${r.direction}"><div class="flight-number">${escapeHtml(r.operating_flight_number||'')}</div><div class="flight-time">${escapeHtml(t)}<small>${escapeHtml(timeSub)}</small></div><div class="route">${escapeHtml(from)} → ${escapeHtml(to)}<small>${escapeHtml(air)}</small></div><div class="market-label">${escapeHtml(r.market==='international'?uiT('international','Quốc tế'):uiT('domestic','Nội địa'))}</div><div class="status-pill ${statusClass(rawStatus)}">${escapeHtml(status)}</div><div class="chevron">›</div></div>`}
function renderFlights(){const list=recordsFiltered(),visible=list.slice(0,state.limit);$('#flightList').innerHTML=visible.length?visible.map(rowHtml).join(''):`<div class="empty-state">${escapeHtml(uiT('noFlights','Không có chuyến phù hợp bộ lọc hiện tại.'))}</div>`;$('#showMore').classList.toggle('hidden',list.length<=state.limit);$$('.flight-row').forEach(el=>el.onclick=()=>openDrawer(el.dataset.flight,el.dataset.direction))}
function renderNextWindow(){const all=state.latest?.records||[],next=all.filter(isNext3).filter(r=>!isPastRecord(r));$('#nextArrivals').textContent=next.filter(r=>r.direction==='arrival').length;$('#nextDepartures').textContent=next.filter(r=>r.direction==='departure').length;$('#nextInternational').textContent=next.filter(r=>r.direction==='arrival'&&r.market==='international').length;$('#nextWatch').textContent=next.filter(changed).length;const p=vnNowParts();$('#nextWindowText').textContent=`Từ ${p.hour}:${p.minute}`}
function renderWatch(){
  const tr=(key,fallback)=>{try{return typeof window.JT_T==='function'?window.JT_T(key):fallback}catch(_){return fallback}};
  const items=buildOperationWatchItems(),visible=items;
  $$('.operation-watch-count').forEach(count=>{count.textContent=items.length;count.classList.toggle('hidden',items.length===0);});
  const html=visible.length?visible.map(x=>{
    const actionable=!!(x.flight&&x.direction);
    return `<div class="watch-item${actionable?' watch-action':''}"${actionable?` role="button" tabindex="0" data-flight="${escapeHtml(x.flight)}" data-direction="${escapeHtml(x.direction)}"`:''}><div class="watch-icon">${escapeHtml(x.icon||'!')}</div><div class="watch-copy"><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.body||'')}</p>${actionable?`<small class="watch-detail-link">${escapeHtml(tr('viewDetail','Xem chi tiết'))} ›</small>`:''}</div></div>`;
  }).join(''):`<div class="quick-clear">${escapeHtml(tr('quickClear','Chưa có thông báo cần chú ý ngay lúc này.'))}</div>`;
  $$('.operation-watch-list').forEach(list=>{
    list.innerHTML=html;
    list.querySelectorAll('.watch-action').forEach(el=>{
      const open=()=>openDrawer(el.dataset.flight,el.dataset.direction);
      el.onclick=open;
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
    });
  });
}
function renderNextArrivals(){const a=(state.latest?.records||[]).filter(r=>r.direction==='arrival'&&!isPastRecord(r)).sort((x,y)=>(mins(scheduledTime(x))??9999)-(mins(scheduledTime(y))??9999)).slice(0,5);$('#nextArrivalsList').innerHTML=a.length?a.map(r=>{const info=timingInfo(r),status=displayStatusLabel(r);return `<div class="arrival-item"><div class="arrival-time">${escapeHtml(info.scheduled||'--:--')}</div><div class="arrival-main"><strong>${escapeHtml(r.operating_flight_number)} · ${escapeHtml(stationLabel(r.station))}</strong><span>${escapeHtml(isDelayed(r)&&info.expected?'Dự kiến '+info.expected:airlineFor(r))}</span></div><span class="status-pill ${statusClass(status)}">${escapeHtml(status)}</span></div>`}).join(''):'<div class="empty-state">Chưa có chuyến đến tiếp theo trong dữ liệu.</div>'}
function pct(v,total){return total?Math.round(v*1000/total)/10+'%':'0%'}
function renderAnalytics(){if(typeof window.JT_ANALYTICS_RENDER==='function')window.JT_ANALYTICS_RENDER();}
function openDrawer(flight,direction){
  const r=(state.latest?.records||[]).find(x=>x.operating_flight_number===flight&&x.direction===direction);if(!r)return;
  const air=airlineFor(r),info=timingInfo(r),landed=/ARRIVED|ON_BLOCK/.test(r.status_code||'')||/ĐÃ HẠ CÁNH|BÃI ĐỖ/.test(r.status||''),departed=/DEPARTED/.test(r.status_code||'')||/ĐÃ CẤT CÁNH/.test(r.status||''),a=r.direction==='arrival';
  let delayText=uiT('noDelay','Đúng giờ / chưa ghi nhận lệch lịch');
  if(info.delta!=null&&info.delta<=-10)delayText=uiT('earlyBy','Sớm {n} phút',{n:Math.abs(info.delta)});
  else if(isDelayed(r)){
    if(info.delay!=null&&info.delay>0)delayText=uiT('lateBy','Trễ {n} phút',{n:info.delay});
    else if(info.minimum!=null&&info.minimum>0)delayText=uiT('delayMinimum','Trễ ít nhất {n} phút tại thời điểm cập nhật',{n:info.minimum});
    else delayText=uiT('delayReported','Đã báo trễ, chưa xác định số phút');
  }
  const expectedText=info.expected||(isDelayed(r)?uiT('airportNotPublished','Sân bay chưa công bố'):uiT('notApplicable','Không áp dụng'));
  const finalLabel=r.actual_time?uiT('actualAt','Thực tế · {time}',{time:r.actual_time}):uiT('estimatedAt','Dự kiến · {time}',{time:expectedText});
  const finalDesc=r.actual_time?uiT('actualDesc','Giờ thực tế đã được ghi nhận trong dữ liệu chuyến bay.'):isDelayed(r)&&!info.expected?uiT('noEstimateDesc','Nguồn hiện tại chỉ báo trễ, chưa có giờ dự kiến nên JoTrip không tự đoán giờ.'):uiT('estimateDesc','Giờ cập nhật theo dữ liệu chuyến bay.');
  const fr24Lookup=fr24LookupIdentifier(r);
  const fr24Row=/^[A-Z0-9]{2,4}\d{1,4}[A-Z]?$/.test(fr24Lookup)
    ? `<div class="fr24-detail-row"><span>${escapeHtml(uiT('trackFlight','Theo dõi chuyến bay'))}</span><a href="https://www.flightradar24.com/${encodeURIComponent(fr24Lookup)}" target="_blank" rel="noopener noreferrer">${escapeHtml(uiT('openFr24','Tìm LIVE trên FR24 ↗'))}</a></div>`
    : '';
  const metaRows=[
    [uiT('scheduleCompare','So với lịch'),delayText],
    [uiT('market','Thị trường'),r.market==='international'?uiT('international','Quốc tế'):uiT('domestic','Nội địa')],
    r.checkin_row?[uiT('checkinCounter','Quầy làm thủ tục'),r.checkin_row]:null,
    r.checkin_time?[uiT('checkinTime','Giờ mở check-in'),r.checkin_time]:null,
    r.gate?[uiT('boardingGate','Cửa ra máy bay'),r.gate]:null,
    r.belt?[uiT('baggageBelt','Băng chuyền hành lý'),r.belt]:null,
    r.parking_bay?[uiT('parking','Vị trí đỗ'),r.parking_bay]:null,
    [uiT('source','Nguồn'),state.dataSource==='live'?'JoTrip Live / Sun Airport':'JoTrip AutoSync / Sun Airport']
  ].filter(Boolean);
  const meta=metaRows.map(([k,v],i)=>`<div><span>${escapeHtml(k)}</span><b>${escapeHtml(v)}</b></div>${i===0?fr24Row:''}`).join('');
  const rawStatus=displayStatusLabel(r),shownStatus=uiStatus(rawStatus);
  const statusDesc=r.raw_status?uiT('rawStatus','Trạng thái gốc:')+' '+r.raw_status:uiT('statusSource','Trạng thái theo dữ liệu sân bay.');
  $('#drawerContent').innerHTML=`<div class="drawer-title">${escapeHtml(a?uiT('arrival','Chuyến đến'):uiT('departure','Chuyến đi'))}</div><h2 class="drawer-flight">${escapeHtml(r.operating_flight_number)}</h2><div class="drawer-route">${a?escapeHtml(stationLabel(r.station))+' → PQC':'PQC → '+escapeHtml(stationLabel(r.station))}</div><div class="journey"><div class="journey-dot done"></div><div class="journey-copy"><strong>${escapeHtml(uiT('scheduledAt','Theo lịch · {time}',{time:info.scheduled||'--:--'}))}</strong><p>${escapeHtml(air)}</p></div><div class="journey-dot ${landed||departed?'done':''}"></div><div class="journey-copy"><strong>${escapeHtml(shownStatus)}</strong><p>${escapeHtml(statusDesc)}</p></div><div class="journey-dot last"></div><div class="journey-copy"><strong>${escapeHtml(finalLabel)}</strong><p>${escapeHtml(finalDesc)}</p></div></div><div class="drawer-meta">${meta}</div>`;
  $('#drawerBackdrop').classList.remove('hidden');$('#flightDrawer').classList.remove('hidden');$('#flightDrawer').setAttribute('aria-hidden','false');
}
function closeDrawer(){$('#drawerBackdrop').classList.add('hidden');$('#flightDrawer').classList.add('hidden');$('#flightDrawer').setAttribute('aria-hidden','true')}
function escapeHtml(s){return String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))}
function setMode(mode){state.mode=mode;$('#app').classList.toggle('mode-analytics',mode==='analytics');$$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$$('[data-mobile-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mobileMode===mode));window.scrollTo({top:0,behavior:'smooth'})}

// Search is a primary operation, so keep it visible. Matching is accent-insensitive in both directions.
$('#searchWrap').classList.remove('hidden');$('#searchToggle').classList.add('hidden');$('#flightSearch').placeholder=uiT('searchPh','Tìm số chuyến, hãng hoặc nơi đi/đến: VJ339, Hà Nội, Da Nang...');
const extraStyle=document.createElement('style');extraStyle.textContent=`.search-wrap{margin:0 0 12px}.search-wrap input{height:48px;padding-left:42px;background:#f9fcfd;border-color:#d8e6ee}.search-wrap{position:relative}.search-wrap:before{content:'⌕';position:absolute;left:15px;top:9px;font-size:24px;color:#72869a;z-index:1}.status-pill.amber{font-weight:950}.watch-item.watch-action{cursor:pointer;border-radius:12px;transition:background .15s}.watch-item.watch-action:hover{background:#f7fafc}.watch-item.watch-action:focus-visible{outline:2px solid #9fcce3;outline-offset:2px}.watch-copy{min-width:0;flex:1}.watch-detail-link{display:block;margin-top:5px;color:#166f9f;font-size:10px;font-weight:900}.drawer-meta .fr24-detail-row{align-items:center}.drawer-meta .fr24-detail-row a{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 10px;border:1px solid #d6e4ec;border-radius:10px;background:#f5f9fb;color:#166f9f;text-decoration:none;font-weight:900;white-space:nowrap}.drawer-meta .fr24-detail-row a:active{opacity:.68}@media(max-width:680px){.search-wrap input{font-size:16px;height:48px}.status-pill{max-width:150px;overflow:hidden;text-overflow:ellipsis}.drawer-meta .fr24-detail-row a{min-height:36px;padding:0 11px}}`;document.head.appendChild(extraStyle);

$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$$('[data-mobile-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mobileMode));
$$('#directionTabs button').forEach(b=>b.onclick=()=>{state.direction=b.dataset.direction;state.limit=8;$$('#directionTabs button').forEach(x=>x.classList.toggle('active',x===b));renderFlights()});
$$('#filterChips button').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;state.limit=8;$$('#filterChips button').forEach(x=>x.classList.toggle('active',x===b));renderFlights()});
$('#flightSearch').oninput=e=>{state.query=e.target.value.trim();state.limit=8;renderFlights()};
$('#showMore').onclick=()=>{state.limit+=10;renderFlights()};
$('#refreshBtn').onclick=load;$('#mobileRefresh').onclick=load;
$('#mobileFlights').onclick=()=>{setMode('live');document.querySelector('.card.live-only')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('#flightSearch')?.focus(),350)};
$('#drawerBackdrop').onclick=closeDrawer;$('#drawerClose').onclick=closeDrawer;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#flightDrawer').classList.contains('hidden'))closeDrawer();else if(document.activeElement===$('#flightSearch')){$('#flightSearch').value='';state.query='';renderFlights();}}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(Date.now()-state.lastFetchAt>60*1000)load();else checkLiveVersion()}});
window.addEventListener('online',load);
load();
setInterval(()=>checkLiveVersion(),15*1000);
setInterval(()=>load(),AUTO_REFRESH_MS);
setInterval(()=>{if(state.latest){renderSummary();renderHealth();renderNextWindow();renderWatch()}},60000);
