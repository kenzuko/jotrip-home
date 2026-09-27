/* Open Phu Quoc CMS V2 - quality workbench.
   Read-only filtering is client-side; status mutations remain admin/D1 gated. */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const names={
  VENUE_COORDINATE_MISSING:"Địa điểm thiếu tọa độ hợp lệ",
  VENUE_COORDINATE_EVIDENCE_INCOMPLETE:"Pin cần thêm chứng cứ",
  VENUE_SOURCE_MISSING:"Địa điểm thiếu nguồn",
  VENUE_CHECK_DATE_MISSING:"Địa điểm thiếu ngày kiểm tra",
  FOOD_ARTICLE_GAP:"Món chưa ghép với bài cũ",
  FOOD_PILOT_NO_READY_VENUES:"Chưa có quán đủ điều kiện gợi ý",
  FOOD_VENUE_RELATIONSHIPS_NOT_MODELED:"Chưa có dữ liệu món bán tại quán"
};
const severity={high:"Cần ưu tiên",medium:"Cần bổ sung",low:"Theo dõi"};
const when=value=>{
  if(!value)return"Chưa có thời gian";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"Chưa rõ":date.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"medium",timeStyle:"short"});
};
const today=()=>{
  const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=k=>p.find(x=>x.type===k)?.value||"";
  return part("year")+"-"+part("month")+"-"+part("day");
};
const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase().trim();
const state={
  tasks:[],proposals:[],history:[],storage:null,canManage:false,login:"",
  qualityReady:false,reviewsReady:false,filter:"open",query:"",pageSize:10,busy:false,writing:false
};
function entityName(task){
  const evidence=String(task.evidence||"");
  const matched=evidence.match(/^(.{2,95}?)\s+(?:đang ACTIVE|có tọa độ|có thực thể món)(?=\s|$)/i);
  return matched&&!/[/\\=_]/.test(matched[1])?matched[1].trim():null;
}
function taskHref(task){
  const id=String(task.entity_id||"").trim(),rule=String(task.rule_id||"");
  if(!id)return"";
  const module=rule==="FOOD_ARTICLE_GAP"?"foods":rule.startsWith("VENUE_")?"venues":null;
  if(!module)return"";
  return "index.html?module="+module+"&record="+encodeURIComponent(id)+
    "&field="+encodeURIComponent(task.field||"");
}
function datePill(task){
  if(!task.due_at)return"";
  const raw=String(task.due_at).slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return"";
  const late=raw<today(),near=!late&&Date.parse(raw+"T00:00:00Z")-Date.parse(today()+"T00:00:00Z")<=2*86400000;
  return '<span class="due-pill '+(late?"overdue":near?"soon":"")+'">'+
    (late?"Quá hạn ":near?"Sắp hạn ":"Hạn ")+esc(raw.slice(8)+"/"+raw.slice(5,7)+"/"+raw.slice(0,4))+"</span>";
}
function sortQualityTasks(tasks){
  const rank={high:0,medium:1,low:2};
  return tasks.slice().sort((a,b)=>
    (rank[a.severity]??3)-(rank[b.severity]??3)||
    String(a.due_at||"9999").localeCompare(String(b.due_at||"9999"))||
    String(a.surface||"").localeCompare(String(b.surface||""),"vi")
  );
}
function renderQualityTasks(tasks,canManage=false,storage="computed-from-main"){
  if(!tasks.length)return'<div class="empty"><strong>Không có việc trong nhóm này</strong>Đổi bộ lọc hoặc xem những việc đã xử lý.</div>';
  return sortQualityTasks(tasks).map(task=>{
    const key=[task.rule_id,task.entity_id||"",task.field].join("|");
    const title=entityName(task),rule=names[task.rule_id]||task.rule_id||"Việc cần kiểm chứng";
    const href=taskHref(task);
    const action=href?'<a class="task-action" href="'+esc(href)+'">Mở đúng trường →</a>':
      '<a class="task-action" href="index.html?module=dashboard">Mở bàn làm việc →</a>';
    const statusLabel={open:"Chưa nhận",in_progress:"Đang xử lý",resolved:"Đã xử lý",muted:"Tạm ẩn"}[task.status]||"Cần kiểm tra";
    const writable=canManage&&storage==="d1";
    const controls=writable?'<div class="task-controls" data-task-key="'+esc(key)+'">'+
      (task.status==="resolved"||task.status==="muted"?
      '<button type="button" data-quality-action="reopen">Mở lại</button>':
      (task.status!=="in_progress"?'<button type="button" data-quality-action="claim">Nhận việc</button>':"")+
      '<button type="button" data-quality-action="resolve">Đã xử lý</button>'+
      '<button type="button" data-quality-action="mute">Ẩn 7 ngày</button>')+
      '<label class="task-due-label">Hạn xử lý<input type="date" data-quality-due value="'+
      esc(String(task.due_at||"").slice(0,10))+'"></label>'+
      '<button type="button" data-quality-action="due">Lưu hạn</button></div>':"";
    return'<article class="task-card" data-quality-card>'+
      '<div class="task-head"><div><p class="task-eyebrow">'+esc(task.surface||"Thông tin")+" · "+
      esc(rule)+'</p><h3 class="task-title">'+esc(title||rule)+'</h3>'+
      (title?'<span class="record-id">'+esc(String(task.entity_id||""))+'</span>':"")+
      '</div><div class="task-pills"><span class="pill '+esc(task.severity)+'">'+
      esc(severity[task.severity]||"Cần xem")+'</span><span class="pill">'+
      esc(statusLabel)+'</span></div></div>'+
      '<p class="task-evidence">'+esc(task.evidence||"")+'</p>'+
      '<p class="task-next"><strong>Bước tiếp theo:</strong> '+esc(task.next_action||"Mở hồ sơ và đối chiếu nguồn.")+'</p>'+
      '<div class="task-meta">'+(task.owner?'<span>Phụ trách: <strong>'+esc(task.owner)+'</strong></span>':
      '<span>Chưa phân công</span>')+datePill(task)+'</div>'+
      action+controls+'</article>';
  }).join("");
}
function renderReviewTasks(items){
  if(!items.length)return'<div class="empty"><strong>Chưa có đề xuất chờ duyệt</strong>Bản nháp trên máy không phải PR.</div>';
  return items.slice(0,4).map(item=>{
    const number=Number(item.number);
    const stats=[item.changed_files,item.additions,item.deletions].every(Number.isFinite)
      ?item.changed_files+" tệp thay đổi · +"+item.additions+" / −"+item.deletions+" dòng"
      :"Chi tiết số tệp và dòng: xem PR GitHub";
    return'<article class="task-card review-task"><div class="task-head"><h3 class="task-title">'+
      esc(item.title||"Đề xuất #"+number)+'</h3><div class="task-pills"><span class="pill">'+
      (item.draft?"PR nháp":"PR đang mở")+'</span><span class="pill">#'+number+'</span></div></div>'+
      '<p class="task-evidence">Người gửi: '+esc(item.author?"@"+item.author:"Không rõ")+
      ' · Cập nhật '+esc(when(item.updated_at))+'</p><p class="task-next">'+
      esc(stats)+'</p>'+
      '<a class="task-action" href="reviews.html?pr='+number+'">Mở diff và kiểm tra →</a></article>';
  }).join("");
}
function renderMergedHistory(items){
  if(!items.length)return'<div class="empty"><strong>Chưa có PR CMS merge gần đây</strong></div>';
  return items.slice(0,4).map(item=>{
    const number=Number(item.number);
    return'<article class="history-task"><div><strong>'+esc(item.title||"PR #"+number)+'</strong>'+
      '<span>#'+number+' · '+esc(item.author?"@"+item.author:"Không rõ")+
      ' · '+esc(when(item.merged_at))+'</span></div><a href="https://github.com/kenzuko/jotrip-home/pull/'+number+
      '" target="_blank" rel="noopener noreferrer">Mở PR ↗</a></article>';
  }).join("");
}
function countOpenWork(tasks,proposals){return tasks.length+proposals.length}
function matches(t){
  const q=normalize(state.query);
  return !q||normalize([entityName(t),t.entity_id,t.rule_id,names[t.rule_id],
    t.evidence,t.next_action,t.surface,t.owner].join(" ")).includes(q);
}
function filtered(){
  const date=today();
  return state.tasks.filter(t=>{
    if(state.filter==="open"&&["resolved","muted"].includes(t.status))return false;
    if(state.filter==="priority"&&(t.severity!=="high"||["resolved","muted"].includes(t.status)))return false;
    if(state.filter==="progress"&&t.status!=="in_progress")return false;
    if(state.filter==="mine"&&(!state.login||t.owner?.toLowerCase()!==state.login.toLowerCase()||["resolved","muted"].includes(t.status)))return false;
    if(state.filter==="late"&&(state.storage!=="d1"||!t.due_at||String(t.due_at).slice(0,10)>=date||["resolved","muted"].includes(t.status)))return false;
    if(state.filter==="closed"&&!["resolved","muted"].includes(t.status))return false;
    return matches(t);
  });
}
function syncControls(){
  const d1=state.storage==="d1";
  for(const button of document.querySelectorAll("[data-work-filter]")){
    const f=button.dataset.workFilter,needsD1=f==="mine"||f==="late";
    button.disabled=needsD1&&(!d1||(f==="mine"&&!state.login));
    button.setAttribute("aria-pressed",String(state.filter===f));
  }
}
function renderQueue(){
  if(!state.qualityReady)return;
  const tasks=sortQualityTasks(filtered());
  const visible=tasks.slice(0,state.pageSize);
  $("#qualityQueue").innerHTML=renderQualityTasks(visible,state.canManage,state.storage);
  $("#workCount").textContent=tasks.length+" việc khớp bộ lọc · "+
    state.tasks.filter(t=>!["resolved","muted"].includes(t.status)).length+" việc đang mở";
  const more=$("#workMore");
  more.hidden=tasks.length<=state.pageSize;
  more.textContent="Xem thêm "+Math.min(10,tasks.length-state.pageSize)+" việc ("+
    Math.min(tasks.length,state.pageSize)+"/"+tasks.length+")";
  syncControls();
}
async function requestJson(url,options={}){
  const response=await fetch(url,{credentials:"include",cache:"no-store",...options});
  const result=await response.json().catch(()=>({}));
  return{response,result};
}
async function load(force=false){
  if(state.busy&&!force)return;
  state.busy=true;$("#refresh").disabled=true;
  $("#notice").className="notice hidden";
  $("#qualityQueue").innerHTML='<div class="loading">Đang kiểm tra chất lượng dữ liệu…</div>';
  $("#reviewQueue").innerHTML='<div class="loading">Đang tải đề xuất…</div>';
  $("#mergedQueue").innerHTML='<div class="loading">Đang tải lịch sử…</div>';
  try{
    const [quality,reviews,session]=await Promise.allSettled([
      requestJson("/api/cms/quality"),requestJson("/api/cms/reviews"),
      requestJson("/api/cms/session")
    ]);
    const q=quality.status==="fulfilled"?quality.value:null;
    const r=reviews.status==="fulfilled"?reviews.value:null;
    const s=session.status==="fulfilled"?session.value:null;
    if(q?.response.status===401||r?.response.status===401){
      state.qualityReady=false;state.reviewsReady=false;
      $("#total").textContent="—";$("#checked").textContent="Cần đăng nhập CMS";
      $("#qualityQueue").innerHTML='<div class="empty"><strong>Phiên đăng nhập hết hạn</strong><a class="task-action" href="index.html">Đăng nhập lại →</a></div>';
      $("#reviewQueue").innerHTML="";$("#mergedQueue").innerHTML="";return false;
    }
    state.qualityReady=Boolean(q?.response.ok&&Array.isArray(q?.result.tasks));
    state.reviewsReady=Boolean(r?.response.ok&&Array.isArray(r?.result.items));
    if(state.qualityReady){
      state.tasks=q.result.tasks;state.canManage=Boolean(q.result.can_manage);
      state.storage=q.result.storage||null;
      state.login=s?.response.ok?String(s.result.login||""):"";
      if((state.storage!=="d1"||!state.login)&&["mine","late"].includes(state.filter))state.filter="open";
      $("#sourceState").textContent=state.storage==="d1"?"Nguồn: main · trạng thái công việc: D1":
        "Nguồn: main · chưa có trạng thái phân công từ D1";
      renderQueue();
    }else{
      $("#workCount").textContent="Chưa tải được công việc";
      $("#qualityQueue").innerHTML='<div class="empty"><strong>Không đọc được dữ liệu chất lượng</strong>Thử tải lại. Không xem dữ liệu thiếu là không có việc.</div>';
      $("#workMore").hidden=true;
    }
    if(state.reviewsReady){
      state.proposals=r.result.items;state.history=r.result.history||[];
      $("#reviewQueue").innerHTML=renderReviewTasks(state.proposals);
      $("#mergedQueue").innerHTML=renderMergedHistory(state.history);
    }else{
      $("#reviewQueue").innerHTML='<div class="empty"><strong>Không đọc được đề xuất</strong>Kiểm tra phiên đăng nhập và tải lại.</div>';
      $("#mergedQueue").innerHTML="";
    }
    const open=state.qualityReady?state.tasks.filter(t=>!["resolved","muted"].includes(t.status)).length:null;
    $("#total").textContent=open!==null&&state.reviewsReady?
      String(countOpenWork(state.tasks.filter(t=>!["resolved","muted"].includes(t.status)),state.proposals)):"—";
    const times=[q?.result?.computed_at,r?.result?.checked_at].filter(Boolean).map(Date.parse).filter(Number.isFinite);
    $("#checked").textContent=times.length?"Cập nhật lúc "+when(new Date(Math.max(...times)).toISOString()):"Chưa rõ thời gian cập nhật";
    const errors=[];
    if(!state.qualityReady)errors.push(q?.result?.detail||q?.result?.error||"Không tải được công việc");
    if(!state.reviewsReady)errors.push(r?.result?.detail||r?.result?.error||"Không tải được đề xuất");
    if(errors.length){$("#notice").textContent=errors.join(" · ");$("#notice").className="notice error";}
    else{$("#notice").textContent="Việc chất lượng được tính từ main. Nhận việc, hạn xử lý và lịch sử thao tác dựa trên trạng thái D1 khi có kết nối. Merge chưa xác nhận deploy.";
      $("#notice").className="notice";}
    return state.qualityReady;
  }catch(error){
    $("#qualityQueue").innerHTML='<div class="empty"><strong>Chưa thể tải công việc</strong>Kiểm tra kết nối rồi thử lại.</div>';
    $("#reviewQueue").innerHTML="";$("#mergedQueue").innerHTML="";
    $("#total").textContent="—";$("#notice").textContent=error?.message||"Lỗi không xác định";
    $("#notice").className="notice error";
    state.qualityReady=false;
    return false;
  }finally{state.busy=false;$("#refresh").disabled=false;}
}
function qualityWriteConfirmed(taskKey,action,due){
  if(!state.qualityReady||state.storage!=="d1")return false;
  const saved=state.tasks.find(item=>[item.rule_id,item.entity_id||"",item.field].join("|")===taskKey);
  if(!saved||saved.persistence!=="d1")return false;
  if(action==="due")return (saved.due_at||"")===(due||"");
  if(action==="claim")return saved.status==="in_progress"&&(!state.login||saved.owner===state.login);
  if(action==="resolve")return saved.status==="resolved";
  if(action==="mute")return saved.status==="muted";
  if(action==="reopen")return saved.status==="open";
  return false;
}
$("#qualityQueue").addEventListener("click",async event=>{
  const button=event.target.closest("[data-quality-action]");
  if(!button||state.writing||!state.canManage||state.storage!=="d1")return;
  const key=button.closest("[data-task-key]")?.dataset.taskKey,action=button.dataset.qualityAction;
  if(!key||!action)return;
  if(action==="resolve"&&!confirm("Đã kiểm chứng và cập nhật nội dung thật? Đánh dấu đã xử lý chỉ khi hồ sơ đã đúng."))return;
  if(action==="mute"&&!confirm("Tạm ẩn công việc này 7 ngày? Dữ liệu nguồn không bị thay đổi."))return;
  const area=button.closest("[data-task-key]");
  const due=area?.querySelector("[data-quality-due]")?.value||"";
  state.writing=true;area.querySelectorAll("button,input").forEach(el=>el.disabled=true);
  $("#notice").textContent="Đang lưu "+(action==="due"?"hạn xử lý":"trạng thái công việc")+"…";
  $("#notice").className="notice";
  try{
    const {response,result}=await requestJson("/api/cms/quality",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({task_key:key,action,due_at:due})
    });
    if(!response.ok)throw Error(result.detail||result.error||"Không lưu được trạng thái.");
    // Force-refresh while the action is running; previous code called load()
    // inside a locked handler and silently skipped it.
    const reloaded=await load(true);
    if(reloaded&&qualityWriteConfirmed(key,action,due)){
      $("#notice").textContent="Đã lưu và kiểm tra lại trạng thái từ CMS.";
      $("#notice").className="notice success";
    }else{
      $("#notice").textContent="Đã gửi thao tác nhưng chưa xác minh được trạng thái lưu trên CMS. Hãy tải lại trước khi thao tác tiếp.";
      $("#notice").className="notice error";
    }
  }catch(error){
    $("#notice").textContent=error?.message||"Không lưu được. Thử lại.";
    $("#notice").className="notice error";
    if(area.isConnected)area.querySelectorAll("button,input").forEach(el=>el.disabled=false);
  }finally{state.writing=false;}
});
$("#workSearch").addEventListener("input",event=>{
  state.query=event.target.value;state.pageSize=10;renderQueue();
});
document.querySelectorAll("[data-work-filter]").forEach(button=>button.addEventListener("click",()=>{
  if(button.disabled)return;
  state.filter=button.dataset.workFilter;state.pageSize=10;renderQueue();
}));
$("#workMore").addEventListener("click",()=>{state.pageSize+=10;renderQueue();});
$("#workClear").addEventListener("click",()=>{
  state.filter="open";state.query="";state.pageSize=10;
  $("#workSearch").value="";renderQueue();
});
$("#refresh").addEventListener("click",()=>load());
load();
