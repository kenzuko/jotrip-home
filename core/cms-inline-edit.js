/* Inline CMS editing on cms.openphuquoc.com. Public readers see no controls. */
(function(root){"use strict";
const $=q=>document.querySelector(q),SOURCE="data/content.json";
const S={id:"",login:"",role:"",sha:"",base:null,current:null,raw:null,tab:"",
  editing:false,dirty:false,blocked:false,timer:null,panel:null,targets:[]};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));
const story=(data,id)=>data?.stories?.find(s=>s.id===id);
const roleOK=role=>role==="admin"||role==="editor";
const draftKey=login=>"openpq-cms-draft:"+login+":stories";
const recordKey=(login,id,sha)=>"openpq-cms-article-v1:"+encodeURIComponent(login)+":"+encodeURIComponent(id)+":"+sha;
const goodField=(record,path)=>["title","dek","intro"].includes(path)||
  /^sections\.\d+\.(heading|body)$/.test(path)&&Number(path.split(".")[1])<record.sections.length;
const read=(record,path)=>path.split(".").reduce((v,k)=>v?.[k],record)??"";
function write(record,path,value){
  if(!goodField(record,path))return false;
  const parts=path.split(".");
  if(parts.length===1)record[path]=String(value);
  else record.sections[Number(parts[1])][parts[2]]=String(value);
  return true;
}
const paras=text=>String(text||"").trim().split(/\n{2,}/).filter(Boolean)
  .map(s=>"<p>"+esc(s).replace(/\n/g,"<br>")+"</p>").join("");
