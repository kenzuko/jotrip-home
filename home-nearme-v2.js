/* Homepage quick finder: lightweight consumer of the existing /nearme index.
   The full index loads only after an explicit search, filter or GPS action. */
(() => {
 "use strict";
 const $=sel=>document.querySelector(sel);
 const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const CORE=["PHARMACY","ATM","FUEL","TOILET","MINIMART","CHARGING"];
 const MORE=["PARKING","LAUNDRY"];
 const LABELS={PHARMACY:"Nhà thuốc",ATM:"ATM",TOILET:"Nhà vệ sinh",MINIMART:"Cửa hàng tiện lợi",FUEL:"Cây xăng",PARKING:"Bãi đỗ xe",LAUNDRY:"Giặt ủi",CHARGING:"Trạm sạc"};
 const DESCRIPTIONS={PHARMACY:"Thuốc và vật dụng y tế",ATM:"Rút tiền mặt",FUEL:"Đổ xăng trên đường",TOILET:"Nhà vệ sinh công cộng",MINIMART:"Mua đồ cần thiết"};
 const ICONS={PHARMACY:"✚",ATM:"ATM",TOILET:"WC",MINIMART:"▣",FUEL:"⛽",PARKING:"P",LAUNDRY:"◌",CHARGING:"⚡"};
 const AREAS=[
  {id:"all",label:"Toàn đảo"},
  {id:"zone_central_west",label:"Dương Đông"},
  {id:"zone_south",label:"An Thới"},
  {id:"place_sunset_town",label:"Sunset Town"},
  {id:"zone_north",label:"Gành Dầu"}
 ];
 const CENTERS={zone_central_west:{lat:10.2172,lon:103.9593},zone_south:{lat:10.0191,lon:104.0150},zone_north:{lat:10.3759,lon:103.90}};
 const roundKm=value=>new Intl.NumberFormat("vi-VN",{maximumFractionDigits:1,minimumFractionDigits:1}).format(value);
 const haversine=(a,b)=>{const rad=x=>x*Math.PI/180,dl=rad(b.lat-a.lat),dn=rad(b.lon-a.lon),h=Math.sin(dl/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dn/2)**2;return 12742*Math.asin(Math.sqrt(h))};
 const params=new URLSearchParams(location.search);
 let support=window.OPENPQ_HOME_SUPPORT||null,category=null,area=params.has("area")?params.get("area"):(window.OpenPQArea?.get()||"all")!=="all"?window.OpenPQArea.get():null,gps=null,query="",indexPromise=null,requestSeq=0,debounce=null;
 const categoryLabel=id=>LABELS[id]||support?.near_me?.categories?.find(x=>x.id===id)?.label||id;
 const moreUrl=()=>{const p=new URLSearchParams();if(area)p.set("area",area);else if(gps){const nearest=Object.entries(CENTERS).map(([id,c])=>({id,d:haversine(gps,c)})).sort((a,b)=>a.d-b.d)[0];if(nearest)p.set("area",nearest.id)}
  if(category)p.set("category",category);if(query.trim())p.set("q",query.trim());return "nearme/"+(p.size?"?"+p.toString():"")};
 function refreshLinks(){for(const a of document.querySelectorAll("[data-near-handoff]"))a.setAttribute("href",moreUrl())}
 function setStatus(message){const el=$("#nearQuickStatus");if(el)el.textContent=message}
 function hasSelection(){return Boolean(category||gps||query.trim())}
 function syncCompactState(){
  const section=$(".near-me-section");if(!section)return;
  section.classList.toggle("near-has-selection",hasSelection());
  const areas=section.classList.contains("near-show-areas");
  const others=section.classList.contains("near-show-other");
  const results=$(".near-quick-results");if(results)results.hidden=!hasSelection();
  const more=$("#nearQuickMore");if(more)more.hidden=!others;
  $("#nearAreaToggle")?.setAttribute("aria-expanded",String(areas));
  const toggle=$("#nearOtherToggle");if(toggle)toggle.textContent=others?"Thu gọn tiện ích ⌃":"Xem thêm tiện ích ⌄";
  $("#nearOtherToggle")?.setAttribute("aria-expanded",String(others));
 }
 function revealResultsOnMobile(){
  if(hasSelection()&&window.matchMedia("(max-width:720px)").matches)
   $(".near-quick-results")?.scrollIntoView({behavior:"smooth",block:"start"});
 }
 function syncControls(){
  const locName=area&&area!=="all"?(AREAS.find(x=>x.id===area)?.label||window.OpenPQArea?.label(area)||"Phú Quốc"):"Toàn đảo";
  const areaLabel=$("#nearAreaLabel");
  if(areaLabel)areaLabel.textContent=gps?"Đang dùng vị trí của bạn · Đổi khu vực":locName+" · Đổi khu vực";
  $("#nearAreaChange")?.setAttribute("aria-label","Khu vực: "+(gps?"vị trí của bạn":locName)+". Bấm để đổi khu vực.");
  $("#nearCategories").innerHTML=CORE.map(id=>'<button type="button" class="near-quick-category'+(category===id?" active":"")+'" data-category="'+id+'" aria-pressed="'+String(category===id)+'"><span class="near-quick-icon" aria-hidden="true">'+ICONS[id]+'</span><strong>'+LABELS[id]+'</strong><small>'+DESCRIPTIONS[id]+'</small></button>').join("");
  $("#nearQuickMore").innerHTML=MORE.map(id=>'<button type="button" class="near-quick-chip'+(category===id?" active":"")+'" data-category="'+id+'" aria-pressed="'+String(category===id)+'"><span aria-hidden="true">'+ICONS[id]+'</span>'+LABELS[id]+'</button>').join("");
  const loc=$("#nearLocationBtn");
  if(loc&&!loc.disabled)loc.textContent=gps?"✓ Đang dùng vị trí này":"⌖ Dùng vị trí của tôi";
  refreshLinks();
  syncCompactState();
 }
 function qualifiesArea(row){
  if(!area||area==="all"||gps)return true;
  if(area==="place_sunset_town"){
   const v=[row.name,row.address,...(row.related_entities||[])].join(" ").toLocaleLowerCase("vi");
   return row.place_id===area||row.id===area||v.includes("sunset town")||v.includes("thị trấn hoàng hôn");
  }
  return row.zone_id===area||row.place_id===area;
 }
 const fold=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
 function matchesText(row){if(!query.trim())return true;const text=[row.name,row.address,row.what_it_is,...(row.aliases||[])].join(" ");return fold(text).includes(fold(query.trim()))}
 function coords(row){const map=row.map||{};return row.verified!==false&&["exact_entrance","site_centroid"].includes(map.precision)&&Number.isFinite(map.lat)&&Number.isFinite(map.lon)?{lat:map.lat,lon:map.lon}:null}
 function ranked(docs){
  const meta=new Map((support?.near_me?.items||[]).map(item=>[item.utility_id,item]));
  const candidate=docs.filter(row=>row.entity_type==="utility"||(query.trim()&&!category&&["place","hotel","activity"].includes(row.entity_type)));
  const rows=candidate.filter(x=>qualifiesArea(x)&&matchesText(x)&&
   (category?(x.tags||[]).includes(category):query.trim()?true:CORE.some(key=>(x.tags||[]).includes(key))))
   .map(x=>{
    const m=meta.get(x.id)||{},coordinate=coords(x);
    const km=gps&&coordinate?haversine(gps,coordinate):null;
    return {...x,meta:m,km};
   });
  // Coordinates from broad area anchors are NOT precise enough for distance or route ETA.
  const order=new Map(CORE.map((id,i)=>[id,i]));
  return rows.sort((a,b)=>{
   const suspended=x=>["CLOSED","TEMPORARILY_CLOSED"].includes(x.meta?.current_status)?1:0;
   const priority=x=>(x.tags||[]).reduce((v,k)=>Math.min(v,order.get(k)??10),10);
   return suspended(a)-suspended(b)||
    (gps?((a.km===null?1:0)-(b.km===null?1:0)):0)||
    (gps&&a.km!==null&&b.km!==null?a.km-b.km:0)||
    (!category&&!query.trim()?priority(a)-priority(b):0)||
    Number(Boolean(b.meta?.featured))-Number(Boolean(a.meta?.featured))||
    a.name.localeCompare(b.name,"vi");
  });
 }
 async function getIndex(){
  if(!indexPromise)indexPromise=fetch("data/views/location-index.json",{cache:"force-cache"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).then(d=>{if(!Array.isArray(d.documents))throw Error("Missing index");return d.documents}).catch(error=>{indexPromise=null;throw error});
  return indexPromise;
 }
 function itemUrl(row){
  const current=moreUrl();
  const p=new URLSearchParams(current.includes("?")?current.split("?")[1]:"");
  p.set("q",row.name);
  return "nearme/?"+p.toString();
 }
 function directionsUrl(row){
  const map=row.map||{};
  if(row.verified===false||map.precision!=="exact_entrance"||
    !Number.isFinite(map.lat)||!Number.isFinite(map.lon))return null;
  return "https://www.google.com/maps/dir/?api=1&destination="+
    encodeURIComponent(map.lat+","+map.lon);
 }
 function phoneUrl(value){const digits=String(value||"").replace(/[^+\d]/g,"");return digits.length>=9&&digits.length<=15&&/^\+?\d+$/.test(digits)?"tel:"+digits:null}
 function card(row){
  const suspended=["CLOSED","TEMPORARILY_CLOSED"].includes(row.meta?.current_status);
  const note=row.meta?.opening_hours_note||"";
  const is24h=/24\s*\/?\s*24|24\s*giờ/i.test(note);
  const extra=row.verified===false?"Địa điểm tham khảo - chưa xác minh hoạt động":suspended?"Tạm ngưng theo thông tin đã cập nhật":is24h?"Có thông tin hoạt động 24/24, nên xác nhận trước khi đi":row.km!==null?"≈ "+roundKm(row.km)+" km đường chim bay":"";
  const own=itemUrl(row),direct=directionsUrl(row),phone=phoneUrl(row.phone);
  return '<article class="near-result-card near-quick-result">'+
   (extra?'<span class="near-quick-meta">'+esc(extra)+'</span>':"")+
   '<strong>'+esc(row.name)+'</strong>'+
   (row.verified===false&&row.utility_type==="PHARMACY"?'<small>Chưa đối chiếu giấy phép và tình trạng nhà thuốc.</small>':"")+
   (row.address?'<small>'+esc(row.address)+'</small>':"")+
   (note&&!is24h?'<small>Giờ tham khảo: '+esc(note)+'</small>':"")+
   '<div class="near-result-actions">'+
    '<a href="'+esc(own)+'" aria-label="Xem '+esc(row.name)+' trong Quanh đây">⌖ Xem trong Quanh đây</a>'+
    (direct?'<a href="'+esc(direct)+'" target="_blank" rel="noopener noreferrer" aria-label="Chỉ đường tới '+esc(row.name)+'">↗ Chỉ đường</a>':"")+
    (row.external_verify_url?'<a href="'+esc(row.external_verify_url)+'" target="_blank" rel="noopener noreferrer">Kiểm tra nguồn ↗</a>':"")+
    (row.source_license==="ODbL-1.0"?'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Nguồn OSM ↗</a>':"")+
    (phone?'<a href="'+esc(phone)+'" aria-label="Gọi '+esc(row.name)+'">☎ Gọi điện</a>':"")+
   '</div></article>';
 }
 function message(title,subtitle,showLink=true){
  $("#nearResults").innerHTML='<div class="near-quick-empty"><strong>'+esc(title)+'</strong><span>'+esc(subtitle)+'</span>'+(showLink?'<a data-near-handoff href="'+esc(moreUrl())+'">Mở bản đồ Quanh đây →</a>':"")+'</div>';
  refreshLinks();
 }
 async function render(){
  const run=++requestSeq;
  syncCompactState();
  refreshLinks();
  if(!hasSelection()){
   setStatus("Chọn một nhu cầu hoặc khu vực, chưa cần chia sẻ vị trí.");
   message("Bạn cần tìm gì lúc này?","Chọn một tiện ích để xem kết quả ngay tại đây.",false);return;
  }
  setStatus(gps?"Đang tìm quanh vị trí bạn vừa chia sẻ.":area&&area!=="all"?"Đã chọn "+AREAS.find(a=>a.id===area)?.label+".":"Đang xem gợi ý trên toàn đảo. Bật vị trí để tìm gần hơn.");
  message("Đang tìm địa điểm phù hợp...","Chỉ hiện dữ liệu có địa chỉ rõ ràng.",false);
  let docs;try{docs=await getIndex()}catch(error){if(run!==requestSeq)return;message("Chưa tải được danh sách quanh đây.","Bạn vẫn có thể mở trang Quanh đây với bộ lọc đã chọn.");return}
  if(run!==requestSeq)return;
  const rows=ranked(docs),first=rows.slice(0,3);
  const resultHeading=$("#nearQuickResultsTitle");
  if(resultHeading)resultHeading.textContent=category?categoryLabel(category)+(area?" quanh "+(AREAS.find(x=>x.id===area)?.label||"Phú Quốc"):" quanh đây"):query.trim()?"Địa điểm phù hợp":"Những chỗ bạn có thể ghé";
  if(!first.length){
   const directory=category&&support?.near_me?.categories?.find(x=>x.id===category)?.mode==="directory_search";
   message(directory||category==="CHARGING"?"Chưa có điểm đã xác minh trong kho.":"Chưa tìm thấy địa điểm phù hợp.",
    directory||category==="CHARGING"?"Mở Quanh đây để tìm tiếp trên bản đồ, không tự tạo địa điểm chưa kiểm chứng.":"Thử khu vực hoặc danh mục khác. Có thể mở bản đồ để tìm rộng hơn.");
   return;
  }
  $("#nearResults").innerHTML='<div class="near-quick-result-head"><strong>'+esc(category?categoryLabel(category):query.trim()?"Kết quả tìm kiếm":"Gợi ý cho khu vực này")+'</strong><span>'+Math.min(rows.length,3)+' địa điểm'+(rows.length>3?" trong "+rows.length+" kết quả":"")+'</span></div>'+
   '<div class="near-result-list">'+first.map(card).join("")+'</div>'+
   '<a class="near-quick-see-all" data-near-handoff href="'+esc(moreUrl())+'">Xem tất cả '+rows.length+' địa điểm trong Quanh đây →</a>';
  refreshLinks();
 }
 function onCategory(id){if(query.trim()){query="";$("#nearQuickSearch").value="";}category=category===id?null:id;$(".near-me-section")?.classList.remove("near-show-other");syncControls();render().then(revealResultsOnMobile)}
 function bind(){
  $("#nearAreaChange")?.addEventListener("click",()=>{const header=$("#siteAreaButton");if(!header)return;header.scrollIntoView({behavior:"auto",block:"start"});header.click();header.focus();});
  $("#nearOtherToggle")?.addEventListener("click",()=>{$(".near-me-section")?.classList.toggle("near-show-other");syncCompactState()});
  $("#nearCategories").addEventListener("click",event=>{const b=event.target.closest("[data-category]");if(b)onCategory(b.dataset.category)});
  $("#nearQuickMore").addEventListener("click",event=>{const b=event.target.closest("[data-category]");if(b)onCategory(b.dataset.category)});
  
  $("#nearQuickSearch").addEventListener("input",event=>{query=event.target.value||"";if(query.trim()&&category){category=null;syncControls();}clearTimeout(debounce);debounce=setTimeout(render,250);refreshLinks()});
  $("#nearQuickSearch").addEventListener("keydown",event=>{if(event.key==="Enter"){clearTimeout(debounce);render()}});
  $("#nearLocationBtn").addEventListener("click",()=>{
   const button=$("#nearLocationBtn");
   if(!navigator.geolocation){setStatus("Thiết bị không hỗ trợ chia sẻ vị trí. Bạn vẫn có thể chọn khu vực.");return}
   button.disabled=true;button.textContent="Đang xác định vị trí...";
   navigator.geolocation.getCurrentPosition(result=>{
    const p={lat:result.coords.latitude,lon:result.coords.longitude};
    const nearby=Math.min(...Object.values(CENTERS).map(c=>haversine(p,c)));
    button.disabled=false;
    if(nearby>50){gps=null;area=window.OpenPQArea?.get()||null;syncControls();render();setStatus("Vị trí hiện ở ngoài Phú Quốc. Bạn có thể chọn khu vực trên đảo.");return}
    const coarse=window.OpenPQArea?.nearest?.(p.lat,p.lon);
     gps=p;area=null;
     if(coarse)window.OpenPQArea.set(coarse,"near-gps-coarse");
     syncControls();render().then(revealResultsOnMobile);
   },()=>{
    button.disabled=false;button.textContent="⌖ Dùng vị trí của tôi";
    gps=null;area=window.OpenPQArea?.get()||null;syncControls();render();setStatus("Chưa lấy được vị trí. Bạn vẫn có thể chọn khu vực.");
   },{enableHighAccuracy:false,timeout:8000,maximumAge:0});
  });
 }
 function onSupport(event){support=event?.detail||window.OPENPQ_HOME_SUPPORT||support;syncControls()}
 function start(){
  if(!$("#nearCategories"))return;
  window.addEventListener("openpq:home-support-ready",onSupport);
  window.addEventListener("openpq:area-changed",event=>{
    const next=event.detail?.area;if(!window.OpenPQArea?.isValid(next))return;
    if(event.detail?.source==="near-gps-coarse"&&gps)return;
    area=next==="all"?null:next;gps=null;syncControls();
    if(category||query.trim()||indexPromise)render();
    else{setStatus("Đã chọn "+window.OpenPQArea.label(next)+". Chọn tiện ích để xem kết quả.");
      message("Bạn cần tìm gì lúc này?","Khu vực đã đồng bộ. Chọn một tiện ích để bắt đầu.",false);}
  });
  bind();syncControls();
  if(area&&!params.has("area")&&!category&&!query.trim()){
    setStatus("Đã chọn "+window.OpenPQArea.label(area)+". Chọn tiện ích để xem kết quả.");
    message("Bạn cần tìm gì lúc này?","Chọn một tiện ích để xem gợi ý quanh khu vực đã chọn.",false);
  }else render();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();