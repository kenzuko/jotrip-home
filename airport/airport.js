const API="https://jotrip-airport-live.kenzuko.workers.dev";
const FALL="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-sunairport/data/sunairport/latest.json";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state={latest:null,day:0,direction:"arrival",filter:"all",query:"",limit:10};

function vnDate(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}
function mins(t){if(!t)return null;const m=String(t).match(/(\d{1,2}):(\d{2})/);return m?+m[1]*60 + +m[2]:null}
function nowMins(){const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date()).split(":");return +p[0]*60 + +p[1]}
function ageInfo(iso){if(!iso)return{minutes:null,label:"Không rõ",level:"bad"};const m=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));return{minutes:m,label:m+" phút",level:m<=8?"good":m<=15?"watch":"bad"}}
function station(s){return String(s||"").replace("HO CHI MINH","TP.HCM").replace("HA NOI","HÀ NỘI").replace("DA NANG","ĐÀ NẴNG").replace("HAI PHONG","HẢI PHÒNG").replace("CAN THO","CẦN THƠ").replace("PUDONG- SHANGHAI","SHANGHAI").replace("XIANYANG-XI AN","XI'AN")}
function isDelayed(r){return /DELAYED|RESCHEDULED|POSTPONED/.test(r.status_code||"")||/TRỄ|DELAYED|RESCHEDULED|HOÃN/i.test(r.status||"")||Number(r.estimated_delay_minutes)>0}
function abnormal(r){return isDelayed(r)||/CANCELLED/.test(r.status_code||"")||/HỦY|CANCEL/i.test(r.status||"")}
function statusClass(r){const s=(r.status||r.status_code||"").toUpperCase();if(/HỦY|CANCEL/.test(s))return"bad";if(abnormal(r))return"watch";return""}
function scheduled(r){return r.scheduled_time||r.times?.[0]||"--:--"}
function isPast(r){const t=mins(scheduled(r));if(t==null)return false;return t<nowMins()-45&&(r.status_code==="ARRIVED"||r.status_code==="DEPARTED")}
function isNext3(r){const t=mins(scheduled(r));if(t==null)return false;const d=t-nowMins();return d>=-30&&d<=180}
function showToast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),1800)}
async function fetchJson(url){const r=await fetch(url+(url.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(r.status);return r.json()}
async function load(){
 let latest=null;
 try{
   const r=await fetch(API+"?date="+encodeURIComponent(vnDate(state.day))+"&t="+Date.now(),{cache:"no-store"});
   if(r.ok){const b=await r.json();latest=b.latest||b;}
 }catch(e){}
 if(!latest&&state.day===0)latest=await fetchJson(FALL);
 if(!latest)throw new Error("NO_DATA");
 state.latest=latest;state.limit=10;renderAll();
}
function renderAll(){renderSummary();renderBoard();renderPulse();renderWatch();renderNext();renderHealth()}
function renderSummary(){
 const l=state.latest,recs=l.records||[],watch=recs.filter(r=>!isPast(r)&&abnormal(r));
 $("#totalFlights").textContent=l.counts?.total??recs.length;
 $("#arrivalsCount").textContent=l.counts?.arrivals??recs.filter(r=>r.direction==="arrival").length;
 $("#departuresCount").textContent=l.counts?.departures??recs.filter(r=>r.direction==="departure").length;
 $("#watchCount").textContent=watch.length;
 $("#watchNote").textContent=watch.length?"Có thay đổi":"Bình thường";
 const age=ageInfo(l.collected_at_vn);
 $("#freshLabel").textContent=(state.day===0?"Cập nhật ":"Bảng ")+new Date(l.collected_at_vn).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"});
 $("#boardDate").textContent=l.source_date||vnDate(state.day);
}
function filtered(){
 let a=[...(state.latest?.records||[])];
 if(state.direction!=="all")a=a.filter(r=>r.direction===state.direction);
 if(state.filter==="next3")a=a.filter(isNext3);
 if(state.filter==="international")a=a.filter(r=>r.market==="international");
 if(state.filter==="domestic")a=a.filter(r=>r.market==="domestic");
 if(state.filter==="changed")a=a.filter(abnormal);
 if(state.query){const q=state.query.toLowerCase();a=a.filter(r=>[r.operating_flight_number,r.station,r.airline_name,r.route,r.status].join(" ").toLowerCase().includes(q))}
 return a.sort((x,y)=>(mins(scheduled(x))??9999)-(mins(scheduled(y))??9999));
}
function renderBoard(){
 const rows=filtered();const visible=rows.slice(0,state.limit);const box=$("#flightList");box.classList.remove("loading");
 box.innerHTML=visible.length?visible.map(r=>`<article class="flight-row"><div class="flight-no">${r.operating_flight_number||""}</div><div class="flight-time"><strong>${scheduled(r)}</strong><small>${r.estimated_time?"Dự kiến "+r.estimated_time:(r.actual_time?"Thực tế "+r.actual_time:"Lịch")}</small></div><div class="route"><b>${r.direction==="arrival"?station(r.station)+" → PQC":"PQC → "+station(r.station)}</b><small>${r.airline_name||""}</small></div><div class="market">${r.market==="international"?"Quốc tế":"Nội địa"}</div><div class="status ${statusClass(r)}">${r.status||r.status_code||"CHƯA RÕ"}</div></article>`).join(""):'<div class="empty">Không có chuyến phù hợp.</div>';
 $("#showMore").hidden=rows.length<=state.limit;
}
function renderPulse(){
 if(state.day!==0){["#nextArrivals","#nextDepartures","#nextInternational","#nextWatch"].forEach(x=>$(x).textContent="—");$("#nextWindow").textContent="Chỉ áp dụng hôm nay";return}
 const rows=(state.latest.records||[]).filter(r=>!isPast(r)&&isNext3(r));
 $("#nextArrivals").textContent=rows.filter(r=>r.direction==="arrival").length;
 $("#nextDepartures").textContent=rows.filter(r=>r.direction==="departure").length;
 $("#nextInternational").textContent=rows.filter(r=>r.direction==="arrival"&&r.market==="international").length;
 $("#nextWatch").textContent=rows.filter(abnormal).length;
 $("#nextWindow").textContent="Từ bây giờ";
}
function renderWatch(){
 const rows=(state.latest.records||[]).filter(r=>!isPast(r)&&abnormal(r)).slice(0,6);
 $("#opsWatch").innerHTML=rows.length?rows.map(r=>`<div class="mini-item"><strong>${r.operating_flight_number} · ${r.direction==="arrival"?station(r.station)+" → PQC":"PQC → "+station(r.station)}</strong><small>${scheduled(r)} · ${r.status||r.status_code||""}${r.estimated_time?" · dự kiến "+r.estimated_time:""}</small></div>`).join(""):'<div class="empty">Không có bất thường nổi bật trong bảng hiện tại.</div>';
}
function renderNext(){
 if(state.day!==0){$("#nextArrivalsList").innerHTML='<div class="empty">Chỉ hiển thị chuyến đến tiếp theo của hôm nay.</div>';return}
 const rows=(state.latest.records||[]).filter(r=>r.direction==="arrival"&&!isPast(r)).sort((a,b)=>(mins(scheduled(a))??9999)-(mins(scheduled(b))??9999)).slice(0,5);
 $("#nextArrivalsList").innerHTML=rows.length?rows.map(r=>`<div class="mini-item"><strong>${scheduled(r)} · ${r.operating_flight_number} · ${station(r.station)}</strong><small>${r.airline_name||""} · ${r.status||""}</small></div>`).join(""):'<div class="empty">Chưa có chuyến đến tiếp theo.</div>';
}
function renderHealth(){
 const l=state.latest,age=ageInfo(l.collected_at_vn),qa=!!l.quality?.usable;
 $("#dataAge").textContent=age.label;
 $("#qaText").textContent=qa?"PASS":"CHECK";
 $("#healthTitle").textContent=age.level==="good"?"Dữ liệu đang mới":age.level==="watch"?"Dữ liệu chậm hơn thường lệ":"Dữ liệu đã cũ";
 $("#healthDesc").textContent=qa?"Open AutoSync đã đọc và chuẩn hóa nguồn chính thức.":"Dữ liệu cần kiểm tra trước khi dùng.";
}
$$(".day-switch button").forEach(b=>b.addEventListener("click",()=>{state.day=Number(b.dataset.day);$$(".day-switch button").forEach(x=>x.classList.toggle("active",x===b));load().catch(()=>showToast("Chưa có dữ liệu cho ngày này"));}));
$$(".segmented button").forEach(b=>b.addEventListener("click",()=>{state.direction=b.dataset.direction;$$(".segmented button").forEach(x=>x.classList.toggle("active",x===b));renderBoard()}));
$$(".chips button").forEach(b=>b.addEventListener("click",()=>{state.filter=b.dataset.filter;$$(".chips button").forEach(x=>x.classList.toggle("active",x===b));renderBoard()}));
$("#flightSearch").addEventListener("input",e=>{state.query=e.target.value;renderBoard()});
$("#showMore").addEventListener("click",()=>{state.limit+=15;renderBoard()});
$("#searchFocus").addEventListener("click",()=>{$("#flightSearch").scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>$("#flightSearch").focus(),300)});
$("#tabSearch").addEventListener("click",()=>$("#searchFocus").click());
$("#tabRefresh").addEventListener("click",()=>{showToast("Đang làm mới");load()});
load().catch(()=>{$("#freshLabel").textContent="Không tải được dữ liệu";$("#flightList").innerHTML='<div class="empty">Không thể tải bảng chuyến bay lúc này.</div>'});
setInterval(()=>{if(state.day===0)load()},60000);