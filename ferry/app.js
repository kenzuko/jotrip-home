const DATA="https://raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const dateKey=iso=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
const todayVN=dateKey(new Date());
const state={data:null,route:"all",operator:"all",mode:"all",date:todayVN};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function time(iso){if(!iso)return"--:--";return new Date(iso).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"})}
function typeLabel(r){return r.mode==="FERRY"?"Phà":"Tàu cao tốc"}
function availability(r){
  const s=String(r.status||"");
  if(/HẾT|SOLD OUT/i.test(s))return["Hết chỗ","bad"];
  if(/GẦN HẾT|CÒN ÍT/i.test(s))return[s,"watch"];
  if(/MỞ BÁN/i.test(s))return["Đang mở bán","good"];
  return["Chưa có thông tin chỗ","info"];
}
function fillFilters(rows){
  const routes=[...new Set(rows.map(r=>r.origin+" → "+r.destination))].sort();
  const ops=[...new Set(rows.map(r=>r.operator).filter(Boolean))].sort();
  $("#routeFilter").innerHTML='<option value="all">Tất cả tuyến</option>'+routes.map(x=>'<option>'+esc(x)+'</option>').join("");
  $("#operatorFilter").innerHTML='<option value="all">Tất cả hãng</option>'+ops.map(x=>'<option>'+esc(x)+'</option>').join("");
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
  $("#health").textContent=state.data?.health?.status==="good"?"Dữ liệu đang đọc được":"Cần kiểm tra nguồn";
  $("#updatedAt").textContent="Cập nhật "+new Date(state.data.generated_at).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"})+" · dữ liệu công khai từ các hãng";
  const rows=filtered();$("#boardMeta").textContent=rows.length+" chuyến · "+new Date(state.date+"T12:00:00+07:00").toLocaleDateString("vi-VN");
  $("#rows").innerHTML=rows.length?rows.map(r=>{const [av,cls]=availability(r);return'<tr><td><strong>'+time(r.departure_time)+'</strong>'+(r.arrival_time?'<small>Đến '+time(r.arrival_time)+'</small>':'')+'</td><td>'+typeLabel(r)+'</td><td><strong>'+esc(r.operator)+'</strong></td><td>'+esc(r.origin)+' → '+esc(r.destination)+'</td><td>'+esc(r.vessel_or_service||"-")+'</td><td><span class="pill '+(/ĐÃ XUẤT BẾN/i.test(r.status||"")?"info":/MỞ BÁN/i.test(r.status||"")?"good":"watch")+'">'+esc(r.status||"-")+'</span></td><td><span class="pill '+cls+'">'+esc(av)+'</span></td><td><a href="'+esc(r.source_url||"#")+'" target="_blank" rel="noopener">'+esc(r.data_kind==="operational_public"?"Vận hành công khai":"Lịch công bố")+' ↗</a><small>'+esc(r.confidence||"")+'</small></td></tr>'}).join(""):'<tr><td colspan="8" class="empty">Chưa có lịch trong dữ liệu công khai cho ngày này. Bạn có thể kiểm tra trực tiếp tại các hãng bên dưới.</td></tr>';
}
async function load(){try{$("#refreshBtn").textContent="…";const r=await fetch(DATA+"?t="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error(r.status);state.data=await r.json();fillFilters(state.data.departures.filter(x=>x.type==="sea"));render()}catch(e){$("#rows").innerHTML='<tr><td colspan="8" class="empty">Không tải được dữ liệu transit lúc này.</td></tr>';$("#health").textContent="Mất dữ liệu"}finally{$("#refreshBtn").textContent="↻"}}
$("#travelDate").value=state.date;$("#travelDate").onchange=e=>{state.date=e.target.value||todayVN;render()};$("#routeFilter").onchange=e=>{state.route=e.target.value;render()};$("#operatorFilter").onchange=e=>{state.operator=e.target.value;render()};$$("[data-mode]").forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;$$("[data-mode]").forEach(x=>x.classList.toggle("active",x===b));render()});$("#refreshBtn").onclick=load;load();
