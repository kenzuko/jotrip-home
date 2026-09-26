(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));

  const AREA_VIEW={
    all:{center:[10.20,103.97],zoom:10},
    zone_central_west:{center:[10.2172,103.9593],zoom:13},
    zone_south:{center:[10.0191,104.0150],zoom:13},
    place_sunset_town:{center:[10.026903,104.007917],zoom:14},
    zone_north:{center:[10.3759,103.90],zoom:13}
  };

  let support=null;
  let rows=[];
  let selectedArea="all";
  let selectedCategory=null;
  let searchText="";
  let position=null;
  let nearMap=null;
  let markerLayer=null;
  let userLayer=null;
  const markerById=new Map();

  const initialParams=new URLSearchParams(location.search);
  const requestedArea=initialParams.get("area")||(!initialParams.has("area")?window.OpenPQArea?.get():null);
  const requestedCategory=initialParams.get("category");
  const requestedQuery=initialParams.get("q")||"";

  function category(id=selectedCategory){
    return support?.near_me?.categories?.find(x=>x.id===id)||null;
  }

  function hasStoredVenueData(id=selectedCategory){
    if(!id)return false;
    return rows.some(row=>
      (row.entity_type==="venue"||row.entity_type==="utility") &&
      (row.tags||[]).includes(id) &&
      matchesArea(row)
    );
  }

  function isDiscoveryCategory(id=selectedCategory){
    return category(id)?.mode==="directory_search" && !hasStoredVenueData(id);
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
    const term=searchText.trim()||cat?.search_query||cat?.label||"địa điểm";
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

  function showDirectoryMap(query=mapSearchQuery(),label="Google Maps"){
    const live=$("#nearLeaflet");
    const frame=$("#nearDirectoryMap");
    if(live)live.hidden=true;
    if(!frame)return;
    frame.hidden=false;
    const zoom=selectedArea==="all"?10:13;
    frame.src=googleEmbedUrl(query,zoom);
    setMapBadge(label);
    const note=$("#mapNote");
    if(note)note.textContent="Đang dùng bản đồ tìm kiếm cho những nơi chưa có pin lưu trong Open Phu Quoc.";
    updateExternalMapLink(query);
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

  function buildVenueRows(doc){
    return (doc?.entities||[])
      .map(x=>window.OpenPQVenue?.normalizeVenue(x))
      .filter(Boolean);
  }

  function buildRows(index){
    const utilityMeta=new Map((support?.near_me?.items||[]).map(x=>[x.utility_id,x]));
    return (index?.documents||[]).map(doc=>{
      const meta=doc.entity_type==="utility"?(utilityMeta.get(doc.id)||{}):{};
      return {
        ...doc,
        ...meta,
        id:doc.id,
        name:doc.name,
        address:doc.address||"",
        tags:doc.tags||[],
        route:doc.route||meta.route||null,
        lat:Number.isFinite(doc.map?.lat)?doc.map.lat:null,
        lon:Number.isFinite(doc.map?.lon)?doc.map.lon:null,
        map_precision:doc.map?.precision||null,
        group:doc.group||null,
        utility_type:doc.utility_type||null
      };
    });
  }

  function areaLabel(){
    if(position)return "Vị trí của tôi";
    return support?.near_me?.manual_areas?.find(x=>x.id===selectedArea)?.label||"Toàn đảo";
  }

  function matchesArea(row){
    if(selectedArea==="all")return true;
    if(selectedArea==="place_sunset_town"){
      const hay=[row.name,row.address,...(row.related_entities||[])].join(" ").toLowerCase();
      return row.place_id==="place_sunset_town"||row.id==="place_sunset_town"||hay.includes("sunset town");
    }
    return row.zone_id===selectedArea||row.place_id===selectedArea;
  }

  function matchesCategory(row,id=selectedCategory){
    if(!id)return true;
    if(isDiscoveryCategory(id))return false;
    return (row.tags||[]).includes(id);
  }

  function matchesSearch(row){
    const q=searchText.trim().toLowerCase();
    if(!q)return true;
    const hay=[row.name,row.address,row.what_it_is,row.group,...(row.aliases||[])].join(" ").toLowerCase();
    return hay.includes(q);
  }

  function defaultVisible(row){
    if(selectedCategory||searchText.trim())return true;
    return row.entity_type!=="hotel";
  }

  function renderControls(){
    const areas=support?.near_me?.manual_areas||[];
    const available=new Set(rows.flatMap(x=>x.tags||[]));
    const cats=(support?.near_me?.categories||[]).filter(x=>available.has(x.id)||x.mode==="directory_search");
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

  function glyphFor(row){
    if(row.entity_type==="hotel")return"H";
    const first=(row.tags||[])[0];
    return category(first)?.icon||category(row.utility_type)?.icon||(row.entity_type==="place"?"●":"•");
  }

  function markerColor(item){
    const tags=item.tags||[];
    if(tags.includes("BEACH"))return "#11a7b5";
    if(tags.includes("ENTERTAINMENT")||tags.includes("ACTIVITY"))return "#e77a45";
    if(tags.includes("CULTURE"))return "#8a66b5";
    if(tags.includes("MARKET"))return "#d19a25";
    if(item.entity_type==="hotel")return "#5278a7";
    if(item.entity_type==="utility")return "#4b9b70";
    return "#247d80";
  }

  function markerIcon(item){
    const color=markerColor(item);
    return L.divIcon({
      className:"",
      html:'<div class="near-pin" style="background:'+color+'"><span>'+esc(glyphFor(item))+'</span></div>',
      iconSize:[30,30],
      iconAnchor:[15,15],
      popupAnchor:[0,-14]
    });
  }

  function openingHoursLabel(item){
    const hours=item.opening_hours;
    const windows=hours?.windows||hours?.times||[];
    const schedule=windows.map(x=>[x.start,x.end].filter(Boolean).join('–')+(x.label?' '+x.label:'')).filter(Boolean).join(' · ');
    if(schedule)return schedule+(hours?.note?' · '+hours.note:'');
    return item.opening_hours_note|| (item.entity_type==='utility'?'Giờ mở cửa chưa được xác nhận.':'');
  }

  function reliabilityLabel(item){
    if(item.verified===false){
      if(item.utility_type==="CHARGING")return "Vị trí do cộng đồng ghi nhận. Chưa xác minh trạm còn hoạt động, quyền vào hoặc loại trụ. Kiểm tra VinFast trước khi đi.";
      if(item.utility_type==="FUEL")return "Điểm cây xăng tham khảo từ bản đồ cộng đồng, chưa xác nhận hoạt động hoặc giờ mở cửa.";
      return "Thông tin địa điểm tham khảo, chưa xác minh hoạt động.";
    }
    return "";
  }
  function mapInfoLabel(item){
    const map=item.map||{};
    const precision=map.precision==="area_anchor"?"Pin định hướng khu vực":map.precision==="site_centroid"?"Tâm khuôn viên, có thể khác cổng vào":map.precision?"Độ chính xác: "+map.precision:"";
    const source=map.source&&!/^https?:\/\//i.test(map.source)?"Đối chiếu: "+map.source:"";
    const date=map.verified_at?"Rà soát dữ liệu: "+map.verified_at:"";
    return [precision,source,date,map.note].filter(Boolean).join(" · ");
  }
  function typeLabel(item){
    if(item.entity_type==="venue")return category(item.utility_type)?.label||item.group||"Địa điểm";
    if(item.entity_type==="hotel")return item.star_rating?"Khách sạn "+item.star_rating+" sao":"Khách sạn";
    if(item.entity_type==="activity")return(item.categories||[]).includes("show")?"Show":"Trải nghiệm";
    if(item.entity_type==="place"){
      if(item.tags.includes("BEACH"))return"Bãi biển";
      if(item.tags.includes("ENTERTAINMENT"))return"Vui chơi";
      if(item.tags.includes("MARKET"))return"Chợ";
      if(item.tags.includes("CULTURE"))return"Văn hóa";
      return"Điểm đến";
    }
    return category(item.utility_type)?.label||item.group||"Tiện ích";
  }

  function filteredRows(){
    let visible=rows.filter(defaultVisible).filter(row=>matchesArea(row)).filter(row=>matchesCategory(row)).filter(row=>matchesSearch(row));
    let gpsFallback=false;

    if(position&&!isDiscoveryCategory()){
      const withCoords=visible
        .filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon))
        .map(x=>({...x,distance_km:haversine(position,{lat:x.lat,lon:x.lon})}))
        .sort((a,b)=>a.distance_km-b.distance_km);

      const withoutCoords=visible
        .filter(x=>!Number.isFinite(x.lat)||!Number.isFinite(x.lon))
        .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi"));

      gpsFallback=withoutCoords.length>0;
      visible=[...withCoords,...withoutCoords];
    }else{
      visible.sort((a,b)=>{
        const wa=a.entity_type==="place"?0:a.entity_type==="utility"?1:2;
        const wb=b.entity_type==="place"?0:b.entity_type==="utility"?1:2;
        return wa-wb||(b.featured?1:0)-(a.featured?1:0)||String(a.name).localeCompare(String(b.name),"vi");
      });
    }

    return {rows:visible,gpsFallback};
  }

  function renderMapPoints(visible){
    updateExternalMapLink();

    if(isDiscoveryCategory()){
      showDirectoryMap(mapSearchQuery(),"Tìm trên Google Maps");
      return;
    }

    if(!nearMap){
      showDirectoryMap();
      return;
    }

    const mapped=visible.filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lon));
    if(!mapped.length&&visible.length){
      showDirectoryMap([selectedCategory?category()?.label:"",searchText.trim(),areaQuery()].filter(Boolean).join(" "),"Tìm theo khu vực");
      return;
    }

    showLiveMap();
    markerLayer?.clearLayers();
    markerById.clear();

    for(const x of mapped){
      const marker=L.marker([x.lat,x.lon],{icon:markerIcon(x)});
      marker.bindPopup(
        '<div class="near-popup"><strong>'+esc(x.name)+'</strong>'+
        '<span>'+esc(typeLabel(x))+'</span>'+
        (x.address?'<small>'+esc(x.address)+'</small>':"")+
        (openingHoursLabel(x)?'<small>'+esc(openingHoursLabel(x))+'</small>':"")+
        (reliabilityLabel(x)?'<small>'+esc(reliabilityLabel(x))+'</small>':"")+
        (mapInfoLabel(x)?'<small>'+esc(mapInfoLabel(x))+'</small>':"")+
        (x.phone?'<a href="tel:'+esc(x.phone.replace(/\s/g,""))+'">Gọi '+esc(x.phone)+'</a>':"")+
        '</div>'
      );
      marker.addTo(markerLayer);
      markerById.set(x.id,marker);
    }

    if(position)showUserLocation(position);
    else setAreaView(selectedArea);

    const total=visible.length;
    setMapBadge(mapped.length+"/"+total+" điểm có pin Open Phu Quoc");
    const note=$("#mapNote");
    if(note)note.textContent=total===mapped.length
      ?"Các điểm đang thấy đều đã có tọa độ lưu trong Open Phu Quoc."
      :mapped.length+" điểm có pin lưu sẵn. Những điểm chưa có pin vẫn mở được theo tên và địa chỉ trên bản đồ.";
  }

  function renderDiscovery(){
    const cat=category();
    const label=cat?.label||"Địa điểm";
    $("#resultsTitle").textContent=areaLabel()+" · "+label;
    $("#resultsCount").textContent="Tìm trên bản đồ";
    $("#nearStatus").textContent="Đang tìm "+label.toLowerCase()+" theo khu vực bạn chọn.";
    renderMapPoints([]);

    const query=mapSearchQuery();
    $("#nearResults").innerHTML=
      '<article class="discovery-card">'+
        '<span>KHÁM PHÁ QUANH ĐÂY</span>'+
        '<strong>'+esc(label)+' quanh '+esc(areaLabel())+'</strong>'+
        '<p>Mở lớp bản đồ để tìm nhanh. Khi địa điểm đã có trong data Open Phu Quoc, nó sẽ dùng chung địa chỉ và pin với các trang khác.</p>'+
        '<a href="'+esc(googleSearchUrl(query))+'" target="_blank" rel="noopener">Mở trên Google Maps ↗</a>'+
      '</article>';
  }

  function exactMapQuery(row){
    return [row.name,row.address,"Phú Quốc"].filter(Boolean).join(", ");
  }

  function render(){
    if(!support)return;
    if(isDiscoveryCategory()){
      renderDiscovery();
      return;
    }

    const result=filteredRows();
    const visible=result.rows;
    window.__openpqNearState={
      ...(window.__openpqNearState||{}),
      rowsCount:rows.length,
      visibleCount:visible.length,
      selectedArea,
      selectedCategory,
      searchText,
      href:location.href,
      activeArea:$("#areaRow .active")?.dataset?.area||null,
      activeCategory:$("#categoryRow .active")?.dataset?.category??null
    };
    const label=selectedCategory?category()?.label:"";
    $("#resultsTitle").textContent=searchText.trim()
      ?'Kết quả cho “'+searchText.trim()+'”'
      :areaLabel()+(label?" · "+label:"");
    $("#resultsCount").textContent=visible.length+" địa điểm";
    $("#nearStatus").textContent=position
      ?(result.gpsFallback
        ?"Điểm có tọa độ được xếp theo khoảng cách; các điểm còn lại vẫn giữ theo khu vực."
        :"Đã xếp những nơi gần bạn lên trước.")
      :"Chọn một lớp hoặc gõ tên nơi bạn cần tìm.";

    renderMapPoints(visible);

    const host=$("#nearResults");
    if(!visible.length){
      host.innerHTML='<div class="empty">Chưa thấy kết quả phù hợp. Thử tên khác hoặc bỏ bớt bộ lọc nhé.</div>';
      return;
    }

    const limited=visible.slice(0,120);
    host.innerHTML=limited.map(x=>{
      const distance=Number.isFinite(x.distance_km)?x.distance_km.toFixed(1)+" km":"";
      const type=typeLabel(x);
      const query=x.verified===false&&Number.isFinite(x.map?.lat)&&Number.isFinite(x.map?.lon)?x.map.lat+","+x.map.lon:exactMapQuery(x);
      const hasPin=Number.isFinite(x.lat)&&Number.isFinite(x.lon);
      const address=x.address||"Tìm theo tên địa điểm trên bản đồ";

      return '<article class="near-card">'+
        '<span>'+esc([type,distance].filter(Boolean).join(" · "))+'</span>'+
        '<strong>'+esc(x.name)+'</strong>'+
        '<p>'+esc(address)+'</p>'+
        (openingHoursLabel(x)?'<small>'+esc(openingHoursLabel(x))+'</small>':"")+
        (reliabilityLabel(x)?'<small>'+esc(reliabilityLabel(x))+'</small>':"")+
        (x.map?.note?'<small>'+esc(x.map.note)+'</small>':"")+
        '<div>'+
          (x.phone?'<a href="tel:'+esc(x.phone.replace(/\s/g,""))+'">Gọi →</a>':"")+
          (hasPin?'<button type="button" data-map-id="'+esc(x.id)+'">Xem pin</button>':'<button type="button" data-map-query="'+esc(query)+'">Xem bản đồ</button>')+
          '<a href="'+esc(googleSearchUrl(query))+'" target="_blank" rel="noopener">'+(x.verified===false?"Vị trí tham khảo ↗":"Đường đi ↗")+'</a>'+
          (x.external_verify_url?'<a href="'+esc(x.external_verify_url)+'" target="_blank" rel="noopener noreferrer">Kiểm tra nguồn ↗</a>':"")+
          (x.route?'<a href="'+esc(x.route)+'">Thông tin →</a>':"")+
        '</div>'+
      '</article>';
    }).join("")+(visible.length>limited.length?'<div class="results-more">Còn '+(visible.length-limited.length)+' kết quả. Gõ tên cụ thể để tìm nhanh hơn.</div>':"");
  }

  function bind(){
    $("#areaRow").addEventListener("click",e=>{
      const b=e.target.closest("[data-area]");
      if(!b)return;
      selectedArea=b.dataset.area;
      window.OpenPQArea?.set(selectedArea,"near-manual");
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

    $("#nearSearch").addEventListener("input",e=>{
      searchText=e.target.value||"";
      render();
    });

    $("#nearResults").addEventListener("click",e=>{
      const pin=e.target.closest("[data-map-id]");
      if(pin&&nearMap){
        const marker=markerById.get(pin.dataset.mapId);
        if(marker){
          showLiveMap();
          const p=marker.getLatLng();
          nearMap.setView(p,16,{animate:true});
          marker.openPopup();
          $("#nearMap")?.scrollIntoView({behavior:"smooth",block:"center"});
        }
        return;
      }

      const queryButton=e.target.closest("[data-map-query]");
      if(queryButton){
        showDirectoryMap(queryButton.dataset.mapQuery||mapSearchQuery(),"Địa điểm trên Google Maps");
        $("#nearMap")?.scrollIntoView({behavior:"smooth",block:"center"});
      }
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
        const coarse=window.OpenPQArea?.nearest?.(position.lat,position.lon);
        if(!coarse){position=null;button.disabled=false;$("#nearStatus").textContent="Vị trí ngoài Phú Quốc. Chọn khu vực thủ công nhé.";return;}
        selectedArea=nearestArea(position);
        window.OpenPQArea?.set(coarse,"near-gps-coarse");
        button.disabled=false;
        button.textContent="✓ Đang dùng vị trí này";
        renderControls();
        render();
      },()=>{
        button.disabled=false;
        button.textContent="⌖ Dùng vị trí của tôi";
        $("#nearStatus").textContent="Chưa lấy được vị trí. Bạn vẫn có thể tìm bằng tên hoặc chọn khu vực.";
      },{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
    });
  }

  async function load(){
    initMap();
    try{
      const [a,locationIndex,venueDirectory]=await Promise.all([
        fetch("../data/home-support.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
        fetch("../data/views/location-index.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
        fetch("../data/entities/destination-venues.json?t="+Date.now(),{cache:"no-store"})
          .then(r=>r.ok?r.json():({entities:[]}))
          .catch(()=>({entities:[]}))
      ]);

      support=a;
      rows=window.OpenPQVenue.mergeWithCanonical(buildRows(locationIndex),buildVenueRows(venueDirectory));
      window.__openpqNearState={
        indexCount:Array.isArray(locationIndex?.documents)?locationIndex.documents.length:0,
        venueCount:Array.isArray(venueDirectory?.entities)?venueDirectory.entities.filter(x=>x.status==="ACTIVE").length:0,
        rowsCount:rows.length,
        requestedArea,
        requestedCategory,
        requestedQuery,
        selectedArea,
        selectedCategory,
        searchText
      };

      const validAreas=new Set((support.near_me?.manual_areas||[]).map(x=>x.id));
      const validCategories=new Set((support.near_me?.categories||[]).map(x=>x.id));
      if(requestedArea&&validAreas.has(requestedArea)){
        selectedArea=requestedArea;
        if(initialParams.has("area"))window.OpenPQArea?.set(selectedArea,"near-link");
      }
      if(requestedCategory&&validCategories.has(requestedCategory))selectedCategory=requestedCategory;
      if(requestedQuery){
        searchText=requestedQuery;
        $("#nearSearch").value=requestedQuery;
      }

      renderControls();
      bind();
      render();
    }catch(e){
      console.warn(e);
      $("#nearStatus").textContent="Chưa mở được dữ liệu quanh đây lúc này.";
      $("#nearResults").innerHTML='<div class="empty">Bạn vẫn có thể gõ địa điểm trực tiếp trên Google Maps.</div>';
      showDirectoryMap();
    }
  }

  load();
})();