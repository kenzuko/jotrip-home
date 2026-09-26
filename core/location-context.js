/* Shared, coarse Phú Quốc area selection for homepage, GO, Near Me and Explore.
   Session-only. Never stores GPS coordinates or treats a manual zone as GPS. */
(function(root,factory){
  const api=factory(root);
  root.OpenPQArea=api;
  if(typeof module==="object"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis,function(root){
 "use strict";
 const KEY="openpq:area:session:v1";
 const AREAS=Object.freeze({
   all:{label:"Toàn đảo",short:"Toàn đảo",go:null,explore:"all"},
   zone_central_west:{label:"Dương Đông",short:"Dương Đông",go:"zone_central_west",explore:"zone_central_west"},
   zone_south:{label:"Nam đảo",short:"Nam đảo",go:"zone_south",explore:"zone_south"},
   place_sunset_town:{label:"Sunset Town",short:"Sunset Town",go:"zone_south",explore:"zone_south"},
   zone_north:{label:"Bắc đảo",short:"Bắc đảo",go:"zone_north",explore:"zone_north"}
 });
 const isValid=id=>Object.prototype.hasOwnProperty.call(AREAS,String(id||""));
 const read=()=>{
   try{const id=root.sessionStorage?.getItem(KEY);return isValid(id)?id:null;}catch{return null;}
 };
 const current=()=>read()||"all";
 const zone=id=>AREAS[isValid(id)?id:"all"].go;
 const explore=id=>AREAS[isValid(id)?id:"all"].explore;
 const label=id=>AREAS[isValid(id)?id:"all"].label;
 function set(id,source="manual"){
   if(!isValid(id))return current();
   const previous=get();
   try{root.sessionStorage?.setItem(KEY,id);}catch{}
   // Notify active homepage modules even if Safari disallows storage.
   root.__openpqAreaFallback=id;
   const next=id;
   if(previous!==next&&typeof root.dispatchEvent==="function"&&typeof root.CustomEvent==="function")
     root.dispatchEvent(new root.CustomEvent("openpq:area-changed",{detail:{area:next,source}}));
   return next;
 }
 function get(){return isValid(root.__openpqAreaFallback)?root.__openpqAreaFallback:current();}
 function fromQuery(key,search){
   const params=search instanceof URLSearchParams?search:new URLSearchParams(search||"");
   if(params.has(key)&&isValid(params.get(key)))return params.get(key);
   return get();
 }
 function nearest(lat,lon){
   const a=Number(lat),b=Number(lon);
   // Do not classify positions outside Phú Quốc as being on the island.
   if(!Number.isFinite(a)||!Number.isFinite(b)||a<9.80||a>10.51||b<103.72||b>104.27)return null;
   const centers=[
     ["zone_central_west",10.2172,103.9593],
     ["zone_south",10.0191,104.0150],
     ["zone_north",10.3759,103.90]
   ];
   const rad=Math.PI/180;
   return centers.map(([id,y,x])=>{
     const dy=(a-y)*rad,dx=(b-x)*rad;
     const v=Math.sin(dy/2)**2+Math.cos(a*rad)*Math.cos(y*rad)*Math.sin(dx/2)**2;
     return {id,km:12742*Math.asin(Math.sqrt(v))};
   }).sort((x,y)=>x.km-y.km)[0].id;
 }
 function initHeader(){
   const button=document.querySelector("#siteAreaButton");
   const panel=document.querySelector("#siteAreaPanel");
   if(!button||!panel)return;
   const helper=document.querySelector("#siteAreaHint");
   const live=document.querySelector("#siteAreaStatus");
   const locate=document.querySelector("#siteAreaLocate");
   function render(){
     const selected=get();
     const title=label(selected);
     button.querySelector("[data-area-label]").textContent=AREAS[selected].short;
     button.setAttribute("aria-label","Khu vực: "+title+". Bấm để thay đổi.");
     panel.querySelectorAll("[data-area-option]").forEach(b=>{
       b.setAttribute("aria-pressed",String(b.dataset.areaOption===selected));
       b.classList.toggle("is-selected",b.dataset.areaOption===selected);
     });
     if(helper)helper.textContent=selected==="all"?"Chọn khu vực để nhận gợi ý thông minh hơn.":
       "Đang ưu tiên gợi ý quanh "+title+". Bạn vẫn tìm được mọi nơi trên đảo.";
   }
   function toggle(open){
     panel.hidden=!open;
     button.setAttribute("aria-expanded",String(open));
     if(open)panel.querySelector('[data-area-option="'+get()+'"]')?.focus();
   }
   button.addEventListener("click",()=>toggle(panel.hidden));
   panel.addEventListener("click",event=>{
     const item=event.target.closest("[data-area-option]");
     if(!item)return;
     set(item.dataset.areaOption,"header");
     render();toggle(false);button.focus();
     if(live)live.textContent="Đã chọn "+label(get())+".";
   });
   locate?.addEventListener("click",()=>{
     if(!navigator.geolocation){if(live)live.textContent="Thiết bị chưa hỗ trợ định vị. Bạn có thể chọn khu vực.";return;}
     locate.disabled=true;if(live)live.textContent="Đang xác định khu vực của bạn...";
     navigator.geolocation.getCurrentPosition(({coords})=>{
       locate.disabled=false;
       const id=nearest(coords.latitude,coords.longitude);
       if(!id){if(live)live.textContent="Vị trí hiện ngoài Phú Quốc. Bạn có thể chọn khu vực thủ công.";return;}
       // Only the broad area is persisted, never the supplied coordinates.
       set(id,"gps-coarse");render();toggle(false);button.focus();
       if(live)live.textContent="Đã chọn "+label(id)+". Không lưu tọa độ GPS.";
     },()=>{
       locate.disabled=false;
       if(live)live.textContent="Chưa lấy được vị trí. Bạn có thể chọn khu vực.";
     },{enableHighAccuracy:false,timeout:8000,maximumAge:300000});
   });
   document.addEventListener("click",event=>{
     if(!panel.hidden&&!panel.contains(event.target)&&!button.contains(event.target))toggle(false);
   });
   document.addEventListener("keydown",event=>{
     if(event.key==="Escape"&&!panel.hidden){toggle(false);button.focus();}
   });
   root.addEventListener?.("openpq:area-changed",render);
   render();
 }
 function boot(){
   if(typeof document==="undefined")return;
   if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initHeader,{once:true});
   else initHeader();
 }
 boot();
 return {KEY,AREAS,isValid,read,get,set,zone,explore,label,fromQuery,nearest,initHeader};
});