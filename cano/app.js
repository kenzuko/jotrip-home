const LIVE="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/latest.json";
const HISTORY="../data/cano-history.json";const ARCHIVE="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/cano-history.json";const STATIC="../data/cano.json";
const $=s=>document.querySelector(s);const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const dayVN=value=>{const d=value?new Date(value):new Date();return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)};
const normalizeDay=value=>{const s=String(value||"").trim();const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?m[3]+"-"+m[2]+"-"+m[1]:s};
function pill(state){if(state==="RUNNING"||state==="DIRECT_CONFIRMED")return"good";if(state==="SUSPENDED")return"bad";return"watch"}
function label(state){return({RUNNING:"Đang chạy",SUSPENDED:"Tạm dừng",DIRECT_CONFIRMED:"Đang chạy",FIELD_REQUIRED:"Chưa biết chắc",UNKNOWN:"Chưa biết chắc"})[state]||"Chưa biết chắc"}
function evidenceText(x){
  const cls=String(x?.evidence_class||"").toUpperCase();
  if(cls==="DIRECT")return"Ghi nhận trực tiếp";
  if(cls.includes("FIELD"))return"Ghi nhận tại chỗ";
  return"Có ghi nhận";
}
function sourceText(x){
  const source=String(x?.source||"").toUpperCase(),tier=String(x?.source_tier||"").toUpperCase();
  if(source==="JOTRIP_FIELD_CONFIRMATION"||tier==="FIELD")return"JoTrip tại Phú Quốc";
  if(source==="PORT_CLEARANCE_KGG"||tier==="PERMIT_PORT")return"Giấy phép rời cảng";
  if(source==="THANH_THOI_OPERATOR"||tier==="OPERATOR")return"Đơn vị vận hành";
  return"Nguồn ghi nhận hôm nay";
}
function historySourceText(x){
  const label=String(x?.source?.label||"");
  const tier=String(x?.source?.tier||"").toUpperCase();
  if(tier.includes("FIELD")||/operations archive/i.test(label))return"Ghi nhận của JoTrip";
  return label||"Ghi nhận ngày đó";
}
function fmt(iso){if(!iso)return"-";return new Date(iso).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"})}
function renderLive(d){const c=d?.categories?.cano||{};const sourceDayRaw=d?.source_date||dayVN(d?.collected_at_vn);const isToday=!!d&&normalizeDay(sourceDayRaw)===dayVN();const displayState=isToday?c.state:"FIELD_REQUIRED";$("#liveState").textContent=label(displayState);$("#liveState").className="pill "+pill(displayState);$("#updatedAt").textContent="Cập nhật "+fmt(c.confirmed_at_vn||d?.collected_at_vn)+" · cano Nam đảo";$("#todayMeta").textContent=isToday?"Cập nhật ngày "+sourceDayRaw:"Hôm nay chưa có tin mới";$("#currentLabel").textContent=label(displayState);$("#evidenceCount").textContent=isToday?((c.evidence_count??0)+" ghi nhận"):"-";$("#confidence").textContent=isToday?((c.confidence_cap??0)>=75?"Cao":(c.confidence_cap??0)>=45?"Vừa":"Thấp"):"-";if(displayState==="FIELD_REQUIRED"){$("#heroTitle").textContent="Hôm nay mình chưa biết chắc cano có chạy không.";$("#heroLead").textContent=isToday?"Mình đang chờ thêm thông tin từ thực địa hoặc đầu mối cano. Tàu cao tốc và phà có chạy cũng không dùng để đoán cano.":"Thông tin gần nhất là của ngày trước, nên hôm nay mình không dùng lại để kết luận.";}else{$("#heroTitle").textContent=label(displayState)+".";$("#heroLead").textContent="Tình hình này chỉ áp dụng cho cano tour đảo hôm nay.";}
const ev=isToday?(c.evidence||[]):[];$("#todayRows").innerHTML=ev.length?ev.map(x=>'<tr><td>'+esc(x.confirmed_at_text||x.issued_at_text||fmt(d.collected_at_vn))+'</td><td><strong>Cano</strong></td><td><span class="pill '+pill(displayState)+'">'+esc(label(displayState))+'</span></td><td>'+esc(evidenceText(x))+'</td><td>'+esc(sourceText(x))+'</td><td>'+esc(x.status||x.note||"-")+'</td></tr>').join(""):'<tr><td>'+esc(fmt(d.collected_at_vn))+'</td><td><strong>Cano</strong></td><td><span class="pill watch">Chưa biết chắc</span></td><td>Hôm nay chưa có ghi nhận đủ chắc</td><td>JoTrip</td><td>Không lấy tình trạng tàu hoặc phà để đoán cano.</td></tr>'}
function mergeHistory(base,remote){
 const dates=new Map(),today=dayVN();
 const add=item=>{if(!item||!/^\d{4}-\d{2}-\d{2}$/.test(item.date||"")||item.date>today)return;if(!["RUNNING","SUSPENDED"].includes(item.state))return;dates.set(item.date,item)};
 (base?.events||[]).forEach(add);
 if(remote?.category==="cano"&&remote?.schema_version==="1.0"&&Array.isArray(remote.events))remote.events.forEach(add);
 return {events:[...dates.values()].sort((a,b)=>a.date.localeCompare(b.date))};
}
function renderHistory(d){$("#historyRows").innerHTML=(d.events||[]).slice().reverse().map(x=>'<tr><td><strong>'+esc(x.date)+(x.time?'<small>'+esc(x.time)+'</small>':'')+'</strong></td><td><span class="pill '+pill(x.state)+'">'+esc(x.label||label(x.state))+'</span></td><td>'+esc(x.scope||"Cano")+'</td><td>'+esc(x.note||"-")+'</td><td>'+esc(historySourceText(x))+'</td></tr>').join("")}
function renderTour(d){const t=d.tour_intro||{};$("#tourTitle").textContent=t.title||"Tour 3 đảo An Thới";$("#tourSummary").textContent=t.summary||"";$("#tourChecklist").innerHTML=(t.checklist||[]).map(x=>'<li>'+esc(x)+'</li>').join("");$("#tourTags").innerHTML=(t.hashtags||[]).map(x=>'<span>'+esc(x)+'</span>').join("")}
async function fetchJson(url){
 const r=await fetch(url+(url.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});
 if(!r.ok)throw Error("HTTP "+r.status);
 return r.json();
}
async function load(){
 $("#refreshBtn").textContent="…";
 try{
  const [live,history,archive,staticData]=await Promise.allSettled([fetchJson(LIVE),fetchJson(HISTORY),fetchJson(ARCHIVE),fetchJson(STATIC)]);
  if(live.status==="fulfilled")renderLive(live.value);
  else{
   $("#liveState").textContent="Chưa tải được";
   $("#heroTitle").textContent="Chưa xem được trạng thái cano hôm nay.";
   $("#todayRows").innerHTML='<tr><td colspan="6" class="empty">Nguồn vận hành tạm thời không truy cập được.</td></tr>';
  }
  const base=history.status==="fulfilled"?history.value:{events:[]};
  const remote=archive.status==="fulfilled"?archive.value:null;
  renderHistory(mergeHistory(base,remote));
  const meta=$("#historyMeta");
  if(meta)meta.textContent=remote?.archive_through_date?"Đồng bộ đến "+remote.archive_through_date.split("-").reverse().join("/"):"Chưa tải được lịch sử mới";
  if(staticData.status==="fulfilled")renderTour(staticData.value);
 }catch(e){
  $("#liveState").textContent="Chưa mở được";
  $("#todayRows").innerHTML='<tr><td colspan="6" class="empty">Chưa xem được tình hình cano lúc này.</td></tr>';
 }finally{$("#refreshBtn").textContent="↻"}
}
$("#refreshBtn").onclick=load;load();
