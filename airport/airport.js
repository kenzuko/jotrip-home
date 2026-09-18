const API="https://jotrip-airport-live.kenzuko.workers.dev";
const FALL="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-sunairport/data/sunairport/latest.json";
const $=s=>document.querySelector(s);
let records=[],dir="all";
async function load(){
 let latest=null;
 try{const r=await fetch(API+"?t="+Date.now(),{cache:"no-store"}); if(r.ok){const b=await r.json(); latest=b.latest||b;}}catch(e){}
 if(!latest){const r=await fetch(FALL+"?t="+Date.now(),{cache:"no-store"}); latest=await r.json();}
 records=latest.records||[];
 $("#arrivals").textContent=(latest.counts&&latest.counts.arrivals)!=null?latest.counts.arrivals:records.filter(x=>x.direction==="arrival").length;
 $("#departures").textContent=(latest.counts&&latest.counts.departures)!=null?latest.counts.departures:records.filter(x=>x.direction==="departure").length;
 const delayed=records.filter(x=>x.status_code==="DELAYED"||x.status==="TRỄ"||(x.estimated_delay_minutes||0)>0); $("#delays").textContent=delayed.length; $("#delayNote").textContent=delayed.length?"Có chuyến cần theo dõi":"Không thấy trễ đáng kể";
 $("#intl").textContent=latest.summary&&latest.summary.arrivals_market&&latest.summary.arrivals_market.international!=null?latest.summary.arrivals_market.international:records.filter(x=>x.direction==="arrival"&&x.market==="international").length;
 const collected=latest.collected_at_vn; $("#airFresh").textContent=collected?"Cập nhật "+new Date(collected).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"}):"Dữ liệu đã tải"; $("#airFresh").classList.add("good"); render();
}
function render(){
 const q=$("#flightSearch").value.trim().toLowerCase();
 const rows=records.filter(x=>(dir==="all"||x.direction===dir)&&(!q||[x.operating_flight_number,x.station,x.airline_name,x.route,x.status].join(" ").toLowerCase().includes(q))).slice(0,30);
 const box=$("#flightList"); box.classList.remove("loading");
 box.innerHTML=rows.length?rows.map(function(x){const t=x.estimated_time||x.actual_time||x.scheduled_time||"--:--"; const route=x.direction==="arrival"?(x.station+" → PQC"):("PQC → "+x.station); const st=x.status||x.status_code||""; return '<a class="row" href="#"><div class="time">'+t+'</div><div><h3>'+(x.operating_flight_number||"")+' · '+route+'</h3><p>'+(x.airline_name||"")+' · lịch '+(x.scheduled_time||"--:--")+'</p></div><span class="status">'+st+'</span></a>';}).join(""):'<div class="source-note">Không tìm thấy chuyến phù hợp.</div>';
}
$("#flightSearch").addEventListener("input",render);
document.querySelectorAll(".tabs button").forEach(function(b){b.addEventListener("click",function(){document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));b.classList.add("active");dir=b.dataset.dir;render();});});
load().catch(function(){ $("#airFresh").textContent="Không tải được dữ liệu"; $("#airFresh").classList.add("bad"); $("#flightList").innerHTML='<div class="source-note error">Không thể tải dữ liệu sân bay lúc này.</div>'; });