(()=>{"use strict";const $=s=>document.querySelector(s);const labels={direct:"Trực tiếp / không rõ",internal:"Từ trang Open Phu Quoc",search:"Google / công cụ tìm kiếm",ai:"ChatGPT / ứng dụng AI",social:"Mạng xã hội",referral:"Website khác",mobile:"Điện thoại",tablet:"Máy tính bảng",desktop:"Máy tính",other:"Khác",go_open:"Mở GO",nearme_open:"Mở Quanh đây",weather_open:"Mở Thời tiết",airport_open:"Mở Sân bay",transit_open:"Mở Tàu & phà",feedback_open:"Mở Góp ý",XX:"Chưa xác định"};
const number=v=>new Intl.NumberFormat("vi-VN").format(Number(v)||0);
const empty=()=>{const el=document.createElement("p");el.className="empty";el.textContent="Chưa có dữ liệu trong kỳ.";return el};
function bars(id,rows,key="channel",limit=15){
 const parent=$(id);parent.replaceChildren();
 if(!rows?.length){parent.append(empty());return}
 const max=Math.max(1,...rows.map(r=>Number(r.hits)||0));
 for(const row of rows.slice(0,limit)){
   const el=document.createElement("div");el.className="bar-row";
   const name=document.createElement("span");name.className="name";name.textContent=labels[row[key]]||row[key]||"Khác";name.title=name.textContent;
   const bar=document.createElement("span");bar.className="bar";const fill=document.createElement("i");fill.style.width=Math.min(100,(Number(row.hits)||0)/max*100)+"%";bar.append(fill);
   const count=document.createElement("span");count.className="count";count.textContent=number(row.hits);
   el.append(name,bar,count);parent.append(el);
 }
}
function days(n){const now=new Date(Date.now()+7*3600000).toISOString().slice(0,10);const from=new Date(Date.parse(now+"T00:00:00Z")-(n-1)*86400000).toISOString().slice(0,10);return{from,to:now}}
let busy=false;
async function load(){
 if(busy)return;busy=true;$("#refresh").disabled=true;$("#status").textContent="Đang cập nhật…";
 try{
   const dates=days(Number($("#range").value)||7);
   const r=await fetch("/api/traffic/report?"+new URLSearchParams(dates),{credentials:"same-origin",cache:"no-store"});
   const data=await r.json();
   if(!r.ok)throw new Error(data.error||("HTTP "+r.status));
   $("#total").textContent=number(data.total_page_views);
   $("#pagesCount").textContent=number((data.pages||[]).length);
   $("#actionsCount").textContent=number((data.events||[]).reduce((s,r)=>s+(Number(r.hits)||0),0));
   bars("#trend",data.trend,"day",90);bars("#channels",data.channels);bars("#pages",data.pages,"path",20);
   bars("#devices",data.devices,"device");bars("#countries",data.countries,"country");bars("#events",data.events,"event");
   const refresh=new Date(data.updated_at).toLocaleTimeString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit"});
   $("#status").textContent="Dữ liệu tổng hợp "+dates.from+" đến "+dates.to+" · Cập nhật lúc "+refresh+".";
 }catch(error){$("#status").textContent=error.message||"Chưa đọc được dữ liệu. Vui lòng tải lại."; }
 finally{busy=false;$("#refresh").disabled=false}
}
$("#range").addEventListener("change",load);$("#refresh").addEventListener("click",load);load();})();