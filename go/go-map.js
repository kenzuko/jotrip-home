/* /go 1.1 map - Leaflet and verified canonical coordinates, no remote routing API. */
(function(root){
"use strict";
const geo=()=>root.OpenPQGoGeo;
let map=null,circles=null,pins=null,selfMarker=null;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const tileUrl="https://tile.openstreetmap.org/{z}/{x}/{y}.png";
function ensure(){
  const host=document.getElementById("goMap");
  if(!host)return false;
  if(!root.L){
    host.innerHTML='<div class="go-map-unavailable">Chưa mở được bản đồ lúc này. Bạn vẫn có thể xem gợi ý theo khu vực hoặc mở Quanh đây.</div>';
    return false;
  }
  if(map)return true;
  map=L.map(host,{scrollWheelZoom:false,tap:true,preferCanvas:true,zoomControl:true})
    .setView([10.2172,103.9593],12);
  L.tileLayer(tileUrl,{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(map);
  circles=L.layerGroup().addTo(map);
  pins=L.layerGroup().addTo(map);
  return true;
}
function icon(){
  return L.divIcon({className:"go-you-marker",html:'<span class="go-you-pulse"></span><span class="go-you-core"></span>',iconSize:[28,28],iconAnchor:[14,14]});
}
function draw(position,radius,rows){
  if(!geo()?.valid(position))return {shown:0,total:0,map:false};
  const selected=Number(radius)||5;
  const points=geo().mapPoints(rows||[],position,selected);
  if(!ensure())return{shown:points.length,total:rows?.length||0,map:false};
  const center=[position.lat,position.lon];
  circles.clearLayers();pins.clearLayers();
  for(const km of [2,5,10,20]){
    if(km>selected)continue;
    L.circle(center,{radius:km*1000,color:km===selected?"#176954":"#75ad9e",weight:km===selected?3:1.4,
      opacity:km===selected?0.9:0.45,fillColor:"#57ad9a",fillOpacity:km===selected?0.09:0,dashArray:km===selected?null:"5 7",
      interactive:false}).addTo(circles);
  }
  if(!selfMarker){
    selfMarker=L.marker(center,{icon:icon(),zIndexOffset:1000}).bindPopup("Vị trí của bạn · chỉ dùng trong phiên này").addTo(map);
  }else selfMarker.setLatLng(center);
  const used=new Set();
  for(const item of points){
    const k=item.point.lat.toFixed(4)+":"+item.point.lon.toFixed(4);
    // Cluster individual venues sharing an area anchor without stacking dozens of pins.
    if(used.has(k))continue;used.add(k);
    const link=item.route&&/^\/(?!\/)/.test(item.route)?'<a href="'+esc(item.route)+'">Xem địa điểm →</a>':"";
    L.circleMarker([item.point.lat,item.point.lon],{radius:6,weight:2,color:"#fff",fillColor:"#c86747",fillOpacity:.95})
      .bindPopup('<strong>'+esc(item.name)+'</strong><br>'+item.km.toFixed(1)+' km đường chim bay<br>'+link)
      .addTo(pins);
  }
  const b=L.circle(center,{radius:selected*1000});
  map.fitBounds(b.getBounds(),{padding:[18,18],maxZoom:15,animate:false});
  setTimeout(()=>map.invalidateSize(),50);
  return{shown:points.length,total:rows?.length||0,map:true};
}
root.OpenPQGoMap={draw,refresh(){if(map)setTimeout(()=>map.invalidateSize(),25)}};
})(window);