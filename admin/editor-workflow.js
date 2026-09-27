/* Open Phu Quoc CMS Editor Workflow V1.3.
 * A safety layer over the existing single-file draft and PR publishing workflow.
 * Record checkpoints are LOCAL ONLY; no automatic cross-record merge or publication. */
(function(root){
  "use strict";
  const PREFIX="openpq-cms-article-v1:";
  let active=null;
  const esc=value=>String(value==null?"":value).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const stamp=value=>{
    const d=new Date(value||0);
    return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("vi-VN",{
      timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",
      hour:"2-digit",minute:"2-digit"
    }).format(d):"Chưa rõ";
  };
  const copy=value=>JSON.parse(JSON.stringify(value));
  const tabId=()=>{
    const random=typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():
      String(Date.now())+"-"+Math.random().toString(36).slice(2);
    return random;
  };
  const thisTab=tabId();
  const scope=(login)=>PREFIX+encodeURIComponent(String(login||""))+":";
  const recordKey=(login,id,sha)=>scope(login)+encodeURIComponent(id)+":"+sha;
  const moduleKey=(login,id)=>"openpq-cms-draft:"+login+":"+id;
  function records(login){
    const items=[],prefix=scope(login);
    try{
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);
        if(!key||!key.startsWith(prefix))continue;
        try{
          const item=JSON.parse(localStorage.getItem(key)||"null");
          if(item?.version===1&&item?.record?.id&&item?.module==="stories"
              &&item?.account===login&&item?.baseSha&&
              key===recordKey(login,String(item.record.id),item.baseSha)){
            items.push({...item,key});
          }
        }catch{}
      }
    }catch(e){return{items,error:e?.message||"Trình duyệt không cho đọc bản nháp"};}
    return {items:items.sort((a,b)=>(b.at||0)-(a.at||0)),error:null};
  }
  function backupJson(value,name){
    const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json;charset=utf-8"});
    const uri=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=uri;link.download=name;document.body.appendChild(link);link.click();link.remove();
    URL.revokeObjectURL(uri);
  }
  function archiveModule(login,module,raw){
    try{
      const obj=JSON.parse(raw);
      if(!obj||!obj.data)return false;
      const key="openpq-cms-stale:"+login+":"+module+":"+
        String(obj.at||Date.now())+"-"+Math.random().toString(36).slice(2,8);
      localStorage.setItem(key,raw);
      return localStorage.getItem(key)===raw;
    }catch{return false;}
  }
  function writeModuleDraft(info){
    const key=moduleKey(info.login,info.module),now=Date.now();
    const next={sha:info.sha,data:info.data,at:now,tab:thisTab};
    try{
      const raw=localStorage.getItem(key);
      if(raw){
        try{
          const old=JSON.parse(raw);
          if(old?.tab&&old.tab!==thisTab&&Number(old.at)>Number(active?.openedAt||0)){
            if(active)active.sameBrowserConflict=true;
            const archived=archiveModule(info.login,info.module,JSON.stringify(next));
            return{ok:archived,archived:true,blocked:true};
          }
          if(old?.sha&&old.sha!==info.sha){
            if(!archiveModule(info.login,info.module,raw)){
              return{ok:false,archived:false,blocked:true,
                error:"Không lưu được bản nháp cũ. Hãy tải JSON trước khi chỉnh tiếp."};
            }
          }
        }catch{
          if(!archiveModule(info.login,info.module,raw)){
            return{ok:false,blocked:true,error:"Bản nháp cũ có lỗi. Hãy sao lưu thủ công."};
          }
        }
      }
      if(active?.sameBrowserConflict){
        return{ok:archiveModule(info.login,info.module,JSON.stringify(next)),
          archived:true,blocked:true};
      }
      localStorage.setItem(key,JSON.stringify(next));
      return{ok:localStorage.getItem(key)!==null,archived:false,blocked:false};
    }catch(e){
      return{ok:false,blocked:true,
        error:"Không lưu được bản nháp trên trình duyệt. Hãy tải bản sao JSON."};
    }
  }
  function writeRecordCheckpoints(info){
    if(info.module!=="stories")return{saved:0,skipped:0,blocked:false};
    const current=Array.isArray(info.data?.stories)?info.data.stories:[];
    const base=Array.isArray(info.baseData?.stories)?info.baseData.stories:[];
    const ids=new Set(),baseline=new Map(base.filter(x=>x&&x.id)
      .map(x=>[String(x.id),x]));
    let saved=0,skipped=0,blocked=false;
    for(const story of current){
      const id=String(story?.id||"").trim();
      // New stories without IDs stay protected by the WHOLE-module draft.
      // Avoid index-based recovery because reordering would target the wrong story.
      if(!id||ids.has(id)){skipped++;continue;}
      ids.add(id);
      const initial=baseline.get(id)||null;
      if(JSON.stringify(initial)===JSON.stringify(story))continue;
      const item={version:1,account:info.login,module:"stories",baseSha:info.sha,
        id,baseRecord:initial?copy(initial):null,record:copy(story),at:Date.now(),tab:thisTab};
      const key=recordKey(info.login,id,info.sha);
      try{
        const prior=JSON.parse(localStorage.getItem(key)||"null");
        if(prior?.tab&&prior.tab!==thisTab&&Number(prior.at)>Number(active?.openedAt||0)){
          blocked=true;if(active)active.sameBrowserConflict=true;
          // Do not overwrite another tab's article checkpoint.
          const name="openpq-cms-stale:"+info.login+":stories:"+String(item.at)+
            "-"+Math.random().toString(36).slice(2,8);
          localStorage.setItem(name,JSON.stringify({
            sha:info.sha,data:{stories:[item.record]},at:item.at,tab:thisTab
          }));
          continue;
        }
        if(prior?.tab&&prior.tab!==thisTab&&
            JSON.stringify(prior.record)!==JSON.stringify(item.record)){
          // Preserve an older checkpoint from another tab before replacing it.
          const oldName="openpq-cms-stale:"+info.login+":stories:"+
            String(prior.at||Date.now())+"-"+Math.random().toString(36).slice(2,8);
          const backup=JSON.stringify({
            sha:prior.baseSha,data:{stories:[prior.record]},at:prior.at,tab:prior.tab
          });
          localStorage.setItem(oldName,backup);
          if(localStorage.getItem(oldName)!==backup){blocked=true;continue;}
        }
        localStorage.setItem(key,JSON.stringify(item));saved++;
      }catch{skipped++;}
    }
    return{saved,skipped,blocked};
  }
  function clearSubmitted(info){
    if(!info?.login||!info.module)return;
    if(info.module!=="stories")return;
    const listing=records(info.login);
    for(const item of listing.items){
      if(item.module!=="stories"||item.baseSha!==info.sha||item.tab!==thisTab)continue;
      // Delete only checkpoints actually included in the approved PR payload.
      const sent=info.data?.stories?.find(s=>String(s.id)===item.id);
      if(sent&&JSON.stringify(sent)===JSON.stringify(item.record)){
        try{localStorage.removeItem(item.key)}catch{}
      }
    }
    if(active&&active.login===info.login&&active.module===info.module)renderPanel();
  }
  function badge(state){
    if(state==="checking")return'<span class="ew-tag ew-progress">Đang kiểm tra xung đột...</span>';
    if(state==="clear")return'<span class="ew-tag ew-good">Phiên bản còn phù hợp</span>';
    if(state==="conflict")return'<span class="ew-tag ew-bad">Có xung đột</span>';
    return'<span class="ew-tag ew-warn">Chưa kiểm tra được</span>';
  }
  function renderPanel(){
    const ctx=active,host=document.getElementById("editorTools");
    const wasOpen=Boolean(host?.querySelector(".ew-drafts")?.open);
    if(!host||!ctx||!ctx.module){if(host)host.classList.add("hidden");return;}
    if(ctx.module==="dashboard"||ctx.module==="analytics"||ctx.module==="users"){
      host.classList.add("hidden");return;
    }
    host.classList.remove("hidden");
    let warning="";
    if(ctx.sameBrowserConflict){
      warning='<div class="ew-warning" role="alert"><strong>Phát hiện tab khác đang sửa cùng mục.</strong>'+
      '<p>Thay đổi ở tab này chỉ lưu thành bản riêng. Hãy tải JSON và đối chiếu trước khi gửi duyệt.</p></div>';
    }else if(ctx.remote?.conflicts?.length){
      warning='<div class="ew-warning" role="alert"><strong>Đang có PR khác sửa cùng tệp dữ liệu.</strong>'+
        '<p>Các bài khác nhau vẫn có thể nằm chung một tệp. Kiểm tra PR đang mở trước khi gửi để không ghi đè.</p>'+
        '<div>'+ctx.remote.conflicts.map(c=>'<a href="https://github.com/kenzuko/jotrip-home/pull/'+Number(c.number)+
          '" target="_blank" rel="noopener noreferrer">PR #'+Number(c.number)+
          ' - '+esc(c.title||"Đề xuất CMS")+' ↗</a>').join("")+'</div></div>';
    }else if(ctx.remote?.sha&&ctx.remote.sha!==ctx.sha){
      warning='<div class="ew-warning" role="alert"><strong>Dữ liệu trên GitHub đã thay đổi.</strong>'+
        '<p>Giữ bản nháp, tải JSON để đối chiếu. Không thể tự gộp hai phiên bản.</p></div>';
    }else if(ctx.remote?.complete===false){
      warning='<div class="ew-warning" role="alert"><strong>Chưa kiểm tra hết đề xuất cùng tệp.</strong>'+
        '<p>Hãy mở hàng đợi duyệt và kiểm tra thủ công trước khi gửi.</p></div>';
    }else if(ctx.remoteError){
      warning='<div class="ew-warning" role="status"><strong>Chưa xác minh được bản GitHub.</strong>'+
        '<p>'+esc(ctx.remoteError)+' Không nên gửi duyệt trước khi kiểm tra lại.</p></div>';
    }
    const canDraft=ctx.module==="stories";
    const listing=canDraft?records(ctx.login):{items:[],error:null};
    const list=listing.items;
    const rows=list.slice(0,15).map(item=>{
      const same=item.baseSha===ctx.sha;
      return'<div class="ew-record"><div class="ew-record-main"><strong>'+esc(item.record.title||item.id)+
        '</strong><small>'+esc(stamp(item.at))+' · '+(same?"Cùng phiên bản":"Khác phiên bản, chỉ tải JSON")+
        '</small></div><div class="ew-record-actions">'+
        (same&&ctx.writable?'<button type="button" data-ew-restore="'+esc(item.key)+'">Khôi phục</button>':"")+
        '<button type="button" data-ew-download="'+esc(item.key)+'">Tải JSON</button>'+
        '<button type="button" class="ew-delete" data-ew-delete="'+esc(item.key)+'" aria-label="Xóa bản lưu '+esc(item.record.title||item.id)+'">Xóa</button></div></div>';
    }).join("");
    host.innerHTML='<div class="ew-head"><div><span>BIÊN TẬP AN TOÀN</span>'+
      '<h2>Bản nháp và xung đột</h2></div>'+
      '<div class="ew-head-actions">'+badge(ctx.checking?"checking":ctx.remote?.conflicts?.length||
      ctx.remote?.sha!==ctx.sha&&ctx.remote?.sha||ctx.sameBrowserConflict?"conflict":
      ctx.remote?.complete===true?"clear":"unknown")+
      '<button type="button" data-ew-check '+(ctx.checking?"disabled":"")+'>Kiểm tra lại</button>'+
      '<button type="button" data-ew-backup>Tải bản sao JSON</button></div></div>'+warning+
      (canDraft?'<details class="ew-drafts"><summary>Bản nháp riêng từng bài ('+list.length+
      ') <small>Lưu trên trình duyệt hiện tại</small></summary>'+
      '<div class="ew-draft-body">'+
      (listing.error?'<p class="ew-muted">'+esc(listing.error)+'</p>':"")+
      (rows||'<p class="ew-muted">Chưa có bản nháp riêng. Bài chưa có mã vẫn nằm trong bản nháp toàn mục.</p>')+
      (list.length>15?'<p class="ew-muted">Còn '+(list.length-15)+' bản. Có thể tải bản sao toàn mục để bảo quản.</p>':"")+
      '</div></details>':
      '<p class="ew-muted">Mục này hiện lưu bản nháp toàn tệp. Bản nháp theo từng bài áp dụng cho Bài viết.</p>')+
      '<p class="ew-footnote">Chỉ phát hiện PR đang mở và tab khác trên cùng trình duyệt. Không thể thấy bản chưa lưu của người dùng trên máy khác.</p>';
    if(wasOpen){const details=host.querySelector(".ew-drafts");if(details)details.open=true;}
  }
  function moduleRestore(key){
    const ctx=active;if(!ctx||ctx.module!=="stories"||!ctx.writable)return;
    const found=records(ctx.login).items.find(x=>x.key===key);
    if(!found||found.baseSha!==ctx.sha)return;
    if(ctx.sameBrowserConflict){alert("Đang có tab khác chỉnh sửa. Tải JSON để đối chiếu trước.");return;}
    const data=ctx.getCurrent();
    if(!Array.isArray(data?.stories))return;
    let index=data.stories.findIndex(s=>String(s.id)===found.id);
    const base=ctx.baseData?.stories?.find(s=>String(s.id)===found.id)||null;
    if(JSON.stringify(base)!==JSON.stringify(found.baseRecord)){
      alert("Bài gốc không còn khớp bản đã lưu. Chỉ tải JSON để đối chiếu.");return;
    }
    const message="Khôi phục bản lưu cho “"+(found.record.title||found.id)+
      "”? Nội dung hiện tại của đúng bài này sẽ bị thay thế. Các bài khác được giữ nguyên.";
    if(!confirm(message))return;
    const clone=copy(found.record);
    if(index<0){index=data.stories.length;data.stories.push(clone);}
    else data.stories[index]=clone;
    ctx.onDirty("Đã khôi phục bản nháp của “"+(clone.title||found.id)+"”.");
    ctx.onRender();
    renderPanel();
  }
  function safeImage(url){
    const v=String(url||"").trim();
    if(v.startsWith("/assets/"))return v;
    try{const parsed=new URL(v,location.origin);
      return parsed.protocol==="https:"?parsed.href:"";}catch{return"";}
  }
  function storyPreview(story){
    const body=(story.sections||[]).map(section=>
      '<section class="ew-article-section">'+
      (section.heading?'<h2>'+esc(section.heading)+'</h2>':"")+
      '<p>'+esc(section.body||"").replace(/\n\n/g,"</p><p>")+'</p>'+
      (safeImage(section.image)?'<figure><img src="'+esc(safeImage(section.image))+
        '" alt=""><figcaption>'+esc(section.caption||"")+'</figcaption></figure>':"")+
      '</section>').join("");
    const cover=safeImage(story.image);
    return'<article class="ew-article"><span class="ew-preview-label">'+esc(story.category||"BÀI VIẾT")+
      '</span><h1>'+esc(story.title||"Bài chưa có tiêu đề")+'</h1>'+
      (story.dek?'<p class="ew-article-dek">'+esc(story.dek)+'</p>':"")+
      (cover?'<figure class="ew-cover"><img src="'+esc(cover)+'" alt="'+esc(story.image_alt||"")+
      '"><figcaption>'+esc(story.image_caption||"")+'</figcaption></figure>':"")+
      (story.intro?'<p class="ew-article-intro">'+esc(story.intro)+'</p>':"")+
      (body||'<p class="ew-muted">Bài chưa có nội dung.</p>')+
      (story.sources?.length?'<footer class="ew-article-sources"><h2>Nguồn tham khảo</h2>'+
        '<ul>'+story.sources.map(x=>'<li>'+esc(x.label||"Nguồn")+'</li>').join("")+'</ul></footer>':"")+
      '</article>';
  }
  function previewArticle(index){
    const ctx=active;if(!ctx||ctx.module!=="stories")return;
    const story=ctx.getCurrent()?.stories?.[index];if(!story)return;
    let d=document.getElementById("ewPreviewDialog");
    if(!d){d=document.createElement("dialog");d.id="ewPreviewDialog";d.className="ew-preview-dialog";
      document.body.appendChild(d);}
    d.innerHTML='<div class="ew-preview-top"><div><strong>ĐANG XEM BẢN THẢO</strong>'+
      '<span>Hiển thị nội dung hiện có trong trình biên tập, chưa xuất bản. Đây là bố cục mô phỏng, không phải bản sao pixel của trang công khai.</span></div>'+
      '<button type="button" data-ew-close aria-label="Đóng bản xem trước">Đóng ×</button></div>'+
      storyPreview(story);
    d.querySelector("[data-ew-close]").onclick=()=>d.close();
    if(typeof d.showModal==="function")d.showModal();
    else d.setAttribute("open","");
  }
  async function checkRemote({force=false}={}){
    const ctx=active;
    if(!ctx||!ctx.module||ctx.module==="dashboard"||ctx.module==="analytics")return{ok:false};
    if(!force&&ctx.checking)return{ok:false,reason:"Đang kiểm tra"};
    if(!ctx.modulePath)return{ok:false};
    const sequence=++ctx.checkSeq;
    ctx.checking=true;renderPanel();
    try{
      const data=await ctx.api("/api/cms/edit-state?path="+encodeURIComponent(ctx.modulePath));
      if(ctx!==active||sequence!==ctx.checkSeq)return{ok:false,reason:"Đã có lần kiểm tra mới hơn"};
      ctx.remote=data;ctx.remoteError=null;ctx.checkedAt=Date.now();
      const conflict=Boolean(ctx.sameBrowserConflict||data.sha!==ctx.sha||
        data.conflicts?.length||data.complete!==true);
      return{ok:!conflict,conflict,detail:data};
    }catch(e){
      if(ctx!==active||sequence!==ctx.checkSeq)return{ok:false,reason:"Đã có lần kiểm tra mới hơn"};
      ctx.remoteError=e.message||String(e);ctx.remote=null;
      return{ok:false,error:ctx.remoteError};
    }finally{if(ctx===active&&sequence===ctx.checkSeq){ctx.checking=false;renderPanel();}}
  }
  function start(config){
    stop();
    const ctx=active={...config,openedAt:Date.now(),
      sameBrowserConflict:false,remote:null,remoteError:null,checkedAt:null,checking:false,checkSeq:0};
    ctx.onPanelClick=function(event){
      const target=event.target.closest("[data-ew-check],[data-ew-backup],[data-ew-restore],[data-ew-download],[data-ew-delete]");
      if(!target)return;
      event.preventDefault();
      if(target.hasAttribute("data-ew-check")){checkRemote({force:true});return;}
      if(target.hasAttribute("data-ew-backup")){
        try{backupJson({module:ctx.module,sha:ctx.sha,at:Date.now(),
          data:ctx.getCurrent()},"openpq-"+ctx.module+"-ban-sao-"+Date.now()+".json");}
        catch(e){alert("Không tải được JSON: "+e.message);}
        return;
      }
      const id=target.getAttribute("data-ew-restore")||target.getAttribute("data-ew-download")||
        target.getAttribute("data-ew-delete");
      if(!id)return;
      if(target.hasAttribute("data-ew-restore")){moduleRestore(id);return;}
      const item=records(ctx.login).items.find(x=>x.key===id);if(!item)return;
      if(target.hasAttribute("data-ew-download")){
        try{backupJson(item,"ban-nhap-"+item.id+"-"+Date.now()+".json");}
        catch(e){alert("Không tải được bản nháp: "+e.message);}
        return;
      }
      if(target.hasAttribute("data-ew-delete")&&confirm("Xóa bản nháp riêng của “"+
        (item.record.title||item.id)+"” trên trình duyệt này?")){
        try{localStorage.removeItem(id)}catch{}
        renderPanel();
      }
    };
    ctx.onStorage=function(event){
      if(event.storageArea!==localStorage||!event.key)return;
      if(event.key!==moduleKey(ctx.login,ctx.module)&&
        !(ctx.module==="stories"&&event.key.startsWith(scope(ctx.login))))return;
      if(!event.newValue)return;
      try{
        const other=JSON.parse(event.newValue);
        if(other?.tab!==thisTab&&Number(other?.at)>ctx.openedAt){
          ctx.sameBrowserConflict=true;
          // Preserve this tab's current unsent work separately, not at a shared key.
          archiveModule(ctx.login,ctx.module,JSON.stringify({
            sha:ctx.sha,data:ctx.getCurrent(),at:Date.now(),tab:thisTab
          }));
          renderPanel();
        }
      }catch{ctx.sameBrowserConflict=true;renderPanel();}
    };
    document.getElementById("editorTools")?.addEventListener("click",ctx.onPanelClick);
    window.addEventListener("storage",ctx.onStorage);
    renderPanel();
    // Do not call open PR checks on static preview routes or before session auth.
    if(ctx.modulePath&&ctx.writable&&ctx.module!=="users")checkRemote();
  }
  function stop(){
    if(active){
      document.getElementById("editorTools")?.removeEventListener("click",active.onPanelClick);
      window.removeEventListener("storage",active.onStorage);
      active=null;
    }
    document.getElementById("editorTools")?.classList.add("hidden");
  }
  root.OPQEditorWorkflow={
    start,stop,renderPanel,checkRemote,previewArticle,
    records,recordKey,writeModuleDraft,writeRecordCheckpoints,archiveModule,
    clearSubmitted,getTabId:()=>thisTab,hasConflict:()=>Boolean(active?.sameBrowserConflict),
    canSubmit:()=>Boolean(active&&!active.sameBrowserConflict&&active.remote?.complete===true&&
      active.remote?.sha===active.sha&&!active.remote?.conflicts?.length)
  };
})(window);