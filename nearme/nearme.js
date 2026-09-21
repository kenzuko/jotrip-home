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
  let support=null,entities=new Map(),selectedArea="all",selectedCategory=null,position=null,map=null,userMarker=null;

  function initMap(){
    const host=$("#nearMap");
    if(!host||!window.L){if(host)host.innerHTML='<div class="empty">Chưa mở được bản đồ. Danh sách bên dưới vẫn dùng được.</div>';return}
    map=L.map(host,{zoomControl:true,attributionControl:true}).setView(AREA_VIEW.all.center,AREA_VIEW.all.zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(map);
  }
  function setAreaView(id){
    if(!map||position)return;
    const view=AREA_VIEW[id]||AREA_VIEW.all;
    map.setView(view.center,view.zoom);
  }
  function haversine(a,b){const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
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
  function render(){
    if(!support)return;
    let rows=mergedItems();
    if(selectedCategory)rows=rows.filter(x=>x.utility_type===selectedCategory);
    if(position){
      rows=rows.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon)).map(x=>({...x,distance_km:haversine(position,{lat:x.lat,lon:x.lon})})).sort((a,b)=>a.distance_km-b.distance_km);
    }else if(selectedArea!=="all"){
      rows=rows.filter(x=>x.zone_id===selectedArea||x.place_id===selectedArea);
    }else{
      rows.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
    }
    $("#resultsTitle").textContent=areaLabel()+(selectedCategory?" · "+(support.near_me.categories.find(x=>x.id===selectedCategory)?.label||""):"");
    $("#resultsCount").textContent=rows.length+" điểm có dữ liệu";
    $("#nearStatus").textContent=position?"Đang xếp theo vị trí bạn vừa chia sẻ.":"Đang xem theo khu vực, không dùng GPS.";
    const host=$("#nearResults");
    if(!rows.length){host.innerHTML='<div class="empty">Chưa có điểm đủ dữ liệu cho lựa chọn này. Hãy thử khu vực hoặc loại tiện ích khác.</div>';return}
    host.innerHTML=rows.map(x=>{
      const distance=Number.isFinite(x.distance_km)?x.distance_km.toFixed(1)+" km":"";
      const type=support.near_me.categories.find(c=>c.id===x.utility_type)?.label||x.group||"Tiện ích";
      const maps=x.address?"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(x.address):"";
      return '<article class="near-card">'+
        '<span>'+esc([type,distance].filter(Boolean).join(" · "))+'</span>'+
        '<strong>'+esc(x.name)+'</strong>'+
        (x.address?'<p>'+esc(x.address)+'</p>':"")+
        (x.opening_hours_note?'<small>'+esc(x.opening_hours_note)+'</small>':"")+
        '<div>'+(x.phone?'<a href="tel:'+esc(x.phone.replace(/\s/g,""))+'">Gọi →</a>':"")+(maps?'<a href="'+esc(maps)+'" target="_blank" rel="noopener">Mở đường đi ↗</a>':"")+'</div>'+
      '</article>';
    }).join("");
  }
  function bind(){
    $("#areaRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-area]");if(!b)return;
      selectedArea=b.dataset.area;position=null;
      if(userMarker&&map){map.removeLayer(userMarker);userMarker=null}
      $("#useLocation").textContent="⌖ Dùng vị trí của tôi";
      renderControls();setAreaView(selectedArea);render();
    });
    $("#categoryRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-category]");if(!b)return;
      selectedCategory=b.dataset.category||null;renderControls();render();
    });
    $("#useLocation").addEventListener("click",()=>{
      const button=$("#useLocation");
      if(!navigator.geolocation){$("#nearStatus").textContent="Thiết bị này không chia sẻ được vị trí. Hãy chọn khu vực.";return}
      button.disabled=true;button.textContent="Đang lấy vị trí...";
      navigator.geolocation.getCurrentPosition(p=>{
        position={lat:p.coords.latitude,lon:p.coords.longitude};selectedArea="all";
        button.disabled=false;button.textContent="✓ Đang dùng vị trí này";
        if(map){
          if(userMarker)map.removeLayer(userMarker);
          userMarker=L.marker([position.lat,position.lon]).addTo(map).bindPopup("Vị trí bạn vừa chia sẻ");
          map.setView([position.lat,position.lon],14);
        }
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
      $("#nearStatus").textContent="Chưa mở được dữ liệu tiện ích.";
      $("#nearResults").innerHTML='<div class="empty">Bạn vẫn có thể mở Danh bạ từ thanh trên.</div>';
    }
  }
  load();
})();