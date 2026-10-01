/* Supplemental CMS edge diagnostics; does not alter Weather forecasting logic. */
(()=>{"use strict";
 const box=document.getElementById("weatherEdgeState");if(!box)return;
 const CHECK_MS=10*60*1000,MIN_RECHECK_MS=5*60*1000;
 let lastCheckAt=0,busy=false;
 const ago=minutes=>minutes==null?"chưa rõ":minutes<2?"vừa cập nhật":minutes<60?minutes+" phút trước":Math.floor(minutes/60)+" giờ "+(minutes%60?minutes%60+" phút ":"")+"trước";
 async function check(){
  if(busy||document.visibilityState==="hidden")return;
  busy=true;
  try{
   const response=await fetch("/weather/data/edge-health.json?t="+Date.now(),{cache:"no-store",signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error("HTTP "+response.status);
   const h=await response.json();if(h.schema_version!=="openpq-weather-edge-health-v1")throw Error("invalid contract");
   const rows=h.results||[];
   const item=suffix=>rows.find(x=>x.path.endsWith(suffix));
   const current=item("/local-now.json"),cloud=item("/nowcast-compact.json"),ground=item("/groundtruth.json");
   const currentWaiting=current?.status!=="READY";
   const groundWaiting=ground?.status!=="READY";
   // This strip is reserved for a real current-condition data gap. Model-cycle
   // age and a late satellite frame are shown in their own sections instead of
   // making the whole Weather page look broken.
   if(!(currentWaiting&&groundWaiting)){
    box.hidden=true;
    box.textContent="";
   }else{
    box.hidden=false;
    box.dataset.state="degraded";
    const parts=["dữ liệu tại điểm "+ago(current?.age_minutes),"quan trắc mặt đất "+ago(ground?.age_minutes)];
    if(cloud?.status!=="READY")parts.push("ảnh mây "+ago(cloud?.age_minutes));
    box.textContent="Đang chờ dữ liệu hiện tại mới: "+parts.join(" · ")+". Các lớp dự báo và biển vẫn ghi thời điểm riêng trong từng mục.";
   }
  }catch(e){
   box.hidden=false;box.dataset.state="offline";
   box.textContent="Chưa kiểm tra được kết nối dữ liệu mới. Các số liệu bên dưới có ghi giờ cập nhật riêng.";
  }finally{
   lastCheckAt=Date.now();busy=false;
  }
 }
 check();
 setInterval(()=>{if(document.visibilityState==="visible")check()},CHECK_MS);
 document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&Date.now()-lastCheckAt>MIN_RECHECK_MS)check();
 });
})();
