/* Open Phu Quoc /go 1.1 radar. One explicit GPS fix, no tracking and no storage.
   Radius is straight-line distance; the map deliberately never invents road routes. */
(function(root){
  "use strict";
  let map=null,base=null,originLayer=null,radiusLayer=null,pinLayer=null;
  const safeUrl=url=>typeof url==="string"&&(/^(?:\/|\.\.?\/)(?!\/)/.test(url))?url:null;
  const distance=(a,b)=>root.OpenPQGoEngine?.distanceKm(a,b);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  function init(){
    const host=document.getElementById("goRadarMap");
    if(!host)return false;
    if(!root.L){
      host.innerHTML='<div class="go-map-unavailable">Bản đồ tạm thời chưa tải được. Bạn vẫn có thể xem những điểm có tọa độ bên dưới.</div>';
      return false;
    }
    if(map)return true;
    map=L.map(host,{preferCanvas:true,scrollWheelZoom:false,zoomControl:true,attributionControl:true}).setView([10.2172,103.9593],12);
    base=root.OpenPQMapBase?.add?root.OpenPQMapBase.add(map,{maxZoom:19}):
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
    originLayer=L.layerGroup().addTo(map);radiusLayer=L.layerGroup().addTo(map);pinLayer=L.layerGroup().addTo(map);
    return true;
  }
  function show({coords,radiusKm,rows}){
    const km=Number(radiusKm)||10;
    const nearby=(rows||[]).filter(item=>item.map&&Number.isFinite(distance(coords,item.map)))
      .map(item=>({...item,distanceKm:distance(coords,item.map)}))
      .filter(item=>item.distanceKm<=km)
      .sort((a,b)=>a.distanceKm-b.distanceKm);
    const host=document.getElementById("goRadarMap");
    if(!host)return nearby;
    if(init()){
      originLayer.clearLayers();radiusLayer.clearLayers();pinLayer.clearLayers();
      for(const ringKm of [2,5,10,20].filter(n=>n<km)){
        L.circle([coords.lat,coords.lon],{radius:ringKm*1000,color:"#2c826c",weight:1,opacity:.28,fill:false,dashArray:"5 8",interactive:false}).addTo(radiusLayer);
      }
      const circle=L.circle([coords.lat,coords.lon],{
        radius:km*1000,color:"#22765f",weight:2,opacity:.85,
        fillColor:"#62b99c",fillOpacity:.10,interactive:false
      }).addTo(radiusLayer);
      if(Number.isFinite(coords.accuracy)&&coords.accuracy>0&&coords.accuracy<1000){
        L.circle([coords.lat,coords.lon],{radius:coords.accuracy,color:"#2879b2",weight:1,fillColor:"#91c5ec",fillOpacity:.24,interactive:false}).addTo(originLayer);
      }
      L.marker([coords.lat,coords.lon],{
        zIndexOffset:1200,
        icon:L.divIcon({className:"go-gps-marker",html:'<span class="go-gps-pulse"></span><span class="go-gps-dot"></span>',iconSize:[26,26],iconAnchor:[13,13]})
      }).bindPopup("Vị trí của bạn").addTo(originLayer);
      for(const point of nearby){
        const color=point.isFood?"#d87839":"#206f60";
        const circlePoint=L.circleMarker([point.map.lat,point.map.lon],{
          radius:point.isFood?8:6,color:"#ffffff",weight:2,fillColor:color,fillOpacity:.95
        }).addTo(pinLayer);
        const card=document.createElement("div");card.className="go-map-popup";
        const title=document.createElement("strong");title.textContent=point.name;card.appendChild(title);
        const note=document.createElement("small");note.textContent=point.distanceKm.toFixed(1)+" km đường thẳng"+(point.map.precision==="area_anchor"?" · Vị trí khu vực":"");card.appendChild(note);
        const url=safeUrl(point.route);
        if(url){const a=document.createElement("a");a.href=url;a.textContent="Xem chi tiết →";card.appendChild(a)}
        circlePoint.bindPopup(card);
      }
      map.fitBounds(circle.getBounds(),{padding:[20,20],animate:false,maxZoom:15});
      requestAnimationFrame(()=>map.invalidateSize());
    }
    const list=document.getElementById("goRadarList");
    if(list){
      list.innerHTML=nearby.length?nearby.slice(0,7).map(point=>
        '<a href="'+esc(safeUrl(point.route)||"../explore/")+'"><span class="go-near-kind">'+(point.isFood?"Ăn uống":"Địa điểm")+'</span><strong>'+esc(point.name)+'</strong><small>'+point.distanceKm.toFixed(1)+' km'+(point.map.precision==="area_anchor"?" · vị trí khu vực":"")+'</small></a>'
      ).join(""):'<p>Chưa có điểm đã xác minh trong vòng này. Thử mở rộng bán kính hoặc tìm thêm trên Near Me.</p>';
    }
    const note=document.getElementById("goRadarNote");
    if(note)note.textContent=nearby.length+" địa điểm có tọa độ trong "+km+" km. Vòng tròn đo đường thẳng; đường thực tế có thể dài hơn.";
    return nearby;
  }
  function clear(){
    originLayer?.clearLayers();radiusLayer?.clearLayers();pinLayer?.clearLayers();
  }
  root.OpenPQGoRadar={show,clear};
})(window);
