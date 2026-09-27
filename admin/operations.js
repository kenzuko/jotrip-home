(function(){
"use strict";
const $=id=>document.getElementById(id);
const API="/api/cms/cano-ops",FORECAST="/api/cms/cano-forecast";
const escapeHtml=text=>String(text??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const dateText=day=>/^\d{4}-\d{2}-\d{2}$/.test(day||"")?day.slice(8,10)+"/"+day.slice(5,7)+"/"+day.slice(0,4):"";
const timeText=iso=>iso?new Date(iso).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit"}):"";
let today=null;
async function getJson(url,options={}){
 const r=await fetch(url,{credentials:"same-origin",cache:"no-store",...options});
 const data=await r.json().catch(()=>({error:"Máy chủ trả về dữ liệu không hợp lệ"}));
 if(!r.ok)throw Error(data.error||"HTTP "+r.status);
 return data;
}
function stateText(s){return s==="RUNNING"?"Hoạt động bình thường":s==="SUSPENDED"?"Tạm dừng":"Chưa có xác nhận hôm nay";}
function renderState(data){
 today=data.today;
 $("todayDate").textContent=dateText(today);
 const label=$("currentState"),state=data.state||"FIELD_REQUIRED";
 label.textContent=stateText(state);
 label.className="ops-state "+(state==="RUNNING"?"running":state==="SUSPENDED"?"stopped":"unknown");
 $("confirmedAt").textContent=data.confirmed_at_vn?"Xác nhận lúc "+timeText(data.confirmed_at_vn):"Chưa có xác nhận trực tiếp hôm nay.";
}
async function refreshStatus(){
 const data=await getJson(API);
 renderState(data);
 return data;
}
function result(id,message,type=""){$(id).textContent=message;$(id).className="result "+type;}
function submitting(busy){
 $("runningBtn").disabled=busy;
 $("stoppedBtn").disabled=busy;
}
async function submitStatus(state){
 submitting(true);
 result("opsResult","Đang ghi xác nhận vào nguồn vận hành…");
 try{
  const data=await getJson(API,{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({date:today,state,note:$("opsNote").value.trim()})});
  if(!data.ok||!data.synced)throw Error(data.error||"Chưa xác minh được dữ liệu website.");
  const verified=await refreshStatus();
  if(verified.state!==state)throw Error("Đã ghi nhưng lượt đọc lại chưa khớp. Hãy thử làm mới.");
  result("opsResult","Đã cập nhật "+stateText(state).toLowerCase()+" ngày "+dateText(today)+" và ghi vào lịch sử.","success");
  $("opsNote").value="";
 }catch(error){
  result("opsResult",error.message||"Chưa cập nhật được, hãy thử lại.","error");
  await refreshStatus().catch(()=>{});
 }finally{submitting(false);}
}
function renderNotes(data){
 const el=$("bulletinList");
 $("storageState").textContent=data.storage_ready?
  "Kho đính kèm riêng đã sẵn sàng. Chỉ tài khoản vận hành được xem file đã lưu.":
  "Chưa mở được kho đính kèm. Chỉ hiển thị các bản tóm tắt có sẵn.";
 if(!data.storage_ready)$("saveBulletin").disabled=true;
 const notes=Array.isArray(data.notes)?data.notes:[];
 if(!notes.length){el.innerHTML="<p>Chưa có bản tin nào trong hồ sơ.</p>";return;}
 el.innerHTML=notes.slice(0,30).map((x,i)=>{
  const title=dateText(x.local_date||"")+" · "+escapeHtml(x.issuer);
  let href="";
  if(x.origin==="CMS_PRIVATE_D1"&&x.attachment_name){
   href='<a href="'+FORECAST+"?attachment="+encodeURIComponent(x.id)+'" target="_blank" rel="noopener">Mở file đính kèm</a>';
  }else if(x.origin==="PUBLIC_METADATA"&&/^https:\/\/github\.com\/kenzuko\/Jotrip-Lab\//.test(x.source_url||"")){
   href='<a href="'+escapeHtml(x.source_url)+'" target="_blank" rel="noopener">Xem bản ghi</a>';
  }
  return '<details'+(i===0?' open':'')+'><summary><strong>'+title+'</strong><span>'+escapeHtml(x.source_reference||"")+'</span></summary>'+
   '<div class="bulletin-body"><p>'+escapeHtml(x.summary||"")+'</p>'+
   '<p><b>Khu vực:</b> '+escapeHtml(x.area||"")+'</p>'+
   (x.attachment_name?'<p><b>File nội bộ:</b> '+escapeHtml(x.attachment_name)+'</p>':'')+
   href+'</div></details>';
 }).join("");
}
async function refreshNotes(){
 try{const data=await getJson(FORECAST);renderNotes(data);}
 catch(e){result("bulletinResult","Chưa tải được nhật ký bản tin: "+e.message,"error");}
}
async function boot(){
 try{
  const session=await getJson("/api/cms/session");
  if(!["admin","operator"].includes(session.role)){
   $("gate").textContent="Tài khoản hiện tại không có quyền vận hành cano.";
   return;
  }
  $("gate").hidden=true;
  $("workspace").hidden=false;
  await Promise.allSettled([refreshStatus(),refreshNotes()]);
  if(!today)result("opsResult","Không tải được ngày vận hành. Tạm khóa thao tác để tránh ghi sai ngày.","error");
 }catch(e){
  $("gate").innerHTML='Phiên CMS chưa sẵn sàng. <a href="/api/cms/auth?action=login">Đăng nhập lại tại CMS →</a>';
 }
}
$("runningBtn").addEventListener("click",()=>submitStatus("RUNNING"));
$("stoppedBtn").addEventListener("click",()=>submitStatus("SUSPENDED"));
async function evidenceForm(form){
 const body=new FormData(form),file=body.get("attachment");
 if(!file||typeof file.size!=="number"||!file.size)return body;
 if(file.size<=1500000)return body;
 if(!String(file.type||"").startsWith("image/"))throw Error("PDF cần nhỏ hơn 1,5 MB.");
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw Error("Định dạng ảnh không được hỗ trợ.");
 const bitmap=await createImageBitmap(file);
 try{
  const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
  canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Không xử lý được ảnh.");
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.78,.66,.54]){
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
   if(blob&&blob.size<=1500000){
    body.set("attachment",new File([blob],file.name.replace(/\.[^.]+$/,"")+".jpg",{type:"image/jpeg"}));
    return body;
   }
  }
  throw Error("Ảnh vẫn còn lớn hơn 1,5 MB. Cậu chọn bản ảnh nhỏ hơn nhé.");
 }finally{bitmap.close?.();}
}

$("bulletinForm").addEventListener("submit",async event=>{
 event.preventDefault();
 const btn=$("saveBulletin");
 btn.disabled=true;result("bulletinResult","Đang lưu bản tin và file bằng chứng…");
 try{
  const formData=await evidenceForm(event.currentTarget);
  const data=await getJson(FORECAST,{method:"POST",body:formData});
  if(!data.ok||!data.archived)throw Error("Chưa xác minh được bản tin đã lưu.");
  result("bulletinResult","Đã lưu bản tin ngày "+dateText(data.date)+(data.has_attachment?" cùng file gốc.":"."),"success");
  event.currentTarget.reset();
  await refreshNotes();
 }catch(e){result("bulletinResult",e.message||"Không lưu được bản tin.","error");}
 finally{if(!$("storageState").textContent.includes("Chưa mở"))btn.disabled=false;}
});
boot();
})();
