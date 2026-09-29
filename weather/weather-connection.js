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
   const current=item("/local-now.json"),cloud=item("/nowcast-compact.json"),marine=item("/marine.json"),forecast=item("/dashboard-data.json");
   const stale=rows.filter(x=>x.status!=="READY");
   box.hidden=false;
   if(!stale.length){box.dataset.state="ready";box.textContent="Quan trắc tại điểm "+ago(current?.age_minutes)+" · Mây "+ago(cloud?.age_minutes)+" · Dự báo theo giờ "+ago(forecast?.age_minutes)}
   else{
    box.dataset.state="degraded";
    const parts=[];
    if(current?.status!=="READY")parts.push("dữ liệu tại điểm "+ago(current?.age_minutes));
    if(cloud?.status!=="READY")parts.push("ảnh mây "+ago(cloud?.age_minutes));
    if(marine?.status!=="READY")parts.push("mô hình sóng nền "+ago(marine?.age_minutes));
    if(forecast?.status!=="READY")parts.push("dự báo theo giờ "+ago(forecast?.age_minutes));
    box.textContent="Đang chờ dữ liệu mới: "+parts.join(" · ")+". Sóng nền theo chu kỳ mô hình, không phải số đo biển trực tiếp. Xem thời điểm riêng trong từng mục.";
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
