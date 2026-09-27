/* Open Phu Quoc CMS Control Room V1 - read-only orchestration of existing CMS APIs.
   No Weather, Airport, Transit or public-site logic is imported or modified. */
(function(){
  "use strict";
  var active=null;
  var API_QUALITY="/api/cms/quality",API_REVIEWS="/api/cms/reviews";
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]});}
  function when(v){
    if(!v)return "Chưa có thời điểm";
    var d=new Date(v);
    return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",timeZone:"Asia/Ho_Chi_Minh"}).format(d):"Chưa xác định";
  }
  function localDrafts(login,modules){
    var prefix="openpq-cms-draft:"+login+":";
    var archivePrefix="openpq-cms-stale:"+login+":";
    var known=new Set(modules.map(function(m){return m.id}));
    var drafts=[],archived=[];
    try{
      for(var i=0;i<localStorage.length;i++){
        var key=localStorage.key(i);
        if(!key)continue;
        if(key.startsWith(prefix)){
          var id=key.slice(prefix.length);
          if(!known.has(id))continue;
          var raw=JSON.parse(localStorage.getItem(key)||"null");
          if(raw&&raw.data)drafts.push({id:id,at:raw.at});
        }else if(key.startsWith(archivePrefix)){
          var archivedId=key.slice(archivePrefix.length).split(":")[0];
          if(!known.has(archivedId))continue;
          var older=JSON.parse(localStorage.getItem(key)||"null");
          if(older&&older.data)archived.push({id:archivedId,at:older.at,key:key});
        }
      }
    }catch(e){return {items:drafts,archived:archived,error:true};}
    var newest=function(a,b){return (b.at||0)-(a.at||0)};
    return {items:drafts.sort(newest),archived:archived.sort(newest),error:false};
  }
  async function getJson(url,signal){
    var r=await fetch(url,{credentials:"include",cache:"no-store",signal:signal,headers:{Accept:"application/json"}});
    var body=await r.json().catch(function(){return {};});
    if(!r.ok)throw new Error(body.detail||body.error||("HTTP "+r.status));
    return body;
  }
  function taskLink(task,modules){
    var id=String(task.entity_id||"");
    var module=id.startsWith("food_")?"foods":"venues";
    if(!id||!modules.some(function(m){return m.id===module;}))return "";
    return "index.html?module="+encodeURIComponent(module)+"&record="+encodeURIComponent(id)+"&field="+encodeURIComponent(task.field||"");
  }
  function labelForSeverity(v){return {high:"Ưu tiên",medium:"Cần bổ sung",low:"Theo dõi"}[v]||"Cần kiểm tra";}
  function queueTask(task,modules){
    var href=taskLink(task,modules),name=task.entity_id||task.surface||"Thông tin cần kiểm tra";
    return '<article class="cr-task">'+
      '<div class="cr-task-top"><span class="cr-pill cr-'+esc(task.severity||"low")+'">'+esc(labelForSeverity(task.severity))+'</span><span class="cr-task-area">'+esc(task.surface||"Dữ liệu")+'</span></div>'+
      '<h3>'+esc(name)+'</h3><p>'+esc(task.evidence||task.next_action||"Chưa có mô tả chi tiết.")+'</p>'+
      '<div class="cr-task-bottom"><span>'+esc(task.status==="in_progress"?"Đang xử lý":"Cần kiểm chứng")+'</span>'+
      (href?'<a href="'+esc(href)+'">Mở đúng trường <span aria-hidden="true">↗</span></a>':'<a href="quality.html">Mở hàng đợi <span aria-hidden="true">↗</span></a>')+
      '</div></article>';
  }
  function renderQuality(body,modules){
    if(!body)return '<div class="cr-error" role="status">Chưa tải được công việc. Không thể xác nhận tình trạng dữ liệu. <button type="button" data-cr-refresh>Thử lại</button></div>';
    var all=Array.isArray(body.tasks)?body.tasks:[];
    var tasks=all.filter(function(t){return !["resolved","muted"].includes(t.status);});
    var rank={high:0,medium:1,low:2};
    tasks.sort(function(a,b){return (rank[a.severity]??3)-(rank[b.severity]??3);});
    var time=body.computed_at?'<span class="cr-timestamp">Kiểm tra lúc '+esc(when(body.computed_at))+'</span>':'<span class="cr-timestamp">Chưa có thời gian kiểm tra</span>';
    return '<div class="cr-section-heading"><div><p class="cr-eyebrow">DỮ LIỆU</p><h2>Cần kiểm chứng</h2></div><a href="quality.html">Tất cả <span aria-hidden="true">↗</span></a></div>'+
      '<p class="cr-section-note">'+esc(tasks.length)+' công việc đang mở. '+time+'</p>'+
      (tasks.length?'<div class="cr-queue">'+tasks.slice(0,5).map(function(t){return queueTask(t,modules);}).join("")+'</div>':
      '<div class="cr-empty"><strong>Chưa có việc đang mở trong nguồn này.</strong><span>Đây chỉ là kết quả của bộ quy tắc kiểm tra hiện tại, không thay thế xác minh thực địa.</span></div>');
  }
  function renderReviews(body){
    if(!body)return '<div class="cr-error" role="status">Không đọc được hàng đợi duyệt. <button type="button" data-cr-refresh>Thử lại</button></div>';
    var items=Array.isArray(body.items)?body.items:[];
    return '<div class="cr-section-heading"><div><p class="cr-eyebrow">BIÊN TẬP</p><h2>Chờ duyệt</h2></div><a href="reviews.html">Mở hàng đợi ↗</a></div>'+
      '<p class="cr-section-note">'+esc(items.length)+' đề xuất. Chỉ lên website sau khi kiểm tra, merge và xác nhận triển khai.</p>'+
      (items.length?'<div class="cr-proposals">'+items.slice(0,4).map(function(p){
        var number=Number(p.number)||0;
        return '<a class="cr-proposal" href="reviews.html?pr='+number+'"><span class="cr-proposal-state">'+(p.draft?"PR nháp":"Đề xuất mở")+'</span>'+
        '<strong>'+esc(p.title||"Đề xuất CMS #"+number)+'</strong><small>#'+number+' · '+esc(when(p.updated_at))+'</small><span class="cr-proposal-arrow" aria-hidden="true">↗</span></a>';
      }).join("")+'</div>':
      '<div class="cr-empty"><strong>Chưa có đề xuất CMS đang mở.</strong><span>Bản nháp trên thiết bị chưa phải đề xuất gửi duyệt.</span></div>');
  }
  function renderDrafts(local,modules){
    var labelById=new Map(modules.map(function(m){return [m.id,m.label]}));
    var parts=local.items.map(function(item){
      return '<button class="cr-draft" type="button" data-cr-module="'+esc(item.id)+'"><span class="cr-draft-mark" aria-hidden="true">✎</span><span><strong>'+esc(labelById.get(item.id)||item.id)+'</strong><small>Lưu trên trình duyệt · '+esc(when(item.at))+'</small></span><span aria-hidden="true">↗</span></button>';
    }).join("");
    var older=(local.archived||[]).slice(0,4).map(function(item){
      return '<button class="cr-draft cr-draft-old" type="button" data-cr-export="'+esc(item.key)+'"><span class="cr-draft-mark" aria-hidden="true">↓</span><span><strong>'+esc(labelById.get(item.id)||item.id)+'</strong><small>Khác phiên bản · '+esc(when(item.at))+'</small></span><span aria-hidden="true">↓</span></button>';
    }).join("");
    return '<div class="cr-section-heading"><div><p class="cr-eyebrow">BẢN NHÁP</p><h2>Tiếp tục công việc</h2></div></div>'+
      (parts?'<div class="cr-drafts">'+parts+'</div>':
      '<div class="cr-empty cr-empty-small"><strong>Chưa có bản nháp đang sửa.</strong><span>Nháp chỉ được lưu trong trình duyệt hiện tại.</span></div>')+
      (older?'<h3 class="cr-stale-heading">Nháp cũ cần đối chiếu</h3><p class="cr-stale-note">Nhấn để tải JSON về thiết bị trước khi tiếp tục chỉnh sửa.</p><div class="cr-drafts">'+older+'</div>':'')+
      (local.error?'<p class="cr-warning">Không đọc đủ bản nháp từ trình duyệt.</p>':'');
  }
  function renderQuick(modules){
    var preferred=["stories","guide","venues","utilities","visuals","home","foods"];
    var icons={stories:"✎",guide:"▤",venues:"⌖",utilities:"✚",visuals:"▧",home:"⌂",foods:"◈"};
    var shown=preferred.map(function(id){return modules.find(function(m){return m.id===id;});}).filter(Boolean).slice(0,6);
    return shown.map(function(m){return '<button type="button" class="cr-shortcut" data-cr-module="'+esc(m.id)+'"><span class="cr-shortcut-icon" aria-hidden="true">'+(icons[m.id]||"↗")+'</span><strong>'+esc(m.label)+'</strong><span aria-hidden="true">↗</span></button>';}).join("");
  }
  function render(state){
    if(!state.active)return;
    var host=state.host,local=localDrafts(state.login,state.modules);
    var quality=state.quality?.value||null,reviews=state.reviews?.value||null;
    var open=quality?(Array.isArray(quality.tasks)?quality.tasks.filter(function(t){return !["resolved","muted"].includes(t.status);}).length:0):null;
    var pending=reviews?(Array.isArray(reviews.items)?reviews.items.length:0):null;
    var overview='<section class="cr-intro" aria-label="Tổng quan công việc"><p class="cr-eyebrow">BÀN LÀM VIỆC / OPEN PHU QUOC</p>'+
      '<h2>Nắm tình hình. Xử lý đúng việc.</h2><p>Công việc biên tập, nguồn dữ liệu và đề xuất cập nhật, ở cùng một nơi.</p>'+
      '<button type="button" class="cr-refresh" data-cr-refresh '+(state.loading||state.preview?'disabled':'')+'><span aria-hidden="true">↻</span> '+(state.preview?"Dữ liệu minh họa":state.loading?"Đang kiểm tra...":"Kiểm tra lại")+'</button></section>';
    var metrics='<section class="cr-metrics" aria-label="Tóm tắt công việc">'+
      '<a href="quality.html" class="cr-metric"><span>Cần kiểm chứng</span><strong>'+(open===null?"—":open)+'</strong><small>'+(open===null?"Chưa đọc được nguồn":"Từ bộ quy tắc chất lượng")+'</small></a>'+
      '<a href="reviews.html" class="cr-metric"><span>Chờ duyệt</span><strong>'+(pending===null?"—":pending)+'</strong><small>'+(pending===null?"Chưa đọc được nguồn":"Đề xuất CMS đang mở")+'</small></a>'+
      '<div class="cr-metric"><span>Nháp trên thiết bị</span><strong>'+(local.error?"—":local.items.length+(local.archived||[]).length)+'</strong><small>Không đồng bộ giữa các máy</small></div></section>';
    var errorMessages=[state.quality?.error,state.reviews?.error].filter(Boolean);
    var notice=errorMessages.length?'<div class="cr-notice" role="alert">Một số nguồn chưa tải được: '+errorMessages.map(esc).join(" · ")+'. Không coi số liệu thiếu là 0.</div>':'';
    host.innerHTML='<div class="control-room"><div class="cr-workspace">'+overview+metrics+notice+
      '<section class="cr-panel" id="crQuality" aria-label="Công việc chất lượng">'+(state.loading?'<div class="cr-loading" role="status">Đang đọc công việc từ CMS...</div>':renderQuality(quality,state.modules))+'</section>'+
      '<section class="cr-panel" id="crReviews" aria-label="Đề xuất chờ duyệt">'+(state.loading?'<div class="cr-loading" role="status">Đang đọc hàng đợi duyệt...</div>':renderReviews(reviews))+'</section></div>'+
      '<aside class="cr-context" aria-label="Công cụ nhanh">'+
      '<section class="cr-panel cr-sidepanel">'+renderDrafts(local,state.modules)+'</section>'+
      '<section class="cr-panel cr-sidepanel"><div class="cr-section-heading"><div><p class="cr-eyebrow">TRUY CẬP NHANH</p><h2>Mở đúng mục</h2></div></div><div class="cr-shortcuts">'+renderQuick(state.modules)+'</div></section>'+
      '<section class="cr-panel cr-sidepanel cr-source-panel"><p class="cr-eyebrow">NGUỒN & TRẠNG THÁI</p><h2>Giữ thông tin đáng tin</h2><p>Dữ liệu vận hành của Weather, Airport, Transit và các hệ thống chuyên trách không được chỉnh từ bàn làm việc này.</p>'+
      (state.role==="admin"?'<button type="button" data-cr-module="analytics" class="cr-text-link">Mở Intelligence <span aria-hidden="true">↗</span></button>':'')+
      '<a class="cr-text-link" href="quality.html">Kiểm tra nguồn dữ liệu <span aria-hidden="true">↗</span></a></section></aside></div>';
    if(state.preview){
      host.querySelectorAll("a,button").forEach(function(el){
        if(el.tagName==="A"){el.removeAttribute("href");el.setAttribute("aria-disabled","true");el.setAttribute("tabindex","-1");}
        else el.disabled=true;
      });
    }
  }
  async function refresh(state){
    if(!state.active||state.preview)return;
    state.controller?.abort();
    state.controller=new AbortController();
    state.loading=true;render(state);
    var signal=state.controller.signal;
    var results=await Promise.allSettled([getJson(API_QUALITY,signal),getJson(API_REVIEWS,signal)]);
    if(!state.active||signal.aborted)return;
    state.quality=results[0].status==="fulfilled"&&Array.isArray(results[0].value?.tasks)?{value:results[0].value}:{error:results[0].status==="fulfilled"?"Dữ liệu công việc không hợp lệ":results[0].reason?.message||"Không có kết nối"};
    state.reviews=results[1].status==="fulfilled"&&Array.isArray(results[1].value?.items)?{value:results[1].value}:{error:results[1].status==="fulfilled"?"Hàng đợi duyệt không hợp lệ":results[1].reason?.message||"Không có kết nối"};
    state.loading=false;render(state);
  }
  function unmount(){
    if(!active)return;
    active.active=false;
    active.controller?.abort();
    active.host.removeEventListener("click",active.click);
    active=null;
  }
  function mount(opts){
    unmount();
    var state={active:true,host:opts.host,role:opts.role,login:opts.login,modules:opts.modules.filter(function(m){return m.read?.includes(opts.role);}),quality:null,reviews:null,loading:false,controller:null,preview:Boolean(opts.previewData)};
    state.click=function(event){
      var exportButton=event.target.closest("[data-cr-export]");
      if(exportButton&&!state.preview){
        event.preventDefault();
        try{
          var key=exportButton.getAttribute("data-cr-export"),raw=localStorage.getItem(key);
          if(!key||!key.startsWith("openpq-cms-stale:"+state.login+":")||!raw)return;
          var blob=new Blob([raw],{type:"application/json;charset=utf-8"});
          var url=URL.createObjectURL(blob),link=document.createElement("a");
          link.href=url;link.download="openpq-nhap-cu-"+Date.now()+".json";
          document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
        }catch(e){exportButton.title="Trình duyệt không cho tải. Hãy thử trên máy tính.";}
        return;
      }
      var refreshButton=event.target.closest("[data-cr-refresh]");
      if(refreshButton){event.preventDefault();refresh(state);return;}
      var jump=event.target.closest("[data-cr-module]");
      if(jump){event.preventDefault();var id=jump.getAttribute("data-cr-module");if(id==="analytics"||state.modules.some(function(m){return m.id===id;}))opts.onNavigate(id);}
    };
    active=state;
    state.host.addEventListener("click",state.click);
    if(state.preview){
      state.quality={value:opts.previewData.quality};
      state.reviews={value:opts.previewData.reviews};
      render(state);
    }else{
      refresh(state);
    }
  }
  window.OPQControlRoom={mount:mount,unmount:unmount};
})();