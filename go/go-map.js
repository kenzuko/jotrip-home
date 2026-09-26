/* /go V1.1: map shows a labelled radial discovery circle for manual area or opt-in GPS.
   Distances are geodesic; never substitute them for road distance or travel time. */
(function(root){
"use strict";
const geo=()=>root.OpenPQGoGeo;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
let map=null,rings=null,pins=null,originMarker=null;
const ISLAND_FRAME=[[9.88,103.79],[10.46,104.16]]; // Full island and southern islets.
let fitVersion=0,lastBounds=null;
function fitVisible(bounds){
  lastBounds=bounds;
  const version=++fitVersion;
  const apply=()=>{
    if(version!==fitVersion||!map)return;
    // Recalculate Leaflet dimensions after mobile layout or rotation.
    map.invalidateSize({pan:false});
    map.fitBounds(bounds,{padding:[20,20],maxZoom:11,animate:false});
  };
  requestAnimationFrame(apply);
  setTimeout(apply,90);
}
function ensure(){
  const host=document.getElementById("goMap");
  if(!host)return false;
  if(!root.L){
    host.innerHTML='<div class="go-map-unavailable">Bản đồ chưa tải được. Bạn vẫn có thể chọn khu vực, dùng danh bạ Quanh đây hoặc xem gợi ý bên dưới.</div>';
    return false;
  }
  if(map)return true;
  map=L.map(host,{scrollWheelZoom:false,preferCanvas:true,tap:true,zoomControl:true,zoomSnap:.25})
    .setView([10.19,103.96],9);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,
    attribution:"© OpenStreetMap contributors"}).addTo(map);
  rings=L.layerGroup().addTo(map);
  pins=L.layerGroup().addTo(map);
  map.on("resize",()=>{if(lastBounds)map.fitBounds(lastBounds,{padding:[20,20],maxZoom:11,animate:false});});
  return true;
}
function centerIcon(gps){
  return L.divIcon({className:"go-radar-center"+(gps?" is-gps":" is-area"),
    html:'<span class="go-radar-wave"></span><span class="go-radar-dot"></span>',
    iconSize:[30,30],iconAnchor:[15,15]});
}
function groupPoints(points){
  const groups=new Map();
  for(const p of points){
    const key=p.point.lat.toFixed(4)+":"+p.point.lon.toFixed(4);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(p);
  }
  return [...groups.values()];
}
function popup(group,areaMode){
  const entries=group.slice(0,5).map(p=>{
    const link=p.route&&/^\/(?!\/)/.test(p.route)?'<a href="'+esc(p.route)+'">Chi tiết ↗</a>':"";
    return '<div class="go-radar-place"><strong>'+esc(p.name)+'</strong><small>'+p.km.toFixed(1)+' km '+(areaMode?"từ tâm khu vực":"từ vị trí của bạn")+'</small>'+link+'</div>';
  }).join("");
  const note=group[0].point.precision==="area_anchor"?
    '<small>Pin đại diện khu vực, không phải cổng vào chính xác.</small>':"";
  return '<div class="go-radar-popup">'+entries+
    (group.length>5?'<small>Và '+(group.length-5)+' điểm khác trong khu vực.</small>':"")+note+'</div>';
}
function draw(position,radius,rows,options={}){
  if(!geo()?.valid(position))return {shown:0,map:false};
  const selected=Math.min(50,Math.max(1,Math.round(Number(radius)||5)));
  const gps=!!options.gps;
  const points=geo().mapPoints(rows||[],position,selected);
  if(!ensure())return {shown:points.length,map:false};
  const center=[+position.lat,+position.lon];
  rings.clearLayers();pins.clearLayers();
  // Quarter-distance guides create a readable radar even at a custom 7/13/27km radius.
  for(const fraction of [.25,.5,.75,1]){
    const outer=fraction===1;
    const km=selected*fraction;
    L.circle(center,{radius:km*1000,weight:outer?3:1.15,
      color:outer?"#186d57":"#74a994",opacity:outer?.86:.56,
      dashArray:outer?null:"4 8",fillColor:"#53bc95",fillOpacity:outer?.085:0,
      interactive:false}).addTo(rings);
  }
  if(!originMarker){
    originMarker=L.marker(center,{icon:centerIcon(gps),zIndexOffset:1000}).addTo(map);
  }else{originMarker.setLatLng(center);originMarker.setIcon(centerIcon(gps));}
  originMarker.bindPopup(gps?"Vị trí của bạn (GPS đã cho phép). Chỉ dùng trong phiên này.":
    "Tâm khu vực tham khảo, không phải vị trí GPS của bạn.");
  for(const group of groupPoints(points)){
    const p=group[0];
    L.circleMarker([p.point.lat,p.point.lon],{radius:group.length>1?8:6,
      weight:2,color:"#fff",fillColor:"#bd6242",fillOpacity:.96})
      .bindPopup(popup(group,!gps),{maxWidth:270})
      .addTo(pins);
  }
  // The radius remains visible, but the entire island stays in the frame.
  const bounds=L.latLngBounds(ISLAND_FRAME);
  bounds.extend(L.circle(center,{radius:selected*1000}).getBounds());
  fitVisible(bounds);
  return {shown:points.length,markers:groupPoints(points).length,map:true};
}
function overview(){
  if(!ensure())return false;
  rings.clearLayers();pins.clearLayers();
  if(originMarker){map.removeLayer(originMarker);originMarker=null;}
  fitVisible(L.latLngBounds(ISLAND_FRAME));
  return true;
}
root.OpenPQGoMap={draw,overview,refresh(){if(map)fitVisible(lastBounds||L.latLngBounds(ISLAND_FRAME));}};
})(window);