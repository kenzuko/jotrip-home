(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const AREA_VIEW={
    all:{center:[10.20,103.97],zoom:10},
    zone_central_west:{center:[10.2172,103.9593],zoom:13},
    zone_south:{center:[10.0191,104.0150],zoom:13},
    place_sunset_town:{center:[10.0191,104.0150],zoom:14},
    zone_north:{center:[10.3759,103.90],zoom:13}
  };
  let support=null,entities=new Map(),selectedArea="all",selectedCategory=null,position=null,mapFrame=null;

  function mapUrl(query,zoom=12){
    return "https://www.google.com/maps?q="+encodeURIComponent(query)+"&z="+zoom+"&output=embed";
  }
  function areaQuery(id){
    return ({
      all:"Phú Quốc, Việt Nam",
      zone_central_west:"Dương Đông, Phú Quốc, Việt Nam",
      zone_south:"An Thới, Phú Quốc, Việt Nam",
      place_sunset_town:"Sunset Town, Phú Quốc, Việt Nam",
      zone_north:"Gành Dầu, Phú Quốc, Việt Nam"
    })[id]||"Phú Quốc, Việt Nam";
  }
  function updateMapFrame(queryOverride=null,zoomOverride=null){
    if(!mapFrame)return;
    let query="";
    let zoom=zoomOverride||12;
    if(queryOverride){
      query=queryOverride;
    }else if(position){
      query=position.lat+","+position.lon;
      zoom=15;
    }else{
      const category=support?.near_me?.categories?.find(x=>x.id===selectedCategory)?.label||"";
      const base=areaQuery(selectedArea);
      query=category?category+" "+base:base;
      zoom=selectedArea==="all"?10:13;
    }
    mapFrame.src=mapUrl(query,zoom);
    const link=$("#mapOpenLink");
    if(link)link.href="https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(query);
  }
  function initMap(){
    const host=$("#nearMap");
    if(!host)return;
    host.innerHTML='<iframe class="near-map-embed" title="Bản đồ quanh đây Phú Quốc" loading="eager" referrerpolicy="no-referrer-when-downgrade"></iframe>';
    mapFrame=host.querySelector("iframe");
    updateMapFrame();
    const note=$("#mapNote");
    if(note)note.textContent="Bản đồ hiển thị khu vực đang xem. Dùng vị trí để định tâm gần bạn; mở từng điểm bên dưới để đi tới đúng pin.";
  }

  function clearUserLocation(){
    position=null;
  }

  function setAreaView(id){
    if(position)return;
    selectedArea=id||selectedArea;
    updateMapFrame();
  }

  function showUserLocation(coords){
    if(!mapFrame)return;
    mapFrame.src=mapUrl(coords.lat+","+coords.lon,15);
    const note=$("#mapNote");
    if(note)note.textContent="Bản đồ đang định tâm theo vị trí thiết bị trong phiên này. Khoảng cách trong danh sách chỉ tính với những điểm có tọa độ đã xác minh.";
  }
  function haversine(a,b){const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
  function nearestArea(pos){
    return Object.entries(AREA_VIEW)
      .filter(([id])=>["zone_central_west","zone_south","zone_north"].includes(id))
      .map(([id,v])=>({id,d:haversine(pos,{lat:v.center[0],lon:v.center[1]})}))
      .sort((a,b)=>a.d-b.d)[0]?.id||"all";
  }
  function mergedItems(){
    return (support?.near_me?.items||[]).map(x=>{
      const e=entities.get(x.utility_id)||{};
      const mapData=e.map||{};
      return {...x,name:e.name||x.utility_id,address:e.address||"",phone:e.phone||null,zone_id:e.zone_id||null,utility_type:e.utility_type||null,what_it_is:e.what_it_is||"",lat:Number.isFinite(mapData.lat)?mapData.lat:null,lon:Number.isFinite(mapData.lon)?mapData.lon:null};
    });
  }
  function areaLabel(){
    if(position)return"Vị trí của tôi";
    return support?.near_me?.manual_areas?.find(x=>x.id===selectedArea)?.label||"Toàn đảo";
  }
  function renderControls(){
    const areas=support?.near_me?.manual_areas||[],cats=support?.near_me?.categories||[];
    $("#areaRow").innerHTML=areas.map(x=>'<button type="button" data-area="'+esc(x.id)+'" class="'+(x.id===selectedArea?"active":"")+'">'+esc(x.label)+'</button>').join("");
    $("#categoryRow").innerHTML='<button type="button" data-category="" class="'+(!selectedCategory?"active":"")+'">Tất cả</button>'+cats.map(x=>'<button type="button" data-category="'+esc(x.id)+'" class="'+(x.id===selectedCategory?"active":"")+'">'+esc(x.label)+'</button>').join("");
  }
  function renderMapPoints(){
    if(!position)updateMapFrame();
  }

  function render(){
    if(!support)return;
    let rows=mergedItems();
    if(selectedCategory)rows=rows.filter(x=>x.utility_type===selectedCategory);
    let gpsFallback=false;
    if(position){
      const withCoords=rows.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
      if(withCoords.length){
        rows=withCoords.map(x=>({...x,distance_km:haversine(position,{lat:x.lat,lon:x.lon})})).sort((a,b)=>a.distance_km-b.distance_km);
      }else{
        gpsFallback=true;
        const fallbackArea=selectedArea!=="all"?selectedArea:nearestArea(position);
        const areaRows=rows.filter(x=>x.zone_id===fallbackArea||x.place_id===fallbackArea);
        if(areaRows.length){
          selectedArea=fallbackArea;
          rows=areaRows;
        }else{
          rows.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
        }
      }
    }else if(selectedArea!=="all"){
      rows=rows.filter(x=>x.zone_id===selectedArea||x.place_id===selectedArea);
    }else{
      rows.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
    }
    $("#resultsTitle").textContent=areaLabel()+(selectedCategory?" · "+(support.near_me.categories.find(x=>x.id===selectedCategory)?.label||""):"");
    $("#resultsCount").textContent=rows.length+" điểm";
    $("#nearStatus").textContent=position?(gpsFallback?"Đã thấy vị trí của bạn trên bản đồ. Một số tiện ích chưa có tọa độ đủ chắc, nên danh sách đang ưu tiên khu vực gần nhất.":"Đã thấy vị trí của bạn trên bản đồ và đang ưu tiên những điểm gần đó."):"Bạn đang xem theo khu vực, chưa dùng GPS.";
    renderMapPoints(rows);
    const host=$("#nearResults");
    if(!rows.length){host.innerHTML='<div class="empty">Chưa có điểm phù hợp với lựa chọn này. Hãy thử khu vực hoặc loại tiện ích khác.</div>';return}
    host.innerHTML=rows.map(x=>{
      const distance=Number.isFinite(x.distance_km)?x.distance_km.toFixed(1)+" km":"";
      const type=support.near_me.categories.find(c=>c.id===x.utility_type)?.label||x.group||"Tiện ích";
      const maps=x.address?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(x.address):(Number.isFinite(x.lat)&&Number.isFinite(x.lon)?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(x.lat+","+x.lon):"");
      return '<article class="near-card">'+
        '<span>'+esc([type,distance].filter(Boolean).join(" · "))+'</span>'+
        '<strong>'+esc(x.name)+'</strong>'+
        (x.address?'<p>'+esc(x.address)+'</p>':"")+
        (x.opening_hours_note?'<small>'+esc(x.opening_hours_note)+'</small>':"")+
        '<div>'+(x.phone?'<a href="tel:'+esc(x.phone.replace(/\s/g,""))+'">Gọi →</a>':"")+(x.address?'<button type="button" data-map-query="'+esc(x.address)+'">Xem trên bản đồ</button>':"")+(maps?'<a href="'+esc(maps)+'" target="_blank" rel="noopener">Mở đường đi ↗</a>':"")+'</div>'+
      '</article>';
    }).join("");
  }
  function bind(){
    $("#areaRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-area]");if(!b)return;
      selectedArea=b.dataset.area;position=null;
      clearUserLocation();
      $("#useLocation").textContent="⌖ Dùng vị trí của tôi";
      renderControls();setAreaView(selectedArea);render();
    });
    $("#categoryRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-category]");if(!b)return;
      selectedCategory=b.dataset.category||null;renderControls();updateMapFrame();render();
    });
    $("#nearResults").addEventListener("click",e=>{
      const b=e.target.closest("[data-map-query]");if(!b)return;
      updateMapFrame(b.dataset.mapQuery||"",15);
      $("#nearMap")?.scrollIntoView({behavior:"smooth",block:"center"});
    });
    $("#useLocation").addEventListener("click",()=>{
      const button=$("#useLocation");
      if(!navigator.geolocation){$("#nearStatus").textContent="Thiết bị này không chia sẻ được vị trí. Hãy chọn khu vực.";return}
      button.disabled=true;button.textContent="Đang lấy vị trí...";
      navigator.geolocation.getCurrentPosition(p=>{
        position={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};selectedArea=nearestArea(position);
        button.disabled=false;button.textContent="✓ Đang dùng vị trí này";
        showUserLocation(position);
        renderControls();render();
      },()=>{
        button.disabled=false;button.textContent="⌖ Dùng vị trí của tôi";
        $("#nearStatus").textContent="Chưa lấy được vị trí. Bạn vẫn có thể chọn khu vực.";
      },{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
    });
  }
  async function load(){
    initMap();
    try{
      const [a,b]=await Promise.all([
        fetch("../data/home-support.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
        fetch("../data/entities/utilities.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json())
      ]);
      support=a;(b.entities||[]).forEach(x=>entities.set(x.id,x));
      renderControls();bind();render();setAreaView("all");
    }catch{
      $("#nearStatus").textContent="Danh sách tiện ích đang tạm gián đoạn.";
      $("#nearResults").innerHTML='<div class="empty">Bạn vẫn có thể mở Danh bạ từ thanh trên.</div>';
    }
  }
  load();
})();