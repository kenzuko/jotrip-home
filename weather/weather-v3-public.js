(()=>{
"use strict";
const CRITICAL="/weather/data/critical.json";
const NOWCAST="/weather/data/nowcast-compact.json";
const REFRESH_MS=5*60*1000;
const POINT_NAMES={duong_dong:"Dương Đông",an_thoi:"An Thới",ganh_dau:"Gành Dầu",cua_can:"Cửa Cạn",bai_thom:"Bãi Thơm",ham_ninh:"Hàm Ninh",bai_sao:"Bãi Sao",rach_gia:"Rạch Giá"};
const $=id=>document.getElementById(id);
let critical=null,nowcast=null,lastPoint=null;
function currentPoint(){return document.querySelector("#pointTabs button.active")?.dataset?.point||"duong_dong"}
function clock(iso){const d=new Date(iso||"");return Number.isFinite(d.getTime())?d.toLocaleTimeString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false}):null}
async function readJSON(url){const r=await fetch(url+(url.includes("?")?"&":"?")+"v="+Date.now(),{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status+" "+url);return r.json()}
function evidenceLabel(kind){const k=String(kind||"").toUpperCase();if(k==="ACTUAL")return"SỐ ĐO THỰC TẾ";if(k==="ACTUAL_REFERENCE")return"QUAN TRẮC SÂN BAY";if(k==="DERIVED_NOWCAST")return"DIỄN BIẾN MÂY";if(k==="REMOTE_OBSERVED")return"ẢNH VỆ TINH";return"CHƯA CÓ SỐ ĐO"}
function stateClass(state){const s=String(state||"");if(s==="ACTUAL_RAIN")return"rain";if(/REFERENCE_ACTUAL|APPROACHING|CONVECTIVE_WATCH/.test(s))return"watch";if(/STALE/.test(s))return"stale";return"neutral"}
function render(){
  const panel=$("v3ObservationPanel");if(!panel||!globalThis.OpenPQWeatherShortView)return;
  const pointId=currentPoint(),view=globalThis.OpenPQWeatherShortView.pointView(critical,nowcast,pointId);if(!view){panel.hidden=true;return}
  if($("v3PointLabel"))$("v3PointLabel").textContent="Theo "+(POINT_NAMES[pointId]||pointId);
  const now=view.now,soon=view.soon,nowCard=$("v3NowCard"),soonCard=$("v3SoonCard");
  if(nowCard)nowCard.className="v3-signal-card "+stateClass(now.state);
  if(soonCard)soonCard.className="v3-signal-card "+stateClass(soon.state);
  if($("v3NowEvidence"))$("v3NowEvidence").textContent=evidenceLabel(now.evidenceClass);
  if($("v3NowTitle"))$("v3NowTitle").textContent=now.headline;
  if($("v3NowDetail"))$("v3NowDetail").textContent=now.detail;
  if($("v3NowTime"))$("v3NowTime").textContent=now.observedAt?"Cập nhật "+clock(now.observedAt):"Chưa có số đo mưa mới";
  if($("v3SoonEvidence"))$("v3SoonEvidence").textContent=evidenceLabel(soon.evidenceClass);
  if($("v3SoonTitle"))$("v3SoonTitle").textContent=soon.headline;
  if($("v3SoonDetail"))$("v3SoonDetail").textContent=soon.detail;
  if($("v3SoonTime"))$("v3SoonTime").textContent=soon.observedAt?"Ảnh vệ tinh "+clock(soon.observedAt):"Đang chờ dữ liệu mới";
  panel.dataset.point=pointId;panel.dataset.engine="weather-v3-observation-nowcast";panel.hidden=false;lastPoint=pointId;
}
async function refresh(){
  try{
    const [c,n]=await Promise.allSettled([readJSON(CRITICAL),readJSON(NOWCAST)]);
    if(c.status==="fulfilled")critical=c.value;if(n.status==="fulfilled")nowcast=n.value;
    if(!critical&&!nowcast)throw new Error("short weather unavailable");
    render();
  }catch(err){console.warn("[Weather V3] chưa đọc được lớp quan trắc cực ngắn; giữ nguyên Weather V2.",err);const panel=$("v3ObservationPanel");if(panel)panel.hidden=true}
}
function boot(){
  const tabs=$("pointTabs");
  if(tabs){
    tabs.addEventListener("click",()=>setTimeout(render,0));
    new MutationObserver(()=>{const p=currentPoint();if(p!==lastPoint)render()})
      .observe(tabs,{subtree:true,childList:true,attributes:true,attributeFilter:["class"]});
  }
  refresh();setInterval(()=>{if(document.visibilityState==="visible")refresh()},REFRESH_MS);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh()});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();