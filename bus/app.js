const ROUTES="../data/bus-routes.json";const NETWORK="https://raw.githubusercontent.com/kenzuko/transit-jotrip/main/data/network.json";
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const STOPS="../data/bus-stops-osm.json";const VINBUS_MAP="https://maps.vinbus.vn/pq";
const state={routes:null,network:null,stops:[],current:"17",vehicles:[]};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function route(){return state.routes?.routes?.find(r=>r.id===state.current)}
function foldStop(x){
  let s=String(x||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase()
    .replace(/\(.*?\)/g," ").replace(/[^a-z0-9]+/g," ").replace(/\bnga 3\b/g,"nga ba").replace(/\bngoai khu\b/g,"")
    .replace(/\bgan\b/g,"").replace(/\bdoi dien\b/g,"").replace(/\bkhu nghi duong\b/g,"").replace(/\bkhach san\b/g,"").trim().replace(/\s+/g," ");
  if(/klc holidays|gold beach/.test(s))return"klc holidays";
  if(/\bt2\b/.test(s))return"t2 grand world";
  if(/highlands coffee/.test(s))return"highlands coffee hung vuong";
  if(/san bay cu/.test(s))return"san bay cu";
  if(/k mark/.test(s))return"k mark";
  if(/salinda/.test(s))return"salinda";
  if(/sol beach/.test(s))return"sol beach";
  if(/viet han/.test(s))return"viet han";
  if(/vinholidays fiesta/.test(s))return"vinholidays fiesta";
  if(/wyndham garden/.test(s))return"wyndham garden";
  if(/quang truong bien/.test(s))return"quang truong bien";
  if(/fusion resort/.test(s))return"fusion resort";
  if(/dinh ba ong lang/.test(s))return"dinh ba ong lang";
  if(/bac duong dong/.test(s))return"bac duong dong";
  return s;
}
function stopCandidates(name,routeId){
  const key=foldStop(name);
  return (state.stops||[]).filter(x=>x.route_ids.includes(routeId)&&foldStop(x.name)===key);
}
function stopMapUrl(item){return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(item.lat+","+item.lon)}
function stopHtml(name,i,total){
  const found=stopCandidates(name,state.current);
  const tentative=found.some(x=>x.review!=="osm_reference");
  const maps=found.map((p,j)=>'<a class="stop-gps" target="_blank" rel="noopener" href="'+esc(stopMapUrl(p))+'" title="OSM '+esc(p.osm_id)+'">GPS'+(found.length>1?" "+(j+1):"")+' ↗</a>').join("");
  const note=found.length?(tentative?"Vị trí OSM tham khảo; cần rà chiều đón":"Pin OSM tham khảo, chưa phải pin VinBus xác nhận"):"Chưa xác định GPS trạm";
  const actions=found.length?maps:'<a class="stop-gps official" target="_blank" rel="noopener" href="'+VINBUS_MAP+'">Tra VinBus ↗</a>';
  return '<div class="stop-row"><i class="stop-dot"></i><div><strong>'+esc(name)+'</strong><small>Điểm '+(i+1)+' / '+total+' · '+esc(note)+'</small></div><div class="stop-links">'+actions+'</div></div>';
}

function renderTabs(){const host=$("#routeTabs");host.innerHTML=(state.routes.routes||[]).map(r=>'<button data-route="'+r.id+'" class="'+(r.id===state.current?"active":"")+'">🚌 Tuyến '+r.id+'</button>').join("");host.querySelectorAll("button").forEach(b=>b.onclick=()=>{state.current=b.dataset.route;renderTabs();renderRoute()})}
function renderRoute(){const r=route();if(!r)return;$("#routeTitle").textContent="🚌 Tuyến "+r.id+" · "+r.name;$("#routeMeta").textContent=r.window+" · "+r.frequency;$("#routeSource").textContent=r.source_kind==="schedule_frequency"?"Theo lịch VinBus":"Có vị trí xe";$("#stopSelect").innerHTML=r.stops.map((s,i)=>'<option value="'+i+'">'+esc(s)+'</option>').join("");$("#stopList").innerHTML=r.stops.map((s,i)=>stopHtml(s,i,r.stops.length)).join("");renderVehicles()}
function renderVehicles(){const live=state.vehicles.filter(v=>String(v.route_id)===state.current);$("#vehicleCount").textContent=state.vehicles.length;if(!live.length){$("#vehicleBoard").innerHTML='<div class="empty">Chưa thấy vị trí xe cho tuyến '+state.current+'.</div>';$("#nearStop").textContent="Hiện trang chỉ có lịch chạy. Khi VinBus gửi vị trí xe, mình sẽ hiện ngay ở đây.";return}$("#vehicleBoard").innerHTML=live.map(v=>'<div class="vehicle-card"><div class="vehicle-icon">🚌</div><div><strong>Xe '+esc(v.vehicle_id||"")+'</strong><small>'+esc(v.current_stop||v.position_label||"Đang chạy")+'</small></div><span class="pill good">TRỰC TIẾP</span></div>').join("")}
function renderShuttles(){$("#shuttleCount").textContent=state.routes.shuttles?.length||0;$("#shuttleGrid").innerHTML=(state.routes.shuttles||[]).map(x=>'<article class="mini-card"><span>🚌 '+esc(x.id)+'</span><strong>'+esc(x.name)+'</strong><p>'+esc(x.window)+' · '+esc(x.frequency)+'</p></article>').join("")}
function formatFeedTime(value){if(!value)return"";const d=new Date(value);if(Number.isNaN(d.getTime()))return"";return d.toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Ho_Chi_Minh"})}
async function load(){try{$("#refreshBtn").textContent="…";const [a,b,c]=await Promise.all([fetch(ROUTES+"?t="+Date.now(),{cache:"no-store"}),fetch(NETWORK+"?t="+Date.now(),{cache:"no-store"}),fetch(STOPS+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{stops:[]}).catch(()=>({stops:[]}))]);state.routes=await a.json();state.network=await b.json();state.stops=Array.isArray(c.stops)?c.stops:[];state.vehicles=Array.isArray(state.network.vehicles)?state.network.vehicles:[];$("#feedState").textContent=state.vehicles.length?"Vị trí trực tiếp":"Lịch công bố";$("#liveNote").textContent=state.vehicles.length?"Đang có vị trí xe trực tiếp.":"Chưa thấy vị trí xe lúc này. Lịch tuyến vẫn có, nhưng trang không tự đoán xe đang ở đâu.";const feedTime=formatFeedTime(state.network?.generated_at);$("#updatedAt").textContent="Lịch xem lại "+state.routes.verified_at+" · "+(feedTime?"vị trí xe lúc "+feedTime:"chưa có giờ vị trí xe");$("#routeCount").textContent=state.routes.routes.length;renderTabs();renderRoute();renderShuttles()}catch(e){$("#feedState").textContent="Chưa mở được";$("#liveNote").textContent="Trang xe buýt chưa mở được lúc này. Thử lại sau một chút nhé."}finally{$("#refreshBtn").textContent="↻"}}
$("#stopSelect").onchange=()=>renderVehicles();$("#refreshBtn").onclick=load;load();
