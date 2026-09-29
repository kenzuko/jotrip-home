/* Same-origin CMS admin inline text edits for the knowledge library and homepage copy.
 * Never rewrites live operational text, code strings, photos or untracked DOM nodes. */
(function(root){"use strict";
const isGuide=/^\/guide\/article\.html$/.test(location.pathname);
const isHome=location.pathname==="/"||location.pathname==="/index.html";
const config=isGuide?{path:"data/knowledge/objects.json",public:"/data/views/knowledge-public.json",
  select:data=>(data.objects||[]).find(x=>x.topic_id===state.id)}:
  isHome?{path:"data/home-copy.json",public:"/data/home-copy.json",
    select:data=>data}:null;
const localInlineQa=["localhost","127.0.0.1"].includes(location.hostname)&&new URLSearchParams(location.search).get("cms-inline-qa")==="1";
if(!config||location.hostname!=="cms.openphuquoc.com"&&!localInlineQa)return;
const $=q=>document.querySelector(q);
const state={id:isHome?"home":new URLSearchParams(location.search).get("id")||"",
  sha:"",login:"",base:null,current:null,raw:null,tab:"",dirty:false,editing:false,
  blocked:false,timer:null,panel:null,serverSync:Promise.resolve()};
const deep=x=>JSON.parse(JSON.stringify(x));
const draftKey=()=> isHome?"openpq-cms-site-copy-v1:"+encodeURIComponent(state.login)+":"+state.sha:
  "openpq-cms-inline-page:v1:"+encodeURIComponent(state.login)+":"+encodeURIComponent(state.id)+":"+state.sha;
const draftScope=()=>isGuide?"guide:"+state.id:"";
const draftModule=()=>isGuide?"guide":"home";
const same=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b)}catch{return false}};
function homeTextFields(doc){
  const out=[];
  for(const p of ["hero.kicker","hero.title","hero.lead","footer.title","footer.lead","footer.note"])
    if(typeof pathValue(doc,p)==="string")out.push(p);
  for(const [id,v] of Object.entries(doc.sections||{}))for(const key of ["eyebrow","title","lead"])
    if(typeof v?.[key]==="string")out.push("sections."+id+"."+key);
  const walk=(obj,prefix)=>Object.entries(obj||{}).forEach(([k,v])=>{const next=prefix?prefix+"."+k:k;if(typeof v==="string")out.push("site."+next);else if(v&&typeof v==="object"&&!Array.isArray(v))walk(v,next);});
  walk(doc.site,"");return out;
}
function pathValue(record,path){return String(path.split(".").reduce((v,k)=>v?.[k],record)??"");}
function patch(record,path,value){
  const chunks=path.split(".");let node=record;
  for(let i=0;i<chunks.length-1;i++)node=node?.[chunks[i]];
  if(node&&Object.hasOwn(node,chunks.at(-1)))node[chunks.at(-1)]=value;
  else throw Error("Ô chữ không tồn tại trong dữ liệu gốc");
}
async function api(path,init={}){
  const res=await fetch(path,{cache:"no-store",credentials:"same-origin",...init});
  const out=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(out.error||"HTTP "+res.status);
  return out;
}
function note(message,kind=""){
  const el=$("#cmsPageStatus");
  if(el){el.textContent=message;el.dataset.kind=kind;}
}
function block(message){
  state.blocked=true;clearTimeout(state.timer);state.timer=null;
  note(message+". Tải bản sao trước khi thoát.","warn");
  const btn=$("#cmsPagePublish");if(btn)btn.disabled=true;
}
function backup(){
  if(!state.current)return;
  const blob=new Blob([JSON.stringify({id:state.id,sha:state.sha,
    path:config.path,content:config.select(state.current)},null,2)],
    {type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="nhap-"+state.id+".json";document.body.appendChild(link);
  link.click();link.remove();URL.revokeObjectURL(url);
}
function writeLocalDraft(){
  const key=draftKey();
  const raw=JSON.stringify({version:1,login:state.login,id:state.id,sha:state.sha,
    data:state.current,tab:state.tab,at:Date.now()});
  localStorage.setItem(key,raw);
  if(localStorage.getItem(key)!==raw)throw Error("Không xác minh được bản lưu");
  state.raw=raw;return raw;
}
function syncServer(checkpoint=false){
  const store=window.OPQDraftStore;
  if(!store||!state.current||!state.sha){
    note("Đã lưu dự phòng trên máy; server nháp chưa sẵn sàng.","warn");
    return state.serverSync=Promise.resolve({ok:false,skipped:true});
  }
  const scope=draftScope(),snapshot=deep(state.current),baseSnapshot=deep(state.base);
  const task=(async()=>{
    let loaded=null;
    if(store.token(config.path,scope)===undefined){
      loaded=await store.load(config.path,scope);
      if(!loaded.ok)return loaded;
      const server=loaded.draft;
      if(server&&server.base_sha!==state.sha){
        if(same(server.data,baseSnapshot)){
          const cleared=await store.clear({path:config.path,scope});
          if(!cleared.ok)return cleared;
        }else return{ok:false,status:409,conflict:true,error:"Bản nháp server thuộc phiên bản GitHub cũ"};
      }else if(server&&server.base_sha===state.sha&&!same(server.data,snapshot)&&!same(server.data,baseSnapshot)){
        return{ok:false,status:409,conflict:true,error:"Bản nháp server khác với bản đang sửa"};
      }
    }
    return store.save({module:draftModule(),path:config.path,scope,baseSha:state.sha,
      data:snapshot,checkpoint:Boolean(checkpoint)});
  })().then(result=>{
    if(result?.ok)note("Đã lưu nháp trên server và máy. Chưa công khai.","good");
    else if(result?.status===409){block(result.error||"Bản nháp server vừa thay đổi ở nơi khác");}
    else note("Đã lưu dự phòng trên máy; server chưa đồng bộ.","warn");
    return result;
  }).catch(error=>{note("Đã lưu dự phòng trên máy; server chưa đồng bộ: "+String(error.message||error),"warn");return{ok:false,error:String(error.message||error)}});
  state.serverSync=task;return task;
}
function saveDraft({checkpoint=false}={}){
  if(!state.editing||state.blocked)return false;
  try{
    const key=draftKey();
    if(localStorage.getItem(key)!==state.raw){
      block("Tab khác đã đổi bản nháp");return false;
    }
    writeLocalDraft();note("Đã lưu dự phòng trên máy; đang đồng bộ server.","good");
    syncServer(checkpoint);
    return true;
  }catch(err){block("Không lưu được: "+err.message);return false;}
}
function schedule(){
  clearTimeout(state.timer);
  note("Đang lưu nháp...");
  state.timer=setTimeout(()=>{state.timer=null;saveDraft();},500);
}
async function recoverDraft(){
  const raw=localStorage.getItem(draftKey());
  let local=null;
  if(raw){
    try{local=JSON.parse(raw)}catch{throw Error("Bản nháp trên máy không đọc được. Hãy tải bản sao trước khi tiếp tục.");}
    if(local.login!==state.login||local.id!==state.id||local.sha!==state.sha||!config.select(local.data))
      throw Error("Bản nháp trên máy không khớp bài hoặc phiên bản hiện tại");
  }
  state.raw=raw;
  const store=window.OPQDraftStore;
  let server=null,serverAvailable=false;
  if(store){
    const loaded=await store.load(config.path,draftScope());
    if(loaded.ok){serverAvailable=true;server=loaded.draft;}
    else note("Server nháp tạm thời chưa đọc được; vẫn có bản dự phòng trên máy.","warn");
  }
  if(server&&server.base_sha!==state.sha){
    if(same(server.data,state.base)){
      await store.clear({path:config.path,scope:draftScope()});
      server=null;
    }else throw Error("Có bản nháp server thuộc phiên bản GitHub cũ. Mở CMS Admin để đối chiếu trước khi sửa tiếp.");
  }
  const localFresh=Boolean(local?.data),serverFresh=Boolean(server?.data&&server.base_sha===state.sha&&!same(server.data,state.base));
  let chosen=null,label="";
  if(localFresh&&serverFresh){
    if(same(local.data,server.data)){chosen=local;label="server và máy";}
    else{
      const localAt=Number(local.at||0),serverAt=Date.parse(server.updated_at||"")||0;
      const preferLocal=localAt>=serverAt;
      const preferred=preferLocal?local:{data:server.data};
      const other=preferLocal?{data:server.data}:local;
      const preferredName=preferLocal?"trên máy":"trên server";
      const otherName=preferLocal?"trên server":"trên máy";
      chosen=confirm("Có hai bản nháp khác nhau. Bản "+preferredName+" mới hơn.\nOK: dùng bản "+preferredName+".\nHủy: dùng bản "+otherName+".")?preferred:other;
      label=chosen===preferred?preferredName:otherName;
    }
  }else if(serverFresh){chosen={data:server.data};label="server";}
  else if(localFresh){chosen=local;label="máy";}
  if(chosen){
    state.current=deep(chosen.data);state.dirty=!same(state.current,state.base);
    writeLocalDraft();
    if(serverAvailable&&!serverFresh||serverFresh&&!same(server?.data,state.current))syncServer(true);
    return label||"nháp";
  }
  state.dirty=false;return "";
}
function controls(){
  return [...document.querySelectorAll("[data-cms-field]")].filter(el=>
    isGuide?Boolean(el.closest("#knowledgeArticle .knowledge-article")):
      Boolean(el.closest(".hero,.section,.site-footer")));
}
function closePanel(){state.panel?.remove();state.panel=null;
  document.querySelectorAll(".cms-page-trigger.active").forEach(el=>el.classList.remove("active"));}
function editField(element,button){
  if(!state.editing||state.blocked)return;
  const field=element.dataset.cmsField;
  const record=config.select(state.current);
  closePanel();button.classList.add("active");
  const panel=document.createElement("div");panel.className="cms-page-panel";
  const label=document.createElement("label");label.textContent="Chỉnh nội dung ngay trên trang";
  const input=document.createElement("textarea");input.value=pathValue(record,field);
  input.rows=input.value.length>150?7:3;label.append(input);
  const hint=document.createElement("small");hint.textContent="Chỉ sửa chữ của phần được gắn trong CMS. Ảnh và thông tin vận hành không bị đổi.";
  const done=document.createElement("button");done.type="button";done.textContent="Đọc tiếp";done.onclick=closePanel;
  panel.append(label,hint,done);button.insertAdjacentElement("afterend",panel);
  state.panel=panel;
  input.oninput=()=>{
    patch(record,field,input.value);element.textContent=input.value;
    state.dirty=true;$("#cmsPagePublish").disabled=false;schedule();
  };
  input.focus({preventScroll:true});panel.scrollIntoView({block:"center",behavior:"smooth"});
}
function reflect(){
  const record=config.select(state.current);
  controls().forEach(el=>{el.textContent=pathValue(record,el.dataset.cmsField);});
}
function mode(active){
  state.editing=active;
  document.body.classList.toggle("cms-page-editing",active);
  $("#cmsPageLaunch").hidden=active;
  $("#cmsPageBar").hidden=!active;
}
function readAgain(){
  if(state.timer){clearTimeout(state.timer);state.timer=null;if(!saveDraft())return;}
  closePanel();document.querySelectorAll(".cms-page-trigger").forEach(el=>el.remove());
  mode(false);
  if(state.dirty)note("Đang xem bản đã sửa trên máy, chưa phải bản công khai.","good");
}
async function begin(){
  if(state.editing)return;
  try{
    const who=await api("/api/cms/session");
    if(who.role!=="admin")throw Error("Chỉ Admin được sửa trực tiếp tại đây");
    state.login=who.login;
    const [publicView,git]=await Promise.all([
      api(config.public+"?inline="+Date.now()),
      api("/api/cms/content?path="+encodeURIComponent(config.path))
    ]);
    const publicRecord=config.select(publicView),gitRecord=config.select(git.content);
    if(!publicRecord||!gitRecord)throw Error("Không tìm thấy dữ liệu nguồn bài");
    for(const el of controls()){
      const field=el.dataset.cmsField;
      if(pathValue(publicRecord,field)!==pathValue(gitRecord,field))
        throw Error("Trang công khai đang khác bản GitHub. Chờ đồng bộ rồi tải lại.");
    }
    state.sha=git.sha;state.base=deep(git.content);state.current=deep(git.content);
    state.tab=crypto.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2);
    state.blocked=false;
    const restored=await recoverDraft();
    if(restored)reflect();
    mode(true);
    controls().forEach(el=>{
      const button=document.createElement("button");button.type="button";
      button.className="cms-page-trigger";button.textContent="✎ Sửa chữ";
      button.onclick=()=>editField(el,button);
      el.insertAdjacentElement("afterend",button);
    });
    $("#cmsPagePublish").disabled=!state.dirty;
    note(restored?"Đã khôi phục bản nháp từ "+restored+".":"Chọn cây viết cạnh phần chữ muốn sửa.");
  }catch(error){note(String(error.message||error),"warn");}
}
function changed(){
  const before=config.select(state.base),after=config.select(state.current);
  const fields=isHome?homeTextFields(state.base):[...new Set(controls().map(x=>x.dataset.cmsField))];
  return fields.map(field=>{
    const a=pathValue(before,field),b=pathValue(after,field);
    return a===b?null:{field,before:a,after:b};
  }).filter(Boolean);
}
async function publishOnce(){
  if(!state.editing||state.blocked||!state.dirty)return;
  clearTimeout(state.timer);state.timer=null;if(!saveDraft({checkpoint:true}))return;
  const button=$("#cmsPagePublish");button.disabled=true;
  try{
    await state.serverSync;if(state.blocked)return;
    const changes=changed();
    if(!changes.length){note("Chưa sửa chữ nào.");return;}
    if(!confirm("Xuất bản "+changes.length+" phần chữ? Toàn bộ bản nháp sẽ được gom vào 1 commit GitHub."))return;
    note("Đang xuất bản 1 lần lên GitHub...");
    const result=await api("/api/cms/direct-save",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({path:config.path,record_id:state.id,sha:state.sha,changes})
    });
    if(!/^[a-f0-9]{40}$/.test(result.commit||""))
      throw Error("Chưa xác minh được commit, bản nháp vẫn còn");
    const clearedServer=await window.OPQDraftStore?.clear({path:config.path,scope:draftScope()});
    const keptNewerServer=Boolean(clearedServer&&!clearedServer.ok&&clearedServer.status===409);
    if(localStorage.getItem(draftKey())===state.raw)localStorage.removeItem(draftKey());
    state.dirty=false;readAgain();
    note("Đã xuất bản bằng 1 commit GitHub, chờ website cập nhật. "+(keptNewerServer?"Bản nháp server mới hơn vẫn được giữ để đối chiếu. ":"")+"Lịch sử: github.com/kenzuko/jotrip-home/commit/"+
      result.commit.slice(0,8),"good");
    window.OPQDirectSaveRollback?.mount($("#cmsPageStatus"),result.commit);
  }catch(err){note(String(err.message||err)+". Nháp vẫn còn trên máy.","warn");}
  finally{if(state.dirty&&!state.blocked)button.disabled=false;}
}
function mountBar(){
  const launch=document.createElement("button");launch.type="button";
  launch.id="cmsPageLaunch";launch.className="cms-page-launch";
  launch.textContent="✎ Chỉnh sửa chữ";launch.onclick=begin;
  if(isGuide)$(".knowledge-header")?.append(launch);
  else document.body.append(launch);
  const bar=document.createElement("aside");bar.id="cmsPageBar";bar.className="cms-page-bar";bar.hidden=true;
  bar.innerHTML='<strong>BIÊN TẬP TRỰC TIẾP <small>Nháp lưu server + máy • Xuất bản mới ghi GitHub 1 lần</small></strong>'+
    '<div class="cms-page-actions">'+
    '<button id="cmsPageDraft" type="button">Lưu nháp</button>'+
    '<button id="cmsPageBackup" type="button">Tải bản sao</button>'+
    '<button id="cmsPageRead" type="button">Đọc lại</button>'+
    '<button id="cmsPagePublish" class="cms-page-publish" type="button">Xuất bản</button></div>'+
    '<p id="cmsPageStatus" role="status" aria-live="polite"></p>';
  if(isGuide)$("#knowledgeArticle")?.prepend(bar);
  else document.body.append(bar);
  $("#cmsPageDraft").onclick=()=>saveDraft({checkpoint:true});
  $("#cmsPageBackup").onclick=backup;
  $("#cmsPageRead").onclick=readAgain;
  $("#cmsPagePublish").onclick=publishOnce;
}
async function mount(){
  if(!state.id||$("#cmsPageLaunch")||!controls().length)return;
  if(isGuide&&$("#knowledgeArticle .knowledge-article")?.dataset.cmsRecord!==state.id)return;
  try{
    const who=await api("/api/cms/session");
    if(who.role==="admin"){state.login=who.login;mountBar();}
  }catch{/* no editing control for public readers */}
}
function observe(){
  if(controls().length){mount();return;}
  const host=isGuide?$("#knowledgeArticle"):document.body;if(!host)return;
  const watcher=new MutationObserver(()=>{
    if(controls().length){watcher.disconnect();mount();}
  });
  watcher.observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:["data-cms-field"]});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",observe);
else observe();
window.addEventListener("storage",event=>{
  if(state.editing&&event.key===draftKey()&&event.newValue!==state.raw)
    block("Tab khác đã thay đổi cùng bản nháp");
});
window.addEventListener("beforeunload",()=>{
  if(state.timer){clearTimeout(state.timer);state.timer=null;saveDraft();}
});
root.OPQInlinePagesTest={pathValue,patch};
})(window);
