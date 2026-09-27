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
    var rule=String(task.rule_id||"");
    var module=rule==="FOOD_ARTICLE_GAP"?"foods":rule.startsWith("VENUE_")?"venues":null;
    if(!id||!module||!modules.some(function(m){return m.id===module;}))return "";
    return "index.html?module="+encodeURIComponent(module)+"&record="+encodeURIComponent(id)+"&field="+encodeURIComponent(task.field||"");
  }
  function labelForSeverity(v){return {high:"Ưu tiên",medium:"Cần bổ sung",low:"Theo dõi"}[v]||"Cần kiểm tra";}
  function taskTitle(task){
    var evidence=String(task.evidence||"").trim();
    var id=String(task.entity_id||"").trim();
    // The existing quality endpoint leads with the verified entity name
    // for these specific rules. Other tasks retain their stated surface.
    var matched=evidence.match(/^(.{2,88}?)\s+(?:đang ACTIVE|có tọa độ|có thực thể món|có thực thể)\s/i);
    var label=matched&&matched[1].trim();
    return label&&label!==id&&!/[\/\\=_]/.test(label)
      ?label:String(task.surface||"Hồ sơ cần kiểm chứng");
  }
  function localDay(){
    var parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",
      year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    function part(type){return parts.find(function(p){return p.type===type;})?.value||"";}
    return part("year")+"-"+part("month")+"-"+part("day");
  }
  function overdue(task,today){
    var due=String(task.due_at||"").slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(due)&&due<today;
  }
  function dueSoon(task,today){
    var due=String(task.due_at||"").slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(due)||due<today)return false;
    return Date.parse(due+"T00:00:00Z")-Date.parse(today+"T00:00:00Z")<=2*86400000;
  }
  function dateLabel(raw){
    var date=String(raw||"").slice(0,10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(8)+"/"+date.slice(5,7)+"/"+date.slice(0,4):"";
  }
  function textMatch(task,needle){
    if(!needle)return true;
    function normalize(value){return String(value||"").normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();}
    return normalize([taskTitle(task),task.entity_id,task.rule_id,task.surface,
      task.evidence,task.next_action,task.owner].join(" ")).includes(normalize(needle));
  }
  function queueTask(task,modules,today){
    var href=taskLink(task,modules),name=taskTitle(task),id=String(task.entity_id||"");
    var due=dateLabel(task.due_at),late=overdue(task,today),soon=dueSoon(task,today);
    var meta=(task.owner?'<span>Phụ trách: '+esc(task.owner)+'</span>':"")
      +(due?'<span class="'+(late?"cr-due-late":soon?"cr-due-soon":"cr-due")+'">'+
      (late?"Quá hạn ":soon?"Sắp đến hạn ":"Hạn ")+esc(due)+'</span>':"");
    return '<article class="cr-task'+(late?" cr-task-overdue":"")+'">'+
      '<div class="cr-task-top"><span class="cr-pill cr-'+esc(task.severity||"low")+'">'+esc(labelForSeverity(task.severity))+'</span><span class="cr-task-area">'+esc(task.surface||"Dữ liệu")+'</span></div>'+
      '<h3>'+esc(name)+'</h3>'+
      (id?'<p class="cr-task-id">Mã hồ sơ: <code>'+esc(id)+'</code></p>':"")+
      '<p>'+esc(task.evidence||task.next_action||"Chưa có mô tả chi tiết.")+'</p>'+
      (meta?'<div class="cr-task-meta">'+meta+'</div>':"")+
      '<div class="cr-task-bottom"><span>'+esc(task.status==="in_progress"?"Đang xử lý":"Cần kiểm chứng")+'</span>'+
      (href?'<a href="'+esc(href)+'">Mở hồ sơ <span aria-hidden="true">↗</span></a>':'<a href="quality.html">Mở hàng đợi <span aria-hidden="true">↗</span></a>')+
      '</div></article>';
  }
  function renderQuality(body,modules,state){
    if(!body)return '<div class="cr-error" role="status">Chưa tải được công việc. Không thể xác nhận tình trạng dữ liệu. <button type="button" data-cr-refresh>Thử lại</button></div>';
    var all=Array.isArray(body.tasks)?body.tasks:[];
    var tasks=all.filter(function(t){return !["resolved","muted"].includes(t.status);});
    var today=localDay(),hasD1=body.storage==="d1";
    var rank={high:0,medium:1,low:2};
    tasks.sort(function(a,b){return (rank[a.severity]??3)-(rank[b.severity]??3)
      ||String(a.due_at||"9999").localeCompare(String(b.due_at||"9999"));});
    var mine=hasD1?tasks.filter(function(t){
      return t.owner&&String(t.owner).toLowerCase()===String(state.login).toLowerCase();
    }).length:0;
    var late=hasD1?tasks.filter(function(t){return overdue(t,today);}).length:0;
    var soon=hasD1?tasks.filter(function(t){return dueSoon(t,today);}).length:0;
    var options=[
      ["all","Tất cả",tasks.length,true],
      ["priority","Ưu tiên",tasks.filter(function(t){return t.severity==="high";}).length,true],
      ["progress","Đang làm",tasks.filter(function(t){return t.status==="in_progress";}).length,true],
      ["mine","Của tôi",mine,hasD1],
      ["late","Quá hạn",late,hasD1],
      ["soon","Sắp hạn",soon,hasD1]
    ];
    var filter=options.some(function(f){return f[0]===state.qualityFilter&&f[3];})
      ?state.qualityFilter:"all";
    var shown=tasks.filter(function(t){
      if(filter==="priority"&&t.severity!=="high")return false;
      if(filter==="progress"&&t.status!=="in_progress")return false;
      if(filter==="mine"&&String(t.owner||"").toLowerCase()!==String(state.login).toLowerCase())return false;
      if(filter==="late"&&!overdue(t,today))return false;
      if(filter==="soon"&&!dueSoon(t,today))return false;
      return textMatch(t,state.searchTerm);
    });
    var tabs='<div class="cr-filter-group" role="group" aria-label="Lọc công việc">'+
      options.map(function(f){
        return '<button type="button" class="cr-filter" data-cr-filter="'+f[0]+
          '" aria-pressed="'+(filter===f[0])+'"'+(f[3]?"":' disabled title="Cần D1 để dùng bộ lọc này"')+
          '>'+f[1]+' ('+(f[3]?f[2]:"—")+')</button>';
      }).join("")+'</div>';
    var search='<div class="cr-work-search" role="search">'+
      '<label for="cr-work-search">Tìm hồ sơ</label><div>'+
      '<input id="cr-work-search" type="search" data-cr-search value="'+esc(state.searchTerm)+
      '" placeholder="Tên, mã, nguồn, người phụ trách..." autocomplete="off">'+
      '<button type="button" data-cr-search-submit>Tìm</button>'+
      (state.searchTerm?'<button type="button" class="cr-clear" data-cr-search-clear>Xóa lọc</button>':"")+
      '</div></div>';
    var time=body.computed_at?'<span class="cr-timestamp">Kiểm tra lúc '+esc(when(body.computed_at))+
      '</span>':'<span class="cr-timestamp">Chưa có thời gian kiểm tra</span>';
    var note=!hasD1?'<p class="cr-source-note">Chưa có trạng thái phân công và hạn xử lý từ D1. Các bộ lọc tương ứng tạm khóa.</p>':"";
    return '<div class="cr-section-heading"><div><p class="cr-eyebrow">DỮ LIỆU</p><h2>Cần kiểm chứng</h2></div>'+
      '<a href="quality.html">Hàng đợi đầy đủ ↗</a></div>'+
      '<p class="cr-section-note">'+tasks.length+' công việc đang mở. '+time+'</p>'+
      note+tabs+search+
      (shown.length?'<div class="cr-queue">'+shown.slice(0,state.visibleCount).map(function(t){
        return queueTask(t,modules,today);
      }).join("")+'</div>':
      '<div class="cr-empty"><strong>Không có việc khớp bộ lọc.</strong><span>Thử bộ lọc khác hoặc mở hàng đợi đầy đủ.</span></div>')+
      (shown.length>state.visibleCount?'<button type="button" class="cr-more" data-cr-more>'+
        'Xem thêm '+Math.min(5,shown.length-state.visibleCount)+' việc ('+
        Math.min(state.visibleCount,shown.length)+' / '+shown.length+')</button>':
        shown.length?'<p class="cr-end">Đang xem '+shown.length+' / '+tasks.length+' việc đang mở.</p>':"");
  }
  function renderReviews(body){
    if(!body)return '<div class="cr-error" role="status">Không đọc được hàng đợi duyệt. <button type="button" data-cr-refresh>Thử lại</button></div>';
    var items=Array.isArray(body.items)?body.items:[];
    var history=Array.isArray(body.history)?body.history:[];
    var proposals=items.length?'<div class="cr-proposals">'+items.slice(0,4).map(function(p){
      var number=Number(p.number)||0;
      return '<a class="cr-proposal" href="reviews.html?pr='+number+'"><span class="cr-proposal-state">'+
        (p.draft?"PR nháp":"Đề xuất mở")+'</span>'+
        '<strong>'+esc(p.title||"Đề xuất CMS #"+number)+'</strong>'+
        '<small>#'+number+' · '+esc(when(p.updated_at))+'</small>'+
        '<span class="cr-proposal-arrow" aria-hidden="true">↗</span></a>';
    }).join("")+'</div>':
    '<div class="cr-empty"><strong>Chưa có đề xuất CMS đang mở.</strong>'+
    '<span>Bản nháp trên thiết bị chưa phải đề xuất gửi duyệt.</span></div>';
    var recent=history.length?'<div class="cr-history-note">'+
      '<strong>Đã merge gần đây</strong>'+
      '<span>Merge chưa xác nhận nội dung đã lên website. Kiểm tra trạng thái triển khai riêng.</span>'+
      history.slice(0,3).map(function(p){
        var number=Number(p.number)||0;
        var href=number>0?"https://github.com/kenzuko/jotrip-home/pull/"+number:"reviews.html";
        return '<a class="cr-history-link" href="'+href+'" target="_blank" rel="noopener">'+
          '<span>'+esc(p.title||"PR #"+number)+'</span><small>#'+number+' · '+esc(when(p.merged_at))+'</small></a>';
      }).join("")+'</div>':"";
    return '<div class="cr-section-heading"><div><p class="cr-eyebrow">BIÊN TẬP</p><h2>Chờ duyệt</h2></div>'+
      '<a href="reviews.html">Mở hàng đợi ↗</a></div>'+
      '<p class="cr-section-note">'+esc(items.length)+' đề xuất. Chỉ lên website sau khi kiểm tra, merge và xác nhận triển khai.</p>'+
      proposals+recent;
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
      '<section class="cr-panel" id="crQuality" aria-label="Công việc chất lượng">'+(state.loading?'<div class="cr-loading" role="status">Đang đọc công việc từ CMS...</div>':renderQuality(quality,state.modules,state))+'</section>'+
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
    active.host.removeEventListener("keydown",active.keydown);
    active=null;
  }
  function mount(opts){
    unmount();
    var state={active:true,host:opts.host,role:opts.role,login:opts.login,modules:opts.modules.filter(function(m){return m.read?.includes(opts.role);}),quality:null,reviews:null,loading:false,controller:null,qualityFilter:"all",searchTerm:"",visibleCount:5,preview:Boolean(opts.previewData)};
    state.click=function(event){
      if(event.target.closest("[data-cr-more]")&&!state.preview){
        event.preventDefault();state.visibleCount+=5;render(state);return;
      }
      if(event.target.closest("[data-cr-search-clear]")&&!state.preview){
        event.preventDefault();state.searchTerm="";state.visibleCount=5;render(state);return;
      }
      if(event.target.closest("[data-cr-search-submit]")&&!state.preview){
        event.preventDefault();
        state.searchTerm=state.host.querySelector("[data-cr-search]")?.value.trim()||"";
        state.visibleCount=5;render(state);return;
      }
      var filterButton=event.target.closest("[data-cr-filter]");
      if(filterButton&&!state.preview){
        event.preventDefault();
        var filter=filterButton.getAttribute("data-cr-filter");
        if(["all","priority","progress","mine","late","soon"].includes(filter)){
          state.qualityFilter=filter;state.visibleCount=5;render(state);
        }
        return;
      }
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
    state.keydown=function(event){
      if(event.key==="Enter"&&event.target.matches("[data-cr-search]")&&!state.preview){
        event.preventDefault();state.searchTerm=event.target.value.trim();
        state.visibleCount=5;render(state);
      }
    };
    active=state;
    state.host.addEventListener("click",state.click);
    state.host.addEventListener("keydown",state.keydown);
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