async function get(path,opts={}){
  const r=await fetch(path,{credentials:"same-origin",cache:"no-store",...opts});
  const x=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(x.error||"HTTP "+r.status);
  return x;
}
function note(message,kind=""){
  const el=$("#inlineCmsStatus");if(el){el.textContent=message;el.dataset.kind=kind;}
}
function blocked(message){
  S.blocked=true;clearTimeout(S.timer);note(message,"warn");
  $("#inlineCmsSave").disabled=true;$("#inlineCmsSubmit").disabled=true;
  const direct=$("#inlineCmsDirect");if(direct)direct.disabled=true;
}
function backup(){
  if(!S.current)return;
  const blob=new Blob([JSON.stringify({story:S.id,sha:S.sha,content:S.current},null,2)],
    {type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;
  a.download="nhap-bai-"+S.id+".json";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function save(){
  if(!S.editing||S.blocked)return false;
  try{
    const key=draftKey(S.login);
    if(localStorage.getItem(key)!==S.raw){
      blocked("Tab khác vừa sửa bản nháp. Tải JSON để đối chiếu trong Admin, không ghi đè.");return false;
    }
    const changed=story(S.current,S.id),initial=story(S.base,S.id);
    const checkpointKey=recordKey(S.login,S.id,S.sha);
    const prior=JSON.parse(localStorage.getItem(checkpointKey)||"null");
    if(prior&&prior.tab!==S.tab&&JSON.stringify(prior.record)!==JSON.stringify(changed)){
      blocked("Bài đang có bản lưu riêng trong tab khác. Tải JSON để giữ nội dung này.");return false;
    }
    const raw=JSON.stringify({sha:S.sha,data:S.current,at:Date.now(),tab:S.tab,source:"inline-article",storyId:S.id});
    localStorage.setItem(key,raw);
    if(localStorage.getItem(key)!==raw)throw Error("Không xác minh được dữ liệu vừa lưu");
    S.raw=raw;
    localStorage.setItem(checkpointKey,JSON.stringify({version:1,account:S.login,module:"stories",
      baseSha:S.sha,id:S.id,baseRecord:initial,record:changed,at:Date.now(),tab:S.tab}));
    note("Đã lưu nháp trên máy này. Bài công khai chưa thay đổi.","good");return true;
  }catch(e){blocked("Không lưu được nháp: "+e.message+". Hãy tải JSON trước khi thoát.");return false;}
}
function schedule(){clearTimeout(S.timer);note("Đang lưu nháp...");
  S.timer=setTimeout(()=>{S.timer=null;save();},450);}
function sectionsInPage(){
  return [...document.querySelectorAll("#articleRoot .article-body > .article-section, #articleRoot .article-body > .article-note")];
}
function targets(){
  const list=[
    {key:"title",el:$("#articleRoot .article-head-copy h1")},
    {key:"dek",el:$("#articleRoot .article-head-copy .dek")},
    {key:"intro",el:$("#articleRoot .article-body > .intro")}
  ];
  sectionsInPage().forEach((el,i)=>{
    const heading=el.querySelector(":scope > h2");
    const body=el.querySelector(":scope > .section-text, :scope > .note-text");
    if(heading)list.push({key:"sections."+i+".heading",el:heading});
    if(body)list.push({key:"sections."+i+".body",el:body});
  });
  return list.filter(x=>x.el);
}
function reflect(el,key,value){
  if(key.endsWith(".body"))el.innerHTML=paras(value);
  else el.textContent=value;
}
function closePanel(){S.panel?.remove();S.panel=null;
  document.querySelectorAll(".inline-edit-trigger.active").forEach(b=>b.classList.remove("active"));}
function editPart(key,element,button){
  if(!S.editing||S.blocked)return;
  const item=story(S.current,S.id);
  if(!goodField(item,key))return;
  closePanel();button.classList.add("active");
  const panel=document.createElement("div");panel.className="inline-edit-panel";
  const label=document.createElement("label");label.textContent=key.endsWith(".body")?"Sửa nội dung đoạn":
    key.endsWith(".heading")?"Sửa tiêu đề đoạn":key==="intro"?"Sửa lời mở":"Sửa "+(key==="dek"?"mô tả": "tiêu đề");
  const input=document.createElement("textarea");input.rows=key.endsWith(".body")?7:4;
  input.setAttribute("aria-label",label.textContent);input.value=String(read(item,key));
  const help=document.createElement("p");help.textContent="Chữ thay đổi ngay phía trên. Khách vẫn đọc bản cũ cho đến khi PR được duyệt.";
  const done=document.createElement("button");done.type="button";done.textContent="Đọc tiếp";done.onclick=closePanel;
  label.appendChild(input);panel.append(label,help,done);
  button.insertAdjacentElement("afterend",panel);S.panel=panel;
  input.addEventListener("input",()=>{
    if(!write(item,key,input.value))return;
    S.dirty=true;reflect(element,key,input.value);schedule();
    $("#inlineCmsSubmit").disabled=false;
    if(S.role==="admin")$("#inlineCmsDirect").disabled=false;
  });
  input.focus({preventScroll:true});panel.scrollIntoView({block:"center",behavior:"smooth"});
}
function showButtons(){
  S.targets=targets();
  const item=story(S.current,S.id);
  S.targets.forEach(({key,el})=>{
    if(!goodField(item,key))return;
    const b=document.createElement("button");b.type="button";b.className="inline-edit-trigger";
    b.textContent=key.endsWith(".body")?"✎ Sửa đoạn này":"✎ Sửa phần này";
    b.onclick=()=>editPart(key,el,b);el.insertAdjacentElement("afterend",b);
  });
}
function mode(on){
  S.editing=on;document.body.classList.toggle("opq-inline-editing",on);
  $("#inlineCmsOpen").hidden=on;$("#inlineCmsActions").hidden=!on;
}
function stop(){
  if(S.timer){clearTimeout(S.timer);S.timer=null;save();}
  closePanel();document.querySelectorAll(".inline-edit-trigger").forEach(el=>el.remove());
  mode(false);
  if(S.dirty)note("Đang đọc bản đã sửa trên thiết bị, chưa phải bản công khai.","good");
}
async function begin(){
  if(S.editing)return;note("Đang kiểm tra phiên bản GitHub...");
  try{
    const auth=await get("/api/cms/session");
    if(!roleOK(auth.role))throw Error("Tài khoản không có quyền sửa bài");
    S.login=auth.login;S.role=auth.role;
    const [live,upstream]=await Promise.all([
      get("/data/content.json?inline="+Date.now()),
      get("/api/cms/content?path="+encodeURIComponent(SOURCE))
    ]);
    const currentStory=story(live,S.id),remoteStory=story(upstream.content,S.id);
    if(!currentStory||!remoteStory||JSON.stringify(currentStory)!==JSON.stringify(remoteStory))
      throw Error("Bài đang đọc khác phiên bản GitHub hiện tại. Tải lại CMS trước khi sửa.");
    S.sha=upstream.sha;S.base=clone(upstream.content);S.current=clone(upstream.content);
    S.tab=crypto.randomUUID?.()||String(Date.now())+"-"+Math.random().toString(36).slice(2);
    const raw=localStorage.getItem(draftKey(S.login));
    if(raw){
      let saved;try{saved=JSON.parse(raw);}catch{throw Error("Bản nháp CMS không đọc được. Mở Admin để sao lưu.");}
      if(saved.sha!==S.sha||saved.source!=="inline-article"||saved.storyId!==S.id)
        throw Error("Đã có bản nháp CMS khác. Mở Admin để đối chiếu trước khi sửa tiếp.");
      if(!confirm("Đã có bản nháp của bài này. Khôi phục để sửa tiếp?"))return;
      S.current=saved.data;S.dirty=true;
    }else{
      const checkpoint=JSON.parse(localStorage.getItem(recordKey(S.login,S.id,S.sha))||"null");
      if(checkpoint&&JSON.stringify(checkpoint.record)!==JSON.stringify(remoteStory))
        throw Error("Bài đã có bản lưu riêng trong Admin. Đối chiếu trước khi sửa.");
      S.dirty=false;
    }
    S.raw=raw;S.blocked=false;mode(true);showButtons();
    const item=story(S.current,S.id);
    if(raw)S.targets.forEach(({key,el})=>reflect(el,key,read(item,key)));
    $("#inlineCmsSubmit").disabled=!S.dirty;
    $("#inlineCmsDirect").hidden=S.role!=="admin";
    $("#inlineCmsDirect").disabled=!S.dirty;
    note(raw?"Đã khôi phục bản nháp. Chọn đoạn muốn chỉnh.":"Chọn phần muốn sửa ngay trên bài.");
  }catch(e){note(e.message+". Bài đang đọc chưa thay đổi.","warn");}
}
function storyChanges(){
  const before=story(S.base,S.id),after=story(S.current,S.id);
  if(!before||!after||before.sections.length!==after.sections.length)
    throw Error("Cấu trúc bài đã đổi, phải đối chiếu trong CMS.");
  const fields=["title","dek","intro"];
  for(let i=0;i<before.sections.length;i++)
    fields.push("sections."+i+".heading","sections."+i+".body");
  return fields.map(field=>{
    const a=String(read(before,field)),b=String(read(after,field));
    return a===b?null:{field,before:a,after:b};
  }).filter(Boolean);
}
async function directSave(){
  if(!S.editing||S.blocked||!S.dirty||S.role!=="admin")return;
  clearTimeout(S.timer);S.timer=null;if(!save())return;
  const button=$("#inlineCmsDirect");button.disabled=true;
  try{
    const changes=storyChanges();
    if(!changes.length){note("Chưa sửa chữ nào.");return;}
    if(!confirm("Lưu thẳng "+changes.length+" phần chữ, không qua duyệt? Có thể xem lịch sử và hoàn tác trên GitHub."))return;
    note("Đang kiểm tra và lưu trực tiếp lên GitHub...");
    const result=await get("/api/cms/direct-save",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({path:SOURCE,record_id:S.id,sha:S.sha,changes})
    });
    if(!/^[a-f0-9]{40}$/.test(result.commit||""))
      throw Error("Chưa có xác nhận commit. Giữ nháp để kiểm tra CMS.");
    if(localStorage.getItem(draftKey(S.login))===S.raw)localStorage.removeItem(draftKey(S.login));
    const key=recordKey(S.login,S.id,S.sha);
    const checkpoint=JSON.parse(localStorage.getItem(key)||"null");
    if(checkpoint?.tab===S.tab)localStorage.removeItem(key);
    S.dirty=false;stop();
    const el=$("#inlineCmsStatus");
    el.replaceChildren(document.createTextNode("Đã lưu lên GitHub. Chờ CMS cập nhật. "));
    const link=document.createElement("a");
    link.href="https://github.com/kenzuko/jotrip-home/commit/"+result.commit;
    link.target="_blank";link.rel="noopener noreferrer";link.textContent="Xem lịch sử ↗";
    el.append(link);el.dataset.kind="good";
  }catch(error){note(String(error.message||error)+". Nháp vẫn còn trên máy.","warn");}
  finally{if(S.dirty&&!S.blocked)button.disabled=false;}
}
async function submit(){
  if(!S.editing||S.blocked||!S.dirty)return;
  clearTimeout(S.timer);S.timer=null;if(!save())return;
  const button=$("#inlineCmsSubmit");button.disabled=true;
  note("Đang đối chiếu phiên bản và đề xuất đang mở...");
  try{
    const [auth,check]=await Promise.all([
      get("/api/cms/session"),get("/api/cms/edit-state?path="+encodeURIComponent(SOURCE))
    ]);
    if(!roleOK(auth.role)||auth.login!==S.login)throw Error("Quyền truy cập đã thay đổi");
    if(check.complete!==true||check.sha!==S.sha||(check.conflicts||[]).length)
      throw Error("Có PR khác hoặc phiên bản mới, giữ nháp để đối chiếu trong Admin");
    if(!confirm("Gửi bản sửa thành PR? Bài công khai chưa thay đổi."))return;
    const result=await get("/api/cms/publish",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({path:SOURCE,sha:S.sha,content:S.current,message:"chỉnh trực tiếp bài "+S.id})});
    const link=result?.pull_request?.url||"";
    if(!/^https:\/\/github\.com\/kenzuko\/jotrip-home\/pull\/\d+$/.test(link))
      throw Error("CMS chưa trả về PR. Kiểm tra hàng đợi duyệt trước khi thử lại.");
    if(localStorage.getItem(draftKey(S.login))===S.raw)localStorage.removeItem(draftKey(S.login));
    const record=recordKey(S.login,S.id,S.sha);
    const ck=JSON.parse(localStorage.getItem(record)||"null");
    if(ck?.tab===S.tab)localStorage.removeItem(record);
    S.dirty=false;stop();
    const status=$("#inlineCmsStatus");status.replaceChildren(document.createTextNode("Đã gửi đề xuất, chưa công khai. "));
    const a=document.createElement("a");a.href=link;a.target="_blank";a.rel="noopener";a.textContent="Mở PR ↗";
    status.appendChild(a);status.dataset.kind="good";
  }catch(e){note(e.message||"Chưa gửi được, nháp vẫn còn.","warn");}
  finally{button.disabled=false;}
}
function toolbar(){
  const el=document.createElement("aside");el.id="inlineCmsToolbar";el.setAttribute("aria-label","Biên tập ngay trên bài");
  el.innerHTML='<strong>CHẾ ĐỘ BIÊN TẬP</strong><small>Chỉ tài khoản CMS được cấp quyền nhìn thấy</small>'+
    '<button type="button" id="inlineCmsOpen">✎ Chỉnh sửa bài này</button>'+
    '<div id="inlineCmsActions" hidden><button type="button" id="inlineCmsSave">Lưu nháp</button>'+
    '<button type="button" id="inlineCmsBackup">Tải bản sao</button>'+
    '<button type="button" id="inlineCmsRead">Đọc lại</button>'+
    '<button type="button" id="inlineCmsSubmit">Gửi duyệt</button>'+
    '<button type="button" id="inlineCmsDirect" hidden>Lưu thẳng (Admin)</button></div>'+
    '<p id="inlineCmsStatus" role="status"></p>'+
    '<a href="/admin/?module=stories&record='+encodeURIComponent(S.id)+'">Biên tập đầy đủ (ảnh, nguồn, cấu trúc) ↗</a>';
  document.body.appendChild(el);
  $("#inlineCmsOpen").onclick=begin;$("#inlineCmsSave").onclick=save;
  $("#inlineCmsBackup").onclick=backup;$("#inlineCmsRead").onclick=stop;$("#inlineCmsSubmit").onclick=submit;
  $("#inlineCmsDirect").onclick=directSave;
}
async function mount(){
  const localQa=["localhost","127.0.0.1"].includes(location.hostname)&&new URLSearchParams(location.search).get("cms-inline-qa")==="1";
  if(location.hostname!=="cms.openphuquoc.com"&&!localQa)return;
  S.id=new URLSearchParams(location.search).get("id")||"";
  if(!S.id||$("#inlineCmsToolbar"))return;
  const root=$("#articleRoot article.article");
  if(!root||!root.querySelector("h1"))return;
  try{
    const session=await get("/api/cms/session");
    if(roleOK(session.role)){S.login=session.login;S.role=session.role;toolbar();
      if(new URLSearchParams(location.search).get("inline")==="1")begin();}
  }catch{/* Anonymous readers never see a toolbar. */}
}
function observe(){
  const existing=$("#articleRoot article.article");if(existing){mount();return;}
  const host=$("#articleRoot");if(!host)return;
  const watcher=new MutationObserver(()=>{if(host.querySelector("article.article")){watcher.disconnect();mount();}});
  watcher.observe(host,{childList:true,subtree:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe);else observe();
window.addEventListener("storage",event=>{
  if(S.editing&&event.key===draftKey(S.login)&&event.newValue!==S.raw)
    blocked("Phát hiện tab khác sửa cùng bản nháp. Tải JSON để đối chiếu.");
});
window.addEventListener("beforeunload",()=>{if(S.timer){clearTimeout(S.timer);save();}});
root.OPQInlineEditorTest={roleOK,goodField,write,read,paras,draftKey};
})(window);
