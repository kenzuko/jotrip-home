const $=s=>document.querySelector(s);
const API={session:"/api/cms/session",auth:"/api/cms/auth",content:"/api/cms/content",publish:"/api/cms/publish"};
let session=null,schema=null,currentModule=null,currentData=null,currentSha=null,dirty=false;

function show(id){["boot","remoteGate","login","cms"].forEach(x=>$("#"+x)?.classList.toggle("hidden",x!==id))}
function status(msg,type=""){const el=$("#status");if(!el)return;el.textContent=msg;el.className="status-bar"+(type?" "+type:"")}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function labelize(k){return String(k).replace(/_/g," ").replace(/w/g,c=>c.toUpperCase())}
function pathParts(p){return p.split(".").map(x=>/^d+$/.test(x)?Number(x):x)}
function setAtPath(obj,path,val){const parts=pathParts(path);let cur=obj;for(let i=0;i<parts.length-1;i++)cur=cur[parts[i]];cur[parts.at(-1)]=val}
function getAtPath(obj,path){return pathParts(path).reduce((a,k)=>a?.[k],obj)}
function stringField(key,val,path){
 const long=String(val??"").length>76||/(body|summary|description|intro|dek|lead|note|text|content)/i.test(key);
 return `<div class="field"><label>${esc(labelize(key))}</label>${long?`<textarea data-path="${esc(path)}">${esc(val)}</textarea>`:`<input data-path="${esc(path)}" value="${esc(val)}">`}</div>`;
}
function primitiveField(key,val,path){
 if(typeof val==="boolean")return `<div class="field"><label>${esc(labelize(key))}</label><select data-path="${esc(path)}" data-type="boolean"><option value="true" ${val?"selected":""}>Bật / true</option><option value="false" ${!val?"selected":""}>Tắt / false</option></select></div>`;
 if(typeof val==="number")return `<div class="field"><label>${esc(labelize(key))}</label><input type="number" step="any" data-path="${esc(path)}" data-type="number" value="${val}"></div>`;
 if(key==="role")return `<div class="field"><label>Vai trò</label><select data-path="${esc(path)}"><option ${val==="admin"?"selected":""}>admin</option><option ${val==="editor"?"selected":""}>editor</option><option ${val==="operator"?"selected":""}>operator</option><option ${val==="viewer"?"selected":""}>viewer</option></select></div>`;
 return stringField(key,val??"",path);
}
function renderNode(value,path="",label="Nội dung",depth=0){
 if(value===null||typeof value!=="object")return primitiveField(label,value,path);
 if(Array.isArray(value)){
   return `<fieldset class="field-group"><legend>${esc(labelize(label))} · ${value.length}</legend>${value.map((v,i)=>`<div class="array-card"><div class="array-title">#${i+1}</div>${(v&&typeof v==="object")?renderChildren(v,path?path+"."+i:String(i),depth+1):primitiveField(String(i),v,path?path+"."+i:String(i))}</div>`).join("")}</fieldset>`;
 }
 return `<fieldset class="field-group"><legend>${esc(labelize(label))}</legend>${renderChildren(value,path,depth+1)}</fieldset>`;
}
function renderChildren(obj,path,depth){
 return Object.entries(obj).map(([k,v])=>{
   const p=path?path+"."+k:k;
   if(v&&typeof v==="object")return renderNode(v,p,k,depth);
   return primitiveField(k,v,p);
 }).join("");
}
function renderUsers(){
 const users=currentData.users||[];
 $("#editor").innerHTML='<div class="user-admin-head"><div><strong>Người dùng CMS</strong><p>Thêm GitHub username rồi chọn vai trò. Chỉ admin mới thấy module này.</p></div><button type="button" id="addUserBtn">+ Thêm người dùng</button></div><div class="user-cards">'+users.map((u,i)=>'<article class="user-card"><div class="field"><label>GitHub username</label><input data-path="users.'+i+'.login" value="'+esc(u.login||"")+'"></div><div class="field"><label>Tên hiển thị</label><input data-path="users.'+i+'.name" value="'+esc(u.name||"")+'"></div><div class="field"><label>Vai trò</label><select data-path="users.'+i+'.role"><option '+(u.role==="admin"?"selected":"")+'>admin</option><option '+(u.role==="editor"?"selected":"")+'>editor</option><option '+(u.role==="operator"?"selected":"")+'>operator</option><option '+(u.role==="viewer"?"selected":"")+'>viewer</option></select></div><div class="field"><label>Trạng thái</label><select data-path="users.'+i+'.enabled" data-type="boolean"><option value="true" '+(u.enabled!==false?"selected":"")+'>Đang hoạt động</option><option value="false" '+(u.enabled===false?"selected":"")+'>Tạm khóa</option></select></div>'+(u.login==="kenzuko"?'':'<button type="button" class="remove-user" data-user="'+i+'">Xóa</button>')+'</article>').join("")+'</div>';
 $("#addUserBtn").onclick=()=>{currentData.users=currentData.users||[];currentData.users.push({login:"",name:"",role:"viewer",enabled:true});dirty=true;renderUsers();bindFields();$("#saveBtn").disabled=false;status("Đã thêm người dùng mới - nhập GitHub username rồi xuất bản.")};
 document.querySelectorAll(".remove-user").forEach(b=>b.onclick=()=>{currentData.users.splice(Number(b.dataset.user),1);dirty=true;renderUsers();bindFields();$("#saveBtn").disabled=false;status("Đã xóa khỏi danh sách - cần xuất bản để áp dụng.")});
}
function bindFields(){
 document.querySelectorAll("[data-path]").forEach(el=>{
   el.addEventListener("input",()=>{
     let v=el.value;
     if(el.dataset.type==="number")v=Number(v);
     if(el.dataset.type==="boolean")v=v==="true";
     setAtPath(currentData,el.dataset.path,v);
     dirty=true;$("#saveBtn").disabled=false;status("Có thay đổi chưa xuất bản.");
   });
 });
}
async function api(url,opts={}){
 const r=await fetch(url,{credentials:"include",...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})}});
 let b=null;try{b=await r.json()}catch(e){}
 if(!r.ok){const err=new Error(b?.error||("HTTP "+r.status));err.status=r.status;throw err}
 return b;
}
async function boot(){
 show("boot");
 let r;
 try{r=await fetch(API.session,{credentials:"include",cache:"no-store"})}catch(e){show("remoteGate");return}
 if(r.status===404){show("remoteGate");return}
 if(r.status===401){show("login");return}
 if(r.status===503){show("login");$("#setupHint").classList.remove("hidden");return}
 if(!r.ok){show("login");return}
 session=await r.json();
 const sr=await fetch("../cms/schema.json?t="+Date.now(),{cache:"no-store"});schema=await sr.json();
 $("#userName").textContent=session.name||session.login;$("#userRole").textContent=session.role;
 renderNav();show("cms");
 const first=schema.modules.find(m=>m.read.includes(session.role));if(first)selectModule(first.id);
}
function renderNav(){
 $("#moduleNav").innerHTML=schema.modules.filter(m=>m.read.includes(session.role)).map(m=>`<button class="module-btn" data-id="${m.id}"><strong>${esc(m.label)}</strong><small>${esc(m.description)}</small></button>`).join("");
 document.querySelectorAll(".module-btn").forEach(b=>b.onclick=()=>selectModule(b.dataset.id));
}
async function selectModule(id){
 currentModule=schema.modules.find(m=>m.id===id);if(!currentModule)return;
 document.querySelectorAll(".module-btn").forEach(b=>b.classList.toggle("active",b.dataset.id===id));
 $("#moduleKicker").textContent="OPEN PHU QUOC CMS";$("#moduleTitle").textContent=currentModule.label;$("#moduleDesc").textContent=currentModule.description;
 if(currentModule.preview){$("#previewBtn").href=currentModule.preview;$("#previewBtn").classList.remove("hidden")}else $("#previewBtn").classList.add("hidden");
 status("Đang tải "+currentModule.label+"...");
 try{
   const b=await api(API.content+"?path="+encodeURIComponent(currentModule.path));
   currentData=b.content;currentSha=b.sha;dirty=false;
   if(currentModule.id==="users")renderUsers();else $("#editor").innerHTML=renderNode(currentData,"",currentModule.label);
   bindFields();
   const writable=currentModule.write.includes(session.role);$("#saveBtn").disabled=!writable;$("#editor").classList.toggle("readonly",!writable);
   document.querySelectorAll("#editor input,#editor textarea,#editor select").forEach(el=>el.disabled=!writable);
   status(writable?"Sẵn sàng chỉnh sửa.":"Vai trò của bạn chỉ được xem module này.");
 }catch(e){status(e.message,"error")}
}
async function save(){
 if(!currentModule||!dirty)return;
 $("#saveBtn").disabled=true;status("Đang xuất bản...");
 try{
   const b=await api(API.publish,{method:"POST",body:JSON.stringify({path:currentModule.path,sha:currentSha,content:currentData,message:"cms: update "+currentModule.label.toLowerCase()})});
   currentSha=b.sha||currentSha;dirty=false;status("Đã xuất bản. GitHub Pages sẽ cập nhật sau khi deploy hoàn tất.","success");
 }catch(e){status(e.message,"error");$("#saveBtn").disabled=false}
}
$("#saveBtn").onclick=e=>{e.preventDefault();save()};
$("#logoutBtn").onclick=async()=>{await fetch(API.auth+"?action=logout",{method:"POST",credentials:"include"});location.reload()};
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
boot();