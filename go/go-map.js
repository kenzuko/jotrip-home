/* /go V1.2 - shared map: area anchor, user-picked point, or optional GPS.
   All rings and distances are geodesic, never road ETA. */
(function(root){
"use strict";
const geo=()=>root.OpenPQGoGeo;
const layers=()=>root.OpenPQGoLayers;
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const MARKER_COLORS={place:"#2b906a",activity:"#c07848",utility:"#4782b7",hotel:"#8a72b4",food:"#da8550"};
let map=null,rings=null,pins=null,originMarker=null,selectionHandler=null,picking=false,markerById=new Map();
function ensure(){
  const host=document.getElementById("goMap");
  if(!host)return false;
  if(!root.L){
    host.innerHTML='<div class="go-map-unavailable">Chưa tải được bản đồ. Bạn vẫn có thể chọn khu vực và xem các địa điểm theo danh sách.</div>';
    return false;
  }
  if(map)return true;
  map=L.map(host,{scrollWheelZoom:false,preferCanvas:true,tap:true,zoomControl:true})
    .setView([10.2172,103.9593],12);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19,attribution:"© OpenStreetMap contributors"
  }).addTo(map);
  rings=L.layerGroup().addTo(map);
  pins=L.layerGroup().addTo(map);
  map.on("click",event=>{
    if(!picking||!selectionHandler)return;
    const point={lat:event.latlng.lat,lon:event.latlng.lng};
    if(!geo()?.valid(point))return;
    selectionHandler(point);
  });
  return true;
}
function setPickMode(enabled,handler){
  picking=!!enabled;selectionHandler=typeof handler==="function"?handler:selectionHandler;
  document.getElementById("goMap")?.classList.toggle("is-picking",picking);
  if(picking)ensure();
  return picking&&!!map;
}
function icon(mode){
  return L.divIcon({
    className:"go-radar-center "+(mode==="gps"?"is-gps":mode==="manual"?"is-manual":"is-area"),
    html:'<span class="go-radar-wave"></span><span class="go-radar-dot"></span>',
    iconSize:[30,30],iconAnchor:[15,15]
  });
}
function sameSpot(points){
  const groups=new Map();
  for(const p of points){
    const key=p.point.lat.toFixed(4)+":"+p.point.lon.toFixed(4);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(p);
  }
  return [...groups.values()];
}
function popup(group,mode){
  const origin=mode==="gps"?"từ vị trí GPS":mode==="manual"?"từ điểm bạn chọn":"từ tâm khu vực";
  const lines=group.slice(0,6).map(p=>{
    const link=p.route&&/^\/(?!\/)/.test(p.route)?'<a href="'+esc(p.route)+'">Xem chi tiết ↗</a>':"";
    return '<div class="go-radar-place"><strong>'+esc(p.name)+'</strong><small>'+p.km.toFixed(1)+' km '+origin+'</small>'+link+'</div>';
  }).join("");
  const anchor=group.some(p=>p.point.precision==="area_anchor")?
    '<small>Điểm tham khảo theo khu vực, không phải cổng vào chính xác.</small>':"";
  return '<div class="go-radar-popup">'+lines+
    (group.length>6?'<small>Và '+(group.length-6)+' địa điểm khác cùng tọa độ.</small>':"")+anchor+'</div>';
}
function addPins(points,mode){
  markerById.clear();pins.clearLayers();
  for(const group of sameSpot(points)){
    const color=group.length>1?"#b46d41":(MARKER_COLORS[layers()?.kind(group[0])]||"#328366");
    const pos=group[0].point;
    const pin=L.circleMarker([pos.lat,pos.lon],{
      radius:group.length>1?9:7,weight:2,color:"#fff",fillColor:color,fillOpacity:.97,
      bubblingMouseEvents:false
    }).bindPopup(popup(group,mode),{maxWidth:280}).addTo(pins);
    group.forEach(p=>markerById.set(String(p.id),pin));
  }
}
function sortedPoints(rows,position,radius,sort){
  const pts=geo()?.mapPoints(rows||[],position,radius)||[];
  return layers()?.sortPoints(pts,sort)||pts;
}
function focus(id){
  if(!ensure())return false;
  const pin=markerById.get(String(id));
  if(!pin)return false;
  map.setView(pin.getLatLng(),Math.max(map.getZoom(),13),{animate:true});
  pin.openPopup();
  return true;
}
function draw(position,radius,rows,options={}){
  if(!geo()?.valid(position))return{shown:0,points:[],map:false};
  const km=Math.min(50,Math.max(1,Math.round(Number(radius)||5)));
  const mode=["gps","manual"].includes(options.mode)?options.mode:"area";
  const points=sortedPoints(rows,position,km,options.sort);
  if(!ensure())return{shown:points.length,points,map:false};
  const center=[+position.lat,+position.lon];
  rings.clearLayers();
  for(const fraction of [.25,.5,.75,1]){
    const outer=fraction===1;
    L.circle(center,{
      radius:km*fraction*1000,weight:outer?3:1.2,
      color:outer?"#186d57":"#74a994",opacity:outer?.87:.5,
      dashArray:outer?null:"4 8",fillColor:"#53bc95",
      fillOpacity:outer?.09:0,interactive:false
    }).addTo(rings);
  }
  if(!originMarker)originMarker=L.marker(center,{icon:icon(mode),zIndexOffset:1000}).addTo(map);
  else{originMarker.setLatLng(center);originMarker.setIcon(icon(mode));}
  originMarker.bindPopup(mode==="gps"?"Vị trí GPS của bạn; chỉ dùng trong phiên này.":
    mode==="manual"?"Điểm xuất phát do bạn tự chọn trên bản đồ.":
    "Tâm khu vực tham khảo. Đây không phải vị trí chính xác của bạn.");
  addPins(points,mode);
  map.fitBounds(L.circle(center,{radius:km*1000}).getBounds(),{
    padding:[18,18],maxZoom:15,animate:false
  });
  setTimeout(()=>map?.invalidateSize(),60);
  return{shown:points.length,markers:sameSpot(points).length,points,map:true};
}
function overview(rows=[],position={lat:10.2172,lon:103.9593},options={}){
  const point=geo()?.valid(position)?position:{lat:10.2172,lon:103.9593};
  const pts=sortedPoints(rows,point,1000,options.sort);
  if(!ensure())return{shown:pts.length,points:pts,map:false};
  rings.clearLayers();
  if(originMarker){map.removeLayer(originMarker);originMarker=null;}
  addPins(pts,options.mode||"area");
  map.setView([10.19,103.96],10,{animate:false});
  setTimeout(()=>map?.invalidateSize(),60);
  return{shown:pts.length,points:pts,map:true};
}
root.OpenPQGoMap={draw,overview,focus,setPickMode,
  refresh(){if(map)setTimeout(()=>map.invalidateSize(),40)}};
})(window);