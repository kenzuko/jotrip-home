const DATA="https://raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json";
const MARINE="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const dateKey=iso=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
const todayVN=dateKey(new Date());
const params=new URLSearchParams(location.search);
const initialMode=["all","ferry","fast"].includes(params.get("mode"))?params.get("mode"):"all";
const state={data:null,marine:null,route:params.get("route")||"all",operator:params.get("operator")||"all",mode:initialMode,date:params.get("date")||todayVN};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function time(iso){if(!iso)return"--:--";return new Date(iso).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"})}
function ageMinutes(iso){const t=Date.parse(iso||"");return Number.isFinite(t)?Math.max(0,(Date.now()-t)/60000):Infinity}
function typeLabel(r){return r.mode==="FERRY"?"Phà":"Tàu cao tốc"}
function availability(r){
  const s=String(r.status||"");
  if(/HẾT|SOLD OUT/i.test(s))return["Hết chỗ","bad"];
  if(/GẦN HẾT|CÒN ÍT/i.test(s))return[s,"watch"];
  if(/MỞ BÁN/i.test(s))return["Đang mở bán","good"];
  return["Chưa có thông tin chỗ","info"];
}
function operationLabel(value){return({RUNNING:"Đang chạy",DIRECT_CONFIRMED:"Đang chạy",SUSPENDED:"Tạm dừng",FIELD_REQUIRED:"Chưa biết chắc",UNKNOWN:"Chưa biết chắc"})[value]||"Chưa biết chắc"}
function operationClass(value){return["RUNNING","DIRECT_CONFIRMED"].includes(value)?"good":value==="SUSPENDED"?"bad":value==="FIELD_REQUIRED"?"watch":"info"}
function marineDay(value){if(!value)return"";const m=String(value).match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):String(value).slice(0,10)}
function syncUrl(){const q=new URLSearchParams();if(state.date!==todayVN)q.set("date",state.date);if(state.route!=="all")q.set("route",state.route);if(state.operator!=="all")q.set("operator",state.operator);if(state.mode!=="all")q.set("mode",state.mode);history.replaceState(null,"",location.pathname+(q.toString()?"?"+q:""))}
function renderOperations(){
  const d=state.marine;const sourceDay=marineDay(d?.source_date||d?.collected_at_vn);const current=sourceDay===todayVN;
  const entries=[["cano","opCano","opCanoNote"],["fast_boat","opFastBoat","opFastBoatNote"],["ferry","opFerry","opFerryNote"]];
  for(const [key,valueId,noteId] of entries){
    const category=d?.categories?.[key]||{};const value=current?category.state:"FIELD_REQUIRED";
    const strong=$("#"+valueId);const note=$("#"+noteId);const card=strong?.closest(".operation-card");
    if(strong)strong.textContent=operationLabel(value);
    if(note)note.textContent=current?"Có cập nhật riêng cho hôm nay":"Hôm nay chưa có tin riêng";
    if(card)card.dataset.state=operationClass(value);
  }
  $("#operationMeta").textContent=current?"Cập nhật ngày "+(d.source_date||todayVN)+" · mỗi nhóm xem riêng":"Thông tin gần nhất là của ngày trước, hôm nay chưa biết chắc";
}
function fillFilters(rows){
  const routes=[...new Set(rows.map(r=>r.origin+" → "+r.destination))].sort();
  const ops=[...new Set(rows.map(r=>r.operator).filter(Boolean))].sort();
  $("#routeFilter").innerHTML='<option value="all">Tất cả tuyến</option>'+routes.map(x=>'<option>'+esc(x)+'</option>').join("");
  $("#operatorFilter").innerHTML='<option value="all">Tất cả hãng</option>'+ops.map(x=>'<option>'+esc(x)+'</option>').join("");
  if(routes.includes(state.route))$("#routeFilter").value=state.route;else state.route="all";
  if(ops.includes(state.operator))$("#operatorFilter").value=state.operator;else state.operator="all";
}
function filtered(){
  let rows=(state.data?.departures||[]).filter(r=>r.type==="sea");
  if(state.date)rows=rows.filter(r=>dateKey(r.departure_time)===state.date);
  if(state.route!=="all")rows=rows.filter(r=>r.origin+" → "+r.destination===state.route);
  if(state.operator!=="all")rows=rows.filter(r=>r.operator===state.operator);
  if(state.mode==="ferry")rows=rows.filter(r=>r.mode==="FERRY");
  if(state.mode==="fast")rows=rows.filter(r=>r.mode!=="FERRY");
  return rows.sort((a,b)=>new Date(a.departure_time)-new Date(b.departure_time));
}
function render(){
  const all=(state.data?.departures||[]).filter(r=>r.type==="sea");
  $("#totalTrips").textContent=all.length;
  $("#sellingTrips").textContent=all.filter(r=>/MỞ BÁN/i.test(r.status||"")).length;
  $("#departedTrips").textContent=all.filter(r=>/ĐÃ XUẤT BẾN/i.test(r.status||"")).length;
  const age=ageMinutes(state.data?.generated_at);const sourceGood=state.data?.health?.status==="good";const fresh=sourceGood&&age<=30;
  $("#health").textContent=!sourceGood?"Chưa lấy đủ lịch":fresh?"Đang cập nhật":"Nên xem lại";
  $("#updatedAt").textContent=Number.isFinite(age)?"Cập nhật "+new Date(state.data.generated_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"})+" · "+Math.round(age)+" phút trước · từ các hãng":"Chưa biết lần cập nhật gần nhất · nên mở lại trang hãng";
  const rows=filtered();$("#boardMeta").textContent=rows.length+" chuyến · "+new Date(state.date+"T12:00:00+07:00").toLocaleDateString("vi-VN");
  $("#rows").innerHTML=rows.length?rows.map(r=>{const [av,cls]=availability(r);return'<tr><td><strong>'+time(r.departure_time)+'</strong>'+(r.arrival_time?'<small>Đến '+time(r.arrival_time)+'</small>':'')+'</td><td>'+typeLabel(r)+'</td><td><strong>'+esc(r.operator)+'</strong></td><td>'+esc(r.origin)+' → '+esc(r.destination)+'</td><td>'+esc(r.vessel_or_service||"-")+'</td><td><span class="pill '+(/ĐÃ XUẤT BẾN/i.test(r.status||"")?"info":/MỞ BÁN/i.test(r.status||"")?"good":"watch")+'">'+esc(r.status||"-")+'</span></td><td><span class="pill '+cls+'">'+esc(av)+'</span></td><td><a href="'+esc(r.source_url||"#")+'" target="_blank" rel="noopener">'+esc(r.data_kind==="operational_public"?"Tình hình hôm nay":"Lịch hãng")+' ↗</a><small>'+esc(r.confidence||"")+'</small></td></tr>'}).join(""):'<tr><td colspan="8" class="empty">Ngày này chưa có lịch để hiện ở đây. Bạn có thể mở thẳng trang hãng bên dưới để xem.</td></tr>';
}
async function load(){try{$("#refreshBtn").textContent="…";const [transitResult,marineResult]=await Promise.allSettled([fetch(DATA+"?t="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}),fetch(MARINE+"?t="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})]);state.data=transitResult.status==="fulfilled"?transitResult.value:null;state.marine=marineResult.status==="fulfilled"?marineResult.value:null;renderOperations();if(state.data){fillFilters(state.data.departures.filter(x=>x.type==="sea"));render()}else{$("#rows").innerHTML='<tr><td colspan="8" class="empty">Chưa mở được lịch tàu và phà lúc này. Trước khi ra bến, bạn nên mở lại trang hãng.</td></tr>';$("#health").textContent="Chưa có lịch";$("#updatedAt").textContent="Chưa lấy được lịch mới từ các hãng"}}catch(e){$("#rows").innerHTML='<tr><td colspan="8" class="empty">Chưa mở được lịch tàu và phà lúc này. Trước khi ra bến, bạn nên mở lại trang hãng.</td></tr>';$("#health").textContent="Chưa có lịch";$("#updatedAt").textContent="Chưa lấy được lịch mới từ các hãng"}finally{$("#refreshBtn").textContent="↻"}}
$("#travelDate").value=state.date;$$("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===state.mode));$("#travelDate").onchange=e=>{state.date=e.target.value||todayVN;syncUrl();render()};$("#routeFilter").onchange=e=>{state.route=e.target.value;syncUrl();render()};$("#operatorFilter").onchange=e=>{state.operator=e.target.value;syncUrl();render()};$$("[data-mode]").forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;$$("[data-mode]").forEach(x=>x.classList.toggle("active",x===b));syncUrl();render()});$("#refreshBtn").onclick=load;load();
