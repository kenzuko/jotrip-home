const DATA_URL="https://raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const TZ="Asia/Ho_Chi_Minh";
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const fold=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();
const dayOf=v=>new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(v));
const today=()=>dayOf(new Date());
const hhmm=v=>v?new Date(v).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:TZ}):"--:--";
const dayLabel=d=>new Date(d+"T12:00:00+07:00").toLocaleDateString("vi-VN",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric",timeZone:TZ});
const ageMin=v=>{const t=Date.parse(v||"");return Number.isFinite(t)?Math.max(0,Math.round((Date.now()-t)/60000)):Infinity};
const money=v=>Number.isFinite(Number(v))?new Intl.NumberFormat("vi-VN").format(Number(v))+"đ":"-";

const BOOKING={
  "Thạnh Thới":"https://thanhthoi.vn/?lg=vi",
  "Superdong":"https://online.superdong.com.vn/Booking",
  "Phú Quốc Express":"https://online.phuquocexpress.com/"
};

// Fare catalog is fallback display data only. Departure rows must still come from the selected day.
const FARES={
  "Thạnh Thới":{
    "Hà Tiên|Phú Quốc":{adult:205000,vehicle:"Xe máy 95.000đ · ô tô từ 1.000.000đ",checked:"21/09/2026"},
    "Phú Quốc|Hà Tiên":{adult:205000,vehicle:"Xe máy 95.000đ · ô tô từ 1.000.000đ",checked:"21/09/2026"},
    "Rạch Giá|Phú Quốc":{adult:315000,vehicle:"Xe máy 165.000đ · ô tô từ 1.500.000đ",checked:"21/09/2026"},
    "Phú Quốc|Rạch Giá":{adult:315000,vehicle:"Xe máy 165.000đ · ô tô từ 1.500.000đ",checked:"21/09/2026"}
  },
  "Phú Quốc Express":{
    "Hà Tiên|Phú Quốc":{adult:216000,checked:"21/09/2026",note:"ECO - kiểm tra lại trên hệ thống hãng"},
    "Phú Quốc|Hà Tiên":{adult:216000,checked:"21/09/2026",note:"ECO - kiểm tra lại trên hệ thống hãng"},
    "Rạch Giá|Phú Quốc":{adult:315000,checked:"21/09/2026",note:"ECO - kiểm tra lại trên hệ thống hãng"},
    "Phú Quốc|Rạch Giá":{adult:315000,checked:"21/09/2026",note:"ECO - kiểm tra lại trên hệ thống hãng"}
  }
};

const state={data:null,date:today(),mode:"sea",route:"all",operator:"all",query:""};

function routeKey(r){return `${r.origin||""}|${r.destination||""}`}
function modeName(r){return r.type==="bus"?"Bus":r.mode==="FERRY"?"Phà":"Tàu cao tốc"}
function isFast(r){return r.type==="sea"&&r.mode!=="FERRY"}
function statusTone(v=""){const s=fold(v);if(/da xuat ben|running|on time|mo ban/.test(s))return"good";if(/delay|watch|limited|con it|gan het|can xac nhan/.test(s))return"watch";if(/cancel|suspend|closed|het|ngung|huy/.test(s))return"bad";return"neutral"}
function sourceKind(r){if(r.data_kind==="operational_public")return"Vận hành";if(r.data_kind==="schedule_frequency")return"Tần suất";return"Theo lịch"}
function direction(r){const o=fold(r.origin),d=fold(r.destination);if(d.includes("phu quoc"))return"Đến đảo";if(o.includes("phu quoc"))return"Rời đảo";return"Liên tuyến"}
function fareFor(r){
  const f=r.fare||r.fares;
  if(f&&f.adult!=null)return {adult:f.adult,vehicle:f.vehicle_summary||f.vehicle||null,note:f.note||null,checked:f.checked_at||null};
  return FARES[r.operator]?.[routeKey(r)]||{adult:null,vehicle:null,note:null,checked:null};
}
function availability(r){
  const raw=r.availability_status||r.availability||r.ticket_status||"";
  const s=fold(typeof raw==="string"?raw:(raw.label||raw.status||""));
  if(!s)return null;
  if(/sold out|het ve|het cho|unavailable/.test(s))return{label:"Hết vé",tone:"bad"};
  if(/limited|con it|gan het|low/.test(s))return{label:"Còn hạn chế",tone:"watch"};
  if(/available|open|con ve|co the dat/.test(s))return{label:"Có thể đặt vé",tone:"good"};
  return{label:"Chưa xác định",tone:"neutral"};
}
function seaRows(){return (state.data?.departures||[]).filter(r=>r.type==="sea")}
function busRows(){return (state.data?.services||[]).filter(r=>r.type==="bus").map(r=>({...r,mode:"BUS",vessel_or_service:r.vessel_or_service||`Bus ${r.route_id||""}`}))}
function baseRows(){
  if(state.mode==="bus")return busRows();
  let rows=seaRows().filter(r=>r.departure_time&&dayOf(r.departure_time)===state.date);
  if(state.mode==="fast")rows=rows.filter(isFast);
  if(state.mode==="ferry")rows=rows.filter(r=>r.mode==="FERRY");
  return rows;
}
function filtered(){
  let rows=baseRows();
  if(state.route!=="all")rows=rows.filter(r=>`${r.origin} → ${r.destination}`===state.route);
  if(state.operator!=="all")rows=rows.filter(r=>r.operator===state.operator);
  if(state.query){const q=fold(state.query);rows=rows.filter(r=>fold([r.origin,r.destination,r.operator,r.vessel_or_service,r.route_id].join(" ")).includes(q))}
  return state.mode==="bus"?rows:rows.sort((a,b)=>Date.parse(a.departure_time)-Date.parse(b.departure_time));
}
function option(value,label=value){return `<option value="${esc(value)}">${esc(label)}</option>`}
function fillFilters(){
  const rows=baseRows();
  const routes=[...new Set(rows.map(r=>`${r.origin} → ${r.destination}`).filter(Boolean))].sort();
  const operators=[...new Set(rows.map(r=>r.operator).filter(Boolean))].sort();
  $("#routeFilter").innerHTML=option("all","Tất cả tuyến")+routes.map(x=>option(x)).join("");
  $("#operatorFilter").innerHTML=option("all","Tất cả hãng")+operators.map(x=>option(x)).join("");
  if(!routes.includes(state.route))state.route="all";if(!operators.includes(state.operator))state.operator="all";
  $("#routeFilter").value=state.route;$("#operatorFilter").value=state.operator;
}
function setModeCopy(){
  const map={sea:["Tàu & phà","Giờ chạy, hãng, tàu/phà, giá và mức xác nhận của nguồn."],fast:["Tàu cao tốc","Chuyến tàu khách theo đúng ngày đi, không suy từ lịch tháng."],ferry:["Phà","Chuyến phà theo ngày, kèm giá người và giá xe khi nguồn có."],bus:["Bus","Tuyến và tần suất công bố. Chỉ gọi trực tiếp khi có vị trí xe thật."]};
  const [title,sub]=map[state.mode];$("#boardTitle").textContent=title;$("#boardSubtitle").textContent=sub;
}
function renderSummary(){
  const rows=baseRows(),sea=state.mode==="bus"?[]:rows;
  $("#seaCount").textContent=state.mode==="bus"?"-":sea.length;
  $("#operatorCount").textContent=new Set(rows.map(r=>r.operator).filter(Boolean)).size||"-";
  const next=sea.filter(r=>Date.parse(r.departure_time)>=Date.now()).sort((a,b)=>Date.parse(a.departure_time)-Date.parse(b.departure_time))[0];
  $("#nextTime").textContent=next?hhmm(next.departure_time):"--:--";
  $("#nextRoute").textContent=next?`${next.origin} → ${next.destination}`:state.mode==="bus"?"Xem tuyến bên dưới":"Chưa có chuyến sắp tới";
  $("#selectedDateLabel").textContent=dayLabel(state.date);
  $("#boardMeta").textContent=`${filtered().length} mục theo bộ lọc`;
  setModeCopy();
}
function renderHealth(){
  const age=ageMin(state.data?.generated_at),h=state.data?.health?.status||"bad";
  $("#healthState").textContent=!state.data?"Chưa có dữ liệu":h==="good"?(age<=30?"Dữ liệu đang cập nhật":"Dữ liệu đã cũ"):h==="watch"?"Một phần nguồn cần kiểm tra":"Nguồn chưa sẵn sàng";
  $("#updatedAt").textContent=Number.isFinite(age)&&state.data?.generated_at?`Snapshot ${new Date(state.data.generated_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:TZ})} · ${age} phút trước`:"Chưa rõ thời điểm cập nhật";
  const el=$("#sourceHealth");el.className=`status-chip ${h==="good"?"good":h==="watch"?"watch":"bad"}`;el.textContent=h==="good"?"Nguồn online":h==="watch"?"Cần kiểm tra":"Thiếu nguồn";
}
function renderSources(){
  const reg=state.data?.sources?.registry||{},items=[];
  for(const [id,s] of Object.entries(reg)){if(state.mode==="bus"&&id!=="bus")continue;if(state.mode!=="bus"&&id==="bus")continue;items.push({id,...s})}
  const pqe=state.data?.sources?.phu_quoc_express;if(state.mode!=="bus"&&pqe)items.push({id:"phu_quoc_express",...pqe});
  $("#sourceList").innerHTML=items.length?items.map(s=>{
    const st=s.status==="ok"?"Đang đọc được":s.status==="reference_only"?"Chưa đồng bộ theo ngày":s.status==="empty"?"Không có bản ghi":"Cần kiểm tra";
    return `<div class="source-item"><div><strong>${esc(s.label||s.id)}</strong><small>${esc(st)}${s.records!==undefined?` · ${s.records} bản ghi`:""}</small></div>${s.url?`<a href="${esc(s.url)}" target="_blank" rel="noopener">Nguồn ↗</a>`:""}</div>`
  }).join(""):'<div class="empty-state">Chưa có metadata nguồn.</div>';
}
function renderNotice(){
  const box=$("#boardNotice");let msg="";
  if(state.mode!=="bus"&&!baseRows().length&&state.date!==today())msg="Collector chưa có snapshot cho ngày đã chọn. Trang giữ trống thay vì lấy lịch tháng để điền vào.";
  const pqe=state.data?.sources?.phu_quoc_express;
  if(state.mode!=="bus"&&pqe?.status==="reference_only")msg=(msg?msg+" ":"")+"Phú Quốc Express chưa được đồng bộ theo ngày trong snapshot hiện tại, nên chưa đưa lịch tháng vào bảng chuyến.";
  box.textContent=msg;box.classList.toggle("hidden",!msg);
}
function fareCell(r,compact=false){
  if(r.type==="bus")return compact?"Theo tuyến":'<span class="fare-main">Theo tuyến</span>';
  const f=fareFor(r);if(!f.adult)return compact?"Kiểm tra hãng":'<span class="fare-main">Kiểm tra hãng</span><small class="fare-note">Chưa có giá chuẩn hóa</small>';
  const note=f.note||`Người lớn${f.checked?` · kiểm tra ${f.checked}`:""}`;
  return compact?money(f.adult):`<span class="fare-main">${money(f.adult)}</span><small class="fare-note">${esc(note)}</small>`
}
function vehicleCell(r,compact=false){
  if(r.type==="bus")return"-";if(r.mode!=="FERRY")return"Không áp dụng";
  const f=fareFor(r);return f.vehicle?f.vehicle:"Kiểm tra hãng";
}
function statusChip(r){return `<span class="status-chip ${statusTone(r.status)}">${esc(r.status||"Theo lịch công bố")}</span>`}
function renderRows(){
  const rows=filtered();
  if(!rows.length){const empty='<div class="empty-state">Chưa có dữ liệu theo ngày hoặc bộ lọc này. Open Phu Quoc không tự suy từ lịch tháng.</div>';$("#boardRows").innerHTML=empty;$("#mobileRows").innerHTML=empty;return}
  $("#boardRows").innerHTML=rows.map((r,i)=>{
    const bus=r.type==="bus",time=bus?`Bus ${esc(r.route_id||"")}`:hhmm(r.departure_time),sub=bus?esc(r.operating_window||r.frequency||"Theo lịch"):(r.arrival_time?`Đến ${hhmm(r.arrival_time)}`:direction(r));
    return `<article class="transit-row">
      <div class="cell time-cell"><strong>${time}</strong><small>${sub}</small></div>
      <div class="cell"><strong>${esc(r.origin||"?")} → ${esc(r.destination||"?")}</strong><small><span class="mode-label">${esc(modeName(r))}</span> · ${esc(sourceKind(r))}</small></div>
      <div class="cell"><strong>${esc(r.operator||"-")}</strong><small>${esc(r.vessel_or_service||r.route_id||"-")}</small></div>
      <div class="cell">${fareCell(r)}</div>
      <div class="cell"><span class="fare-main">${esc(vehicleCell(r))}</span></div>
      <div class="cell">${statusChip(r)}</div>
      <div class="cell">${bus?'<span class="status-chip neutral">Theo lịch</span>':`<button class="ticket-btn" data-ticket="${i}">Kiểm tra vé</button>`}</div>
    </article>`
  }).join("");
  $("#mobileRows").innerHTML=rows.map((r,i)=>{
    const bus=r.type==="bus",time=bus?`Bus ${esc(r.route_id||"")}`:hhmm(r.departure_time);
    return `<article class="mobile-trip"><div class="mobile-trip-head"><div><div class="mobile-time">${time}</div><div class="mobile-route">${esc(r.origin||"?")} → ${esc(r.destination||"?")}</div><div class="mobile-service">${esc(r.operator||"-")} · ${esc(r.vessel_or_service||r.frequency||"-")}</div></div>${statusChip(r)}</div><div class="mobile-trip-grid"><div class="mobile-kv"><span>GIÁ NGƯỜI</span><strong>${esc(fareCell(r,true))}</strong></div><div class="mobile-kv"><span>${r.mode==="FERRY"?"GIÁ XE":"LOẠI"}</span><strong>${esc(r.mode==="FERRY"?vehicleCell(r,true):modeName(r))}</strong></div></div><div class="mobile-actions"><span class="mode-label">${esc(sourceKind(r))}</span>${bus?'<span class="status-chip neutral">Theo lịch</span>':`<button class="ticket-btn" data-mobile-ticket="${i}">Kiểm tra vé</button>`}</div></article>`
  }).join("");
  $$("[data-ticket]").forEach(b=>b.onclick=()=>openTicket(rows[Number(b.dataset.ticket)]));
  $$("[data-mobile-ticket]").forEach(b=>b.onclick=()=>openTicket(rows[Number(b.dataset.mobileTicket)]));
}
function render(){fillFilters();renderSummary();renderHealth();renderSources();renderNotice();renderRows()}
function openTicket(r){
  const av=availability(r),source=BOOKING[r.operator]||r.source_url||"#",checked=new Date().toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:TZ});
  const label=av?.label||"Chưa xác định",tone=av?.tone||"neutral";
  $("#ticketContent").innerHTML=`<div class="ticket-kicker">KIỂM TRA VÉ · ${esc(r.operator||"")}</div><h2>${hhmm(r.departure_time)}</h2><div class="ticket-route">${esc(r.origin||"?")} → ${esc(r.destination||"?")} · ${esc(r.vessel_or_service||"")}</div><div class="ticket-result"><span class="status-chip ${tone}">${esc(label)}</span><strong>${av?"Trạng thái từ nguồn hiện có":"Kiểm tra trực tiếp tại hãng"}</strong><p>${av?"Chỉ hiển thị trạng thái tổng hợp, không hiển thị số ghế cụ thể.":"Snapshot chưa có inventory theo chuyến. Open Phu Quoc không tự đoán còn bao nhiêu vé."}</p></div><div class="ticket-actions"><a href="${esc(source)}" target="_blank" rel="noopener">Mở hệ thống hãng ↗</a><button id="ticketDone">Đóng</button></div><div class="ticket-meta">Kiểm tra lúc ${checked} · ${dayLabel(state.date)}</div>`;
  $("#ticketDrawer").classList.remove("hidden");$("#ticketBackdrop").classList.remove("hidden");$("#ticketDrawer").setAttribute("aria-hidden","false");$("#ticketDone").onclick=closeTicket;
}
function closeTicket(){$("#ticketDrawer").classList.add("hidden");$("#ticketBackdrop").classList.add("hidden");$("#ticketDrawer").setAttribute("aria-hidden","true")}
async function load(){
  $("#refreshBtn").textContent="…";
  try{const r=await fetch(`${DATA_URL}?t=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw new Error(String(r.status));state.data=await r.json();render()}
  catch(e){state.data=null;$("#healthState").textContent="Chưa tải được";$("#updatedAt").textContent="Không kết luận lịch chạy khi nguồn chưa phản hồi";const empty='<div class="empty-state">Không tải được dữ liệu Transit. Vui lòng kiểm tra trực tiếp tại hãng.</div>';$("#boardRows").innerHTML=empty;$("#mobileRows").innerHTML=empty}
  finally{$("#refreshBtn").textContent="↻"}
}
$("#travelDate").value=state.date;
$("#travelDate").onchange=e=>{state.date=e.target.value||today();state.route="all";state.operator="all";render()};
$("#routeFilter").onchange=e=>{state.route=e.target.value;renderSummary();renderRows()};
$("#operatorFilter").onchange=e=>{state.operator=e.target.value;renderSummary();renderRows()};
$("#searchInput").oninput=e=>{state.query=e.target.value;renderSummary();renderRows()};
$$("#modeTabs [data-mode]").forEach(btn=>btn.onclick=()=>{state.mode=btn.dataset.mode;state.route="all";state.operator="all";$$("#modeTabs [data-mode]").forEach(x=>x.classList.toggle("active",x===btn));render()});
$("#refreshBtn").onclick=load;$("#ticketClose").onclick=closeTicket;$("#ticketBackdrop").onclick=closeTicket;document.addEventListener("keydown",e=>{if(e.key==="Escape")closeTicket()});
load();
