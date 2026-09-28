/* Authorized, same-origin Vietnamese food-article text editor. No direct publication. */
(function(root){"use strict";
const SOURCE="data/i18n/vi/food.json";
const $=q=>document.querySelector(q);
const copy=v=>JSON.parse(JSON.stringify(v));
const find=(data,id)=>data?.dishes?.find(x=>x.id===id);
const roleOK=role=>role==="admin"||role==="editor";
const draftKey=(login,id,sha)=>"openpq-cms-food-inline:v1:"+encodeURIComponent(login)+":"+encodeURIComponent(id)+":"+sha;
const fieldLabel={
  name:"Tên món",intro:"Lời mở",origin:"Nguồn gốc",why_name:"Chuyện tên gọi",
  how_to_eat:"Cách ăn",allergy_note:"Lưu ý dị ứng",ingredients:"Nguyên liệu",
  tips:"Lưu ý thực tế",ask_staff:"Câu hỏi dành cho quán"
};
function goodField(record,path){
  if(!record||typeof record!=="object")return false;
  if(["name","intro","origin","why_name","how_to_eat","allergy_note"].includes(path))
    return Object.hasOwn(record,path)&&typeof record[path]==="string";
  const match=/^(ingredients|tips|ask_staff)\.(0|[1-9]\d*)$/.exec(path);
  return Boolean(match&&Array.isArray(record[match[1]])&&
    Number(match[2])<record[match[1]].length&&
    typeof record[match[1]][Number(match[2])]==="string");
}
function read(record,path){
  if(!goodField(record,path))return "";
  const chunks=path.split(".");
  return chunks.length===1?record[path]:record[chunks[0]][Number(chunks[1])];
}
function write(record,path,value){
  if(!goodField(record,path))return false;
  const chunks=path.split(".");
  if(chunks.length===1)record[path]=String(value);
  else record[chunks[0]][Number(chunks[1])]=String(value);
  return true;
}
const state={id:"",login:"",role:"",sha:"",base:null,current:null,raw:null,tab:"",
  editing:false,dirty:false,blocked:false,timer:null,panel:null};
async function get(url,init={}){
  const res=await fetch(url,{cache:"no-store",credentials:"same-origin",...init});
  const value=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(value.error||"HTTP "+res.status);
  return value;
}
function status(message,kind=""){
  const target=$("#foodInlineStatus");
  if(target){target.textContent=message;target.dataset.kind=kind;}
  const notice=$("#foodInlineNotice");
  if(notice){notice.textContent=state.editing?"":message;notice.dataset.kind=kind;}
}
function download(value){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="nhap-mon-"+state.id+".json";
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function backup(){
  if(state.current)download({id:state.id,baseSha:state.sha,content:state.current});
}
function setBlocked(message){
  state.blocked=true;clearTimeout(state.timer);state.timer=null;
  status(message+" Hãy tải bản sao trước khi thoát.","warn");
  $("#foodInlineSave").disabled=true;$("#foodInlineSubmit").disabled=true;
  const direct=$("#foodInlineDirect");if(direct)direct.disabled=true;
}
function save(){
  if(!state.editing||state.blocked)return false;
  const key=draftKey(state.login,state.id,state.sha);
  try{
    if(localStorage.getItem(key)!==state.raw){
      setBlocked("Tab khác vừa thay đổi bản nháp.");return false;
    }
    const fresh=JSON.stringify({
      version:1,id:state.id,login:state.login,baseSha:state.sha,
      data:state.current,at:Date.now(),tab:state.tab
    });
    localStorage.setItem(key,fresh);
    if(localStorage.getItem(key)!==fresh)throw Error("Không xác minh được bản lưu");
    state.raw=fresh;status("Đã lưu nháp trên trình duyệt. Khách vẫn đọc bản cũ.","good");
    return true;
  }catch(error){
    setBlocked("Không lưu được nháp: "+String(error.message||error)+".");return false;
  }
}
function schedule(){
  clearTimeout(state.timer);state.timer=null;
  status("Đang lưu nháp...");
  state.timer=setTimeout(()=>{state.timer=null;save();},500);
}
function closePanel(){
  state.panel?.remove();state.panel=null;
  document.querySelectorAll(".food-inline-trigger.active").forEach(x=>x.classList.remove("active"));
}
function editField(element,button,path){
  if(!state.editing||state.blocked)return;
  const item=find(state.current,state.id);
  if(!goodField(item,path))return;
  closePanel();button.classList.add("active");
  const panel=document.createElement("div");panel.className="food-inline-panel";
  const label=document.createElement("label");
  label.textContent=fieldLabel[path.split(".")[0]]||"Sửa nội dung";
  const input=document.createElement("textarea");
  input.rows=path==="intro"||path==="origin"||path==="why_name"||path==="how_to_eat"?6:3;
  input.value=read(item,path);
  label.appendChild(input);
  const hint=document.createElement("small");
  hint.textContent="Chữ đổi ngay trong bài. Nội dung chỉ công khai sau khi đề xuất được duyệt.";
  const done=document.createElement("button");done.type="button";
  done.textContent="Đọc tiếp";done.onclick=closePanel;
  panel.append(label,hint,done);
  button.insertAdjacentElement("afterend",panel);state.panel=panel;
  input.addEventListener("input",()=>{
    if(!write(item,path,input.value))return;
    element.textContent=input.value;
    if(path==="name")document.title=input.value+" - Open Phu Quoc";
    state.dirty=true;
    $("#foodInlineSubmit").disabled=false;
    if(state.role==="admin")$("#foodInlineDirect").disabled=false;
    schedule();
  });
  input.focus({preventScroll:true});panel.scrollIntoView({block:"center",behavior:"smooth"});
}
function showFields(){
  const item=find(state.current,state.id);
  document.querySelectorAll("#foodArticle [data-food-path]").forEach(element=>{
    const path=element.dataset.foodPath;
    if(!goodField(item,path))return;
    const b=document.createElement("button");
    b.className="food-inline-trigger";b.type="button";
    b.textContent="✎ Sửa chữ";b.setAttribute("aria-label","Sửa "+(fieldLabel[path.split(".")[0]]||"nội dung"));
    b.onclick=()=>editField(element,b,path);
    element.insertAdjacentElement("afterend",b);
  });
}
function reflectCurrent(){
  const item=find(state.current,state.id);
  document.querySelectorAll("#foodArticle [data-food-path]").forEach(element=>{
    const path=element.dataset.foodPath;
    if(goodField(item,path))element.textContent=read(item,path);
  });
  document.title=item.name+" - Open Phu Quoc";
}
function mode(active){
  state.editing=active;
  document.body.classList.toggle("food-inline-editing",active);
  $("#foodInlineLauncher").hidden=active;
  $("#foodInlineToolbar").hidden=!active;
}
function readAgain(){
  if(state.timer){clearTimeout(state.timer);state.timer=null;if(!save())return;}
  closePanel();document.querySelectorAll(".food-inline-trigger").forEach(el=>el.remove());
  mode(false);
  if(state.dirty)status("Đang xem bản vừa sửa trên máy này, chưa phải bản công khai.","good");
}
async function begin(){
  if(state.editing)return;
  try{
    const session=await get("/api/cms/session");
    if(!roleOK(session.role))throw Error("Tài khoản không được biên tập");
    state.login=session.login;state.role=session.role;
    const [publicData,git]=await Promise.all([
      get("/data/i18n/vi/food.json?inline="+Date.now()),
      get("/api/cms/content?path="+encodeURIComponent(SOURCE))
    ]);
    const live=find(publicData,state.id),upstream=find(git.content,state.id);
    if(!live||!upstream||JSON.stringify(live)!==JSON.stringify(upstream))
      throw Error("Bản trên website chưa khớp GitHub. Hãy tải lại sau khi CMS cập nhật.");
    state.sha=git.sha;state.base=copy(git.content);state.current=copy(git.content);
    state.tab=crypto.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2);
    const old=localStorage.getItem(draftKey(state.login,state.id,state.sha));
    if(old){
      let saved;
      try{saved=JSON.parse(old);}catch{throw Error("Bản nháp cũ không đọc được. Hãy kiểm tra trên thiết bị.");}
      if(saved.version!==1||saved.id!==state.id||saved.baseSha!==state.sha||
         saved.login!==state.login||!saved.data||!find(saved.data,state.id))
        throw Error("Bản nháp không đúng bài hoặc phiên bản. Không ghi đè.");
      if(!confirm("Bài này có bản nháp trên máy. Khôi phục để sửa tiếp?"))return;
      state.current=copy(saved.data);state.dirty=true;
    }else state.dirty=false;
    state.raw=old;state.blocked=false;
    if(old)reflectCurrent();
    mode(true);showFields();
    $("#foodInlineSave").disabled=false;
    $("#foodInlineSubmit").disabled=!state.dirty;
    $("#foodInlineDirect").hidden=state.role!=="admin";
    $("#foodInlineDirect").disabled=!state.dirty;
    status(old?"Đã khôi phục bản nháp. Chọn phần muốn sửa.":"Chọn cây viết cạnh đoạn muốn chỉnh.");
  }catch(error){status(String(error.message||error),"warn");}
}
function foodChanges(){
  const before=find(state.base,state.id),after=find(state.current,state.id);
  if(!before||!after)throw Error("Không tìm thấy bài gốc");
  const fields=["name","intro","origin","why_name","how_to_eat","allergy_note"];
  for(const key of ["ingredients","tips","ask_staff"]){
    if(!Array.isArray(before[key])||before[key].length!==after[key]?.length)
      throw Error("Cấu trúc món ăn đã đổi, phải đối chiếu trong CMS.");
    for(let i=0;i<before[key].length;i++)fields.push(key+"."+i);
  }
  return fields.filter(key=>goodField(before,key)).map(field=>{
    const a=read(before,field),b=read(after,field);
    return a===b?null:{field,before:a,after:b};
  }).filter(Boolean);
}
async function directSave(){
  if(!state.editing||state.blocked||!state.dirty||state.role!=="admin")return;
  clearTimeout(state.timer);state.timer=null;if(!save())return;
  const button=$("#foodInlineDirect");button.disabled=true;
  try{
    const changes=foodChanges();
    if(!changes.length){status("Chưa sửa chữ nào.");return;}
    if(!confirm("Lưu thẳng "+changes.length+" phần chữ, không cần duyệt? GitHub sẽ lưu lịch sử."))return;
    status("Đang kiểm tra và ghi lên GitHub...");
    const result=await get("/api/cms/direct-save",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({path:SOURCE,record_id:state.id,sha:state.sha,changes})
    });
    if(!/^[a-f0-9]{40}$/.test(result.commit||""))
      throw Error("Chưa xác minh được commit. Hãy giữ nháp để kiểm tra.");
    const key=draftKey(state.login,state.id,state.sha);
    if(localStorage.getItem(key)===state.raw)localStorage.removeItem(key);
    state.dirty=false;readAgain();
    status("Đã lưu lên GitHub, chờ CMS phát hành bản mới.","good");
    const el=$("#foodInlineResult")||document.createElement("p");
    el.id="foodInlineResult";
    el.replaceChildren(document.createTextNode("Đã lưu thẳng, không cần duyệt. "));
    const a=document.createElement("a");
    a.href="https://github.com/kenzuko/jotrip-home/commit/"+result.commit;
    a.textContent="Xem lịch sử ↗";a.target="_blank";a.rel="noopener noreferrer";
    el.append(a);$("#foodInlineLauncher").insertAdjacentElement("afterend",el);
  }catch(error){status(String(error.message||error)+". Nháp còn trên máy.","warn");}
  finally{if(state.dirty&&!state.blocked)button.disabled=false;}
}
async function submit(){
  if(!state.editing||!state.dirty||state.blocked)return;
  clearTimeout(state.timer);state.timer=null;
  if(!save())return;
  const button=$("#foodInlineSubmit");button.disabled=true;
  status("Đang kiểm tra phiên bản và các đề xuất khác...");
  try{
    const [session,check]=await Promise.all([
      get("/api/cms/session"),
      get("/api/cms/edit-state?path="+encodeURIComponent(SOURCE))
    ]);
    if(!roleOK(session.role)||session.login!==state.login)
      throw Error("Phiên đăng nhập hoặc quyền biên tập đã thay đổi");
    if(check.complete!==true||check.sha!==state.sha||(check.conflicts||[]).length)
      throw Error("Có đề xuất trùng tệp hoặc phiên bản mới. Nháp vẫn còn trên máy.");
    if(!confirm("Gửi bản sửa chữ này thành PR để duyệt? Khách chưa nhìn thấy thay đổi."))return;
    const result=await get("/api/cms/publish",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({path:SOURCE,sha:state.sha,content:state.current,
        message:"sửa chữ món "+state.id})
    });
    const link=String(result?.pull_request?.url||"");
    if(!/^https:\/\/github\.com\/kenzuko\/jotrip-home\/pull\/\d+$/.test(link))
      throw Error("Chưa xác minh được PR. Mở hàng đợi CMS để đối chiếu trước khi gửi lại.");
    const key=draftKey(state.login,state.id,state.sha);
    if(localStorage.getItem(key)===state.raw)localStorage.removeItem(key);
    state.dirty=false;readAgain();
    const el=$("#foodInlineResult")||document.createElement("p");
    el.id="foodInlineResult";el.replaceChildren(document.createTextNode("Đã gửi đề xuất, chưa công khai. "));
    const a=document.createElement("a");a.href=link;a.textContent="Mở PR ↗";
    a.target="_blank";a.rel="noopener noreferrer";el.appendChild(a);
    $("#foodInlineLauncher").insertAdjacentElement("afterend",el);
    status("Đã tạo đề xuất, chưa công khai.","good");
  }catch(error){status(String(error.message||error),"warn");}
  finally{if(state.dirty&&!state.blocked)button.disabled=false;}
}
function toolbar(){
  const launch=document.createElement("button");launch.id="foodInlineLauncher";
  launch.className="food-inline-launcher";launch.type="button";
  launch.textContent="✎ Chỉnh sửa bài này";launch.onclick=begin;
  const actions=$(".module-actions");
  if(!actions)return;
  actions.prepend(launch);
  const bar=document.createElement("aside");bar.id="foodInlineToolbar";
  bar.className="food-inline-toolbar";bar.hidden=true;
  bar.setAttribute("aria-label","Sửa chữ ngay khi đọc");
  bar.innerHTML='<strong>CHỈNH CHỮ NGAY TRÊN BÀI <small>Nháp riêng, chưa công khai</small></strong>'+
    '<div class="food-inline-actions">'+
    '<button type="button" id="foodInlineSave">Lưu nháp</button>'+
    '<button type="button" id="foodInlineBackup">Tải bản sao</button>'+
    '<button type="button" id="foodInlineRead">Đọc lại</button>'+
    '<button type="button" id="foodInlineSubmit">Gửi duyệt</button>'+
    '<button type="button" id="foodInlineDirect" hidden>Lưu thẳng (Admin)</button></div>'+
    '<p id="foodInlineStatus" role="status" aria-live="polite"></p>';
  const notice=document.createElement("p");
  notice.id="foodInlineNotice";notice.className="food-inline-notice";
  notice.setAttribute("role","status");
  $(".food-article-main")?.prepend(bar,notice);
  $("#foodInlineSave").onclick=save;
  $("#foodInlineBackup").onclick=backup;
  $("#foodInlineRead").onclick=readAgain;
  $("#foodInlineSubmit").onclick=submit;
  $("#foodInlineDirect").onclick=directSave;
}
async function mount(){
  if(!["cms.openphuquoc.com","localhost","127.0.0.1"].includes(location.hostname))return;
  const requested=new URLSearchParams(location.search).get("id");
  const host=$("#foodArticle"),id=host?.dataset.foodId||"";
  if(!requested||!id||!host.querySelector("h1")||$("#foodInlineLauncher"))return;
  if((requested==="chao-ca"?"chao-cha":requested)!==id)return;
  if((document.documentElement.lang||"vi").split("-")[0]!=="vi")return;
  state.id=id;
  try{
    const session=await get("/api/cms/session");
    if(roleOK(session.role)){state.login=session.login;state.role=session.role;toolbar();}
  }catch{/* Public visitors never see editing controls. */}
}
function observe(){
  const host=$("#foodArticle");if(!host)return;
  if(host.dataset.foodId&&host.querySelector("h1")){mount();return;}
  const observer=new MutationObserver(()=>{
    if(host.dataset.foodId&&host.querySelector("h1")){observer.disconnect();mount();}
  });
  observer.observe(host,{subtree:true,childList:true,attributes:true,attributeFilter:["data-food-id"]});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe);
else observe();
window.addEventListener("storage",event=>{
  if(state.editing&&event.key===draftKey(state.login,state.id,state.sha)&&event.newValue!==state.raw)
    setBlocked("Tab khác đã thay đổi nháp.");
});
window.addEventListener("beforeunload",()=>{
  if(state.timer){clearTimeout(state.timer);state.timer=null;save();}
});
root.OPQInlineFoodTest={roleOK,goodField,read,write,draftKey};
})(window);
