(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

  const AREA_VIEW={
    all:{center:[10.20,103.97],zoom:10},
    zone_central_west:{center:[10.2172,103.9593],zoom:13},
    zone_south:{center:[10.0191,104.0150],zoom:13},
    place_sunset_town:{center:[10.0280,104.0052],zoom:14},
    zone_north:{center:[10.3759,103.90],zoom:13}
  };

  let support=null;
  let entities=new Map();
  let selectedArea="all";
  let selectedCategory=null;
  let position=null;
  let nearMap=null;
  let markerLayer=null;
  let userLayer=null;
  const markerById=new Map();

  const initialParams=new URLSearchParams(location.search);
  const requestedArea=initialParams.get("area");
  const requestedCategory=initialParams.get("category");

  function category(id=selectedCategory){
    return support?.near_me?.categories?.find(x=>x.id===id)||null;
  }

  function isDiscoveryCategory(id=selectedCategory){
    return category(id)?.mode==="directory_search";
  }

  function areaQuery(id=selectedArea){
    const fromData=support?.near_me?.manual_areas?.find(x=>x.id===id)?.map_query;
    if(fromData)return fromData;
    return ({
      all:"Phú Quốc, Việt Nam",
      zone_central_west:"Dương Đông, Phú Quốc, Việt Nam",
      zone_south:"An Thới, Phú Quốc, Việt Nam",
      place_sunset_town:"Sunset Town, Phú Quốc, Việt Nam",
      zone_north:"Gành Dầu, Phú Quốc, Việt Nam"
    })[id]||"Phú Quốc, Việt Nam";
  }

  function mapSearchQuery(){
    const cat=category();
    const term=cat?.search_query||cat?.label||"";
    return [term,areaQuery()].filter(Boolean).join(" ");
  }

  function googleEmbedUrl(query,zoom=13){
    return "https://www.google.com/maps?q="+encodeURIComponent(query)+"&z="+zoom+"&output=embed";
  }

  function googleSearchUrl(query){
    return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(query);
  }

  function updateExternalMapLink(query=mapSearchQuery()){
    const link=$("#mapOpenLink");
    if(link)link.href=googleSearchUrl(query);
  }

  function setMapBadge(text){
    const el=$("#mapDataBadge");
    if(el)el.textContent=text;
  }

  function showDirectoryMap(){
    const live=$("#nearLeaflet");
    const frame=$("#nearDirectoryMap");
    if(live)live.hidden=true;
    if(!frame)return;
    frame.hidden=false;
    const zoom=selectedArea==="all"?10:13;
    frame.src=googleEmbedUrl(mapSearchQuery(),zoom);
    setMapBadge("Kết quả tìm kiếm trên Google Maps");
    const note=$("#mapNote");
    if(note)note.textContent="Lớp này dùng kết quả bản đồ để khám phá nhanh. Pin Open Phu Quoc chỉ xuất hiện khi địa điểm đã được mình kiểm tra và có tọa độ đủ chắc.";
    updateExternalMapLink();
  }

  function showLiveMap(){
    const live=$("#nearLeaflet");
    const frame=$("#nearDirectoryMap");
    if(frame)frame.hidden=true;
    if(live)live.hidden=false;
    if(nearMap)setTimeout(()=>nearMap.invalidateSize(),60);
  }

  function initMap(){
    const host=$("#nearLeaflet");
    if(!host)return;
    if(!window.L){
      showDirectoryMap();
      const note=$("#mapNote");
      if(note)note.textContent="Bản đồ dữ liệu chưa mở được, đang dùng bản đồ tìm kiếm thay thế.";
      return;
    }

    nearMap=L.map(host,{
      zoomControl:true,
      attributionControl:true,
      preferCanvas:true,
      scrollWheelZoom:false,
      tap:true
    }).setView(AREA_VIEW.all.center,AREA_VIEW.all.zoom);

    if(window.OpenPQMapBase?.add){
      window.OpenPQMapBase.add(nearMap,{maxZoom:19});
    }else{
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
        maxZoom:19,
        attribution:"© OpenStreetMap contributors"
      }).addTo(nearMap);
    }

    markerLayer=L.layerGroup().addTo(nearMap);
    userLayer=L.layerGroup().addTo(nearMap);
    setTimeout(()=>nearMap.invalidateSize(),120);
  }

  function clearUserLocation(){
    position=null;
    if(userLayer)userLayer.clearLayers();
  }

  function setAreaView(id=selectedArea){
    if(!nearMap||position)return;
    const v=AREA_VIEW[id]||AREA_VIEW.all;
    nearMap.setView(v.center,v.zoom,{animate:true});
  }

  function userIcon(){
    return L.divIcon({className:"near-user-pin",html:"",iconSize:[18,18],iconAnchor:[9,9]});
  }

  function showUserLocation(coords){
    if(!nearMap||!window.L)return;
    showLiveMap();
    userLayer?.clearLayers();
    L.marker([coords.lat,coords.lon],{icon:userIcon(),zIndexOffset:1000})
      .bindPopup("<div class=\"near-popup\"><strong>Vị trí của bạn</strong><small>Chỉ dùng trong phiên này.</small></div>")
      .addTo(userLayer);
    nearMap.setView([coords.lat,coords.lon],15,{animate:true});
    const note=$("#mapNote");
    if(note)note.textContent="Đang theo vị trí của bạn. Khoảng cách chỉ tính với những điểm đã có tọa độ đủ chắc.";
  }

  function haversine(a,b){
    const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lon-a.lon);
    const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

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
      return {
        ...x,
        id:e.id||x.utility_id,
        name:e.name||x.utility_id,
        address:e.address||"",
        phone:e.phone||null,
        zone_id:e.zone_id||null,
        utility_type:e.utility_type||null,
        what_it_is:e.what_it_is||"",
        lat:Number.isFinite(mapData.lat)?mapData.lat:null,
        lon:Number.isFinite(mapData.lon)?mapData.lon:null
      };
    });
  }

  function areaLabel(){
    if(position)return "Vị trí của tôi";
    return support?.near_me?.manual_areas?.find(x=>x.id===selectedArea)?.label||"Toàn đảo";
  }

  function renderControls(){
    const areas=support?.near_me?.manual_areas||[];
    const availableTypes=new Set(mergedItems().map(x=>x.utility_type).filter(Boolean));
    const cats=(support?.near_me?.categories||[]).filter(x=>availableTypes.has(x.id)||x.mode==="directory_search");
    if(selectedCategory&&!cats.some(x=>x.id===selectedCategory))selectedCategory=null;

    $("#areaRow").innerHTML=areas.map(x=>
      '<button type="button" data-area="'+esc(x.id)+'" class="'+(x.id===selectedArea?"active":"")+'">'+esc(x.label)+'</button>'
    ).join("");

    $("#categoryRow").innerHTML=
      '<button type="button" data-category="" class="'+(!selectedCategory?"active":"")+'">Tất cả</button>'+
      cats.map(x=>
        '<button type="button" data-category="'+esc(x.id)+'" class="'+(x.id===selectedCategory?"active":"")+'">'+esc(x.label)+'</button>'
      ).join("");
  }

  function markerIcon(item){
    const cat=category(item.utility_type);
    const glyph=cat?.icon||"•";
    return L.divIcon({
      className:"",
      html:'<div class="near-pin"><span>'+esc(glyph)+'</span></div>',
      iconSize:[30,30],
      iconAnchor:[15,15],
      popupAnchor:[0,-14]
    });
  }

  function typeLabel(item){
    return category(item.utility_type)?.label||item.group||"Tiện ích";
  }

  function renderMapPoints(rows){
    updateExternalMapLink();

    if(isDiscoveryCategory()){
      showDirectoryMap();
      return;
    }

    if(!nearMap){
      showDirectoryMap();
      return;
    }

    showLiveMap();
    markerLayer?.clearLayers();
    markerById.clear();

    const mapped=rows.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
    for(const x of mapped){
      const marker=L.marker([x.lat,x.lon],{icon:markerIcon(x)});
      marker.bindPopup(
        '<div class="near-popup"><strong>'+esc(x.name)+'</strong>'+
        '<span>'+esc(typeLabel(x))+'</span>'+
        (x.address?'<small>'+esc(x.address)+'</small>':"")+
        '</div>'
      );
      marker.addTo(markerLayer);
      markerById.set(x.id,marker);
    }

    if(position){
      showUserLocation(position);
    }else{
      setAreaView(selectedArea);
    }

    const total=rows.length;
    if(mapped.length){
      setMapBadge(mapped.length+"/"+total+" điểm có pin đã kiểm tra");
      const note=$("#mapNote");
      if(note)note.textContent=total===mapped.length
        ?"Các điểm đang thấy trên bản đồ đều lấy từ dữ liệu Open Phu Quoc."
        :mapped.length+" điểm đã có tọa độ đủ chắc để đặt pin. "+(total-mapped.length)+" điểm còn lại vẫn hiện trong danh sách theo khu vực.";
    }else{
      setMapBadge("Chưa có pin đã kiểm tra ở bộ lọc này");
      const note=$("#mapNote");
      if(note)note.textContent="Danh sách vẫn dùng được, nhưng Open Phu Quoc chưa đặt pin khi tọa độ chưa đủ chắc.";
    }
  }

  function filteredRows(){
    let rows=mergedItems();
    if(selectedCategory&&!isDiscoveryCategory())rows=rows.filter(x=>x.utility_type===selectedCategory);

    let gpsFallback=false;
    if(position){
      const withCoords=rows
        .filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
        .map(x=>({...x,distance_km:haversine(position,{lat:x.lat,lon:x.lon})}))
        .sort((a,b)=>a.distance_km-b.distance_km);

      const fallbackArea=selectedArea!=="all"?selectedArea:nearestArea(position);
      const areaOnly=rows
        .filter(x=>!Number.isFinite(x.lat)||!Number.isFinite(x.lon))
        .filter(x=>x.zone_id===fallbackArea||x.place_id===fallbackArea)
        .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));

      gpsFallback=areaOnly.length>0;
      rows=[...withCoords,...areaOnly];

      if(!rows.length){
        rows=mergedItems()
          .filter(x=>!selectedCategory||x.utility_type===selectedCategory)
          .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
      }
    }else if(selectedArea!=="all"){
      rows=rows
        .filter(x=>x.zone_id===selectedArea||x.place_id===selectedArea)
        .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
    }else{
      rows.sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));
    }

    return {rows,gpsFallback};
  }

  function renderDiscovery(){
    const cat=category();
    const label=cat?.label||"Địa điểm";
    $("#resultsTitle").textContent=areaLabel()+" · "+label;
    $("#resultsCount").textContent="Tìm trên bản đồ";
    $("#nearStatus").textContent="Đang mở lớp "+label.toLowerCase()+" theo khu vực bạn chọn.";
    renderMapPoints([]);

    const query=mapSearchQuery();
    $("#nearResults").innerHTML=
      '<article class="discovery-card">'+
        '<span>KHÁM PHÁ QUANH ĐÂY</span>'+
        '<strong>'+esc(label)+' quanh '+esc(areaLabel())+'</strong>'+
        '<p>Phần bản đồ đang dùng kết quả tìm kiếm bên ngoài để bạn tìm nhanh. Open Phu Quoc chỉ đưa một địa điểm thành pin riêng sau khi đã kiểm tra tên, vị trí và thông tin cơ bản.</p>'+
        '<a href="'+esc(googleSearchUrl(query))+'" target="_blank" rel="noopener">Mở danh sách trên Google Maps ↗</a>'+
      '</article>';
  }

  function render(){
    if(!support)return;

    if(isDiscoveryCategory()){
      renderDiscovery();
      return;
    }

    const {rows,gpsFallback}=filteredRows();
    $("#resultsTitle").textContent=areaLabel()+(selectedCategory?" · "+(category()?.label||""):"");
    $("#resultsCount").textContent=rows.length+" điểm";
    $("#nearStatus").textContent=position
      ?(gpsFallback
        ?"Chỗ nào biết đúng vị trí sẽ được xếp theo khoảng cách. Các chỗ còn lại vẫn giữ theo khu vực gần bạn."
        :"Đã thấy vị trí của bạn. Mình xếp chỗ gần lên trước nhé.")
      :"Bạn đang xem theo khu vực.";

    renderMapPoints(rows);

    const host=$("#nearResults");
    if(!rows.length){
      host.innerHTML='<div class="empty">Chưa có điểm phù hợp với lựa chọn này. Hãy thử khu vực hoặc loại tiện ích khác.</div>';
      return;
    }

    host.innerHTML=rows.map(x=>{
      const distance=Number.isFinite(x.distance_km)?x.distance_km.toFixed(1)+" km":"";
      const type=typeLabel(x);
      const maps=x.address
        ?googleSearchUrl(x.address)
        :(Number.isFinite(x.lat)&&Number.isFinite(x.lon)?googleSearchUrl(x.lat+","+x.lon):"");
      const hasPin=Number.isFinite(x.lat)&&Number.isFinite(x.lon);

      return '<article class="near-card">'+
        '<span>'+esc([type,distance].filter(Boolean).join(" · "))+'</span>'+
        '<strong>'+esc(x.name)+'</strong>'+
        (x.address?'<p>'+esc(x.address)+'</p>':"")+
        (x.opening_hours_note?'<small>'+esc(x.opening_hours_note)+'</small>':"")+
        '<div>'+
          (x.phone?'<a href="tel:'+esc(x.phone.replace(/\s/g,""))+'">Gọi →</a>':"")+
          (hasPin?'<button type="button" data-map-id="'+esc(x.id)+'">Xem pin</button>':"")+
          (maps?'<a href="'+esc(maps)+'" target="_blank" rel="noopener">Mở đường đi ↗</a>':"")+
        '</div>'+
      '</article>';
    }).join("");
  }

  function bind(){
    $("#areaRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-area]");
      if(!b)return;
      selectedArea=b.dataset.area;
      clearUserLocation();
      $("#useLocation").textContent="⌖ Dùng vị trí của tôi";
      renderControls();
      render();
    });

    $("#categoryRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-category]");
      if(!b)return;
      selectedCategory=b.dataset.category||null;
      renderControls();
      render();
    });

    $("#nearResults").addEventListener("click",e=>{
      const b=e.target.closest("[data-map-id]");
      if(!b||!nearMap)return;
      const marker=markerById.get(b.dataset.mapId);
      if(!marker)return;
      showLiveMap();
      const p=marker.getLatLng();
      nearMap.setView(p,16,{animate:true});
      marker.openPopup();
      $("#nearMap")?.scrollIntoView({behavior:"smooth",block:"center"});
    });

    $("#useLocation").addEventListener("click",()=>{
      const button=$("#useLocation");
      if(!navigator.geolocation){
        $("#nearStatus").textContent="Thiết bị này không chia sẻ được vị trí. Hãy chọn khu vực.";
        return;
      }
      button.disabled=true;
      button.textContent="Đang lấy vị trí...";

      navigator.geolocation.getCurrentPosition(p=>{
        position={lat:p.coords.latitude,lon:p.coords.longitude,accuracy:p.coords.accuracy};
        selectedArea=nearestArea(position);
        button.disabled=false;
        button.textContent="✓ Đang dùng vị trí này";
        renderControls();
        render();
      },()=>{
        button.disabled=false;
        button.textContent="⌖ Dùng vị trí của tôi";
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

      support=a;
      (b.entities||[]).forEach(x=>entities.set(x.id,x));

      const validAreas=new Set((support.near_me?.manual_areas||[]).map(x=>x.id));
      const validCategories=new Set((support.near_me?.categories||[]).map(x=>x.id));
      if(requestedArea&&validAreas.has(requestedArea))selectedArea=requestedArea;
      if(requestedCategory&&validCategories.has(requestedCategory))selectedCategory=requestedCategory;

      renderControls();
      bind();
      render();
    }catch(e){
      console.warn(e);
      $("#nearStatus").textContent="Chưa mở được danh sách tiện ích lúc này.";
      $("#nearResults").innerHTML='<div class="empty">Bạn vẫn có thể mở Danh bạ từ thanh trên.</div>';
      showDirectoryMap();
    }
  }

  load();
})();