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
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":date.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"medium",timeStyle:"short"});
};
let busy=false;
function renderQualityTasks(tasks,canManage=false){
  if(!tasks.length)return '<div class="empty"><strong>Chưa phát hiện việc chất lượng</strong>Dữ liệu được tính lại mỗi lần tải.</div>';
  const rank={high:0,medium:1,low:2};
  return tasks.slice().sort((a,b)=>(rank[a.severity]??3)-(rank[b.severity]??3)||String(a.surface||"").localeCompare(String(b.surface||""),"vi")).map(task=>{
    const id=String(task.entity_id||"");
    const isFood=id.startsWith("food_");
    const path=isFood?"index.html?module=foods&record=":"index.html?module=venues&record=";
    const field=String(task.field||"");
    const href=path+encodeURIComponent(id)+"&field="+encodeURIComponent(field);
    const action=id?'<a class="task-action" href="'+esc(href)+'">Mở đúng trường →</a>':"";
    const key=[task.rule_id,task.entity_id||"",task.field].join("|");
    const stateLabel={open:"Chưa nhận",in_progress:"Đang xử lý",resolved:"Đã xử lý",muted:"Đang tạm ẩn"}[task.status]||"Chưa nhận";
    const controls=canManage?'<div class="task-controls" data-task-key="'+esc(key)+'">'+(task.status==="resolved"||task.status==="muted"?'<button type="button" data-quality-action="reopen">Mở lại</button>':'<button type="button" data-quality-action="claim">Nhận việc</button><button type="button" data-quality-action="resolve">Đã xử lý</button><button type="button" data-quality-action="mute">Ẩn 7 ngày</button>')+'<label class="task-due-label">Hạn xử lý<input type="date" data-quality-due value="'+esc(String(task.due_at||"").slice(0,10))+'"></label><button type="button" data-quality-action="due">Lưu hạn</button></div>':"";
    const owner=task.owner?'<p class="task-owner">Phụ trách: '+esc(task.owner)+(task.due_at?' · Hạn '+esc(when(task.due_at)):"")+'</p>':"";
    return '<article class="task-card"><div class="task-head"><h3 class="task-title">'+esc(names[task.rule_id]||task.rule_id||"Việc cần xử lý")+'</h3><div class="task-pills"><span class="pill '+esc(task.severity)+'">'+esc(severity[task.severity]||"Cần xem")+'</span><span class="pill">'+esc(task.surface||"")+'</span><span class="pill">'+esc(stateLabel)+'</span></div></div><p class="task-evidence">'+esc(task.evidence||"")+'</p><p class="task-next"><strong>Bước kế tiếp:</strong> '+esc(task.next_action||"Mở dữ liệu và kiểm tra nguồn.")+'</p>'+owner+action+controls+'</article>';
  }).join("");
}
function renderReviewTasks(items){
  if(!items.length)return '<div class="empty"><strong>Không có đề xuất đang chờ</strong>Đề xuất CMS sẽ hiện ở đây sau khi được gửi duyệt.</div>';
  return items.map(item=>{
    const number=Number(item.number);
    const state=item.draft?"Bản nháp":"Sẵn sàng xem xét";
    return '<article class="task-card review-task"><div class="task-head"><h3 class="task-title">'+esc(item.title||"Đề xuất CMS #"+number)+'</h3><div class="task-pills"><span class="pill">'+state+'</span><span class="pill">#'+number+'</span></div></div><p class="task-evidence">Người gửi: '+esc(item.author?"@"+item.author:"Không rõ")+' · Cập nhật '+esc(when(item.updated_at))+'</p><p class="task-next">'+Number(item.changed_files||0)+' tệp thay đổi · +'+Number(item.additions||0)+' / −'+Number(item.deletions||0)+' dòng</p><a class="task-action" href="reviews.html?pr='+number+'">Mở diff và kiểm tra →</a></article>';
  }).join("");
}
function renderMergedHistory(items){
  if(!items.length)return '<div class="empty"><strong>Chưa có thay đổi CMS được merge gần đây</strong></div>';
  return items.slice(0,5).map(item=>{
    const number=Number(item.number);
    return '<article class="history-task"><div><strong>'+esc(item.title||"Thay đổi CMS #"+number)+'</strong><span>#'+number+' · '+esc(item.author?"@"+item.author:"Không rõ")+' · '+esc(when(item.merged_at))+'</span></div><a href="https://github.com/kenzuko/jotrip-home/pull/'+number+'" target="_blank" rel="noopener">Mở PR ↗</a></article>';
  }).join("");
}
function countOpenWork(tasks,proposals){return tasks.length+proposals.length}
async function requestJson(url,options={}){
  const response=await fetch(url,{credentials:"include",cache:"no-store",...options});
  const result=await response.json().catch(()=>({}));
  return{response,result};
}
async function load(){
  if(busy)return;
  busy=true;
  $("#refresh").disabled=true;
  $("#notice").className="notice hidden";
  $("#qualityQueue").innerHTML='<div class="loading">Đang kiểm tra chất lượng dữ liệu…</div>';
  $("#reviewQueue").innerHTML='<div class="loading">Đang tải đề xuất duyệt…</div>';
  $("#mergedQueue").innerHTML='<div class="loading">Đang tải lịch sử…</div>';
  try{
    const [quality,reviews]=await Promise.all([
      requestJson("/api/cms/quality"),
      requestJson("/api/cms/reviews")
    ]);
    if(quality.response.status===401||reviews.response.status===401){
      $("#total").textContent="—";$("#checked").textContent="Cần đăng nhập";
      $("#qualityQueue").innerHTML='<div class="empty"><strong>Đăng nhập CMS để xem</strong><a class="task-action" href="index.html">Đăng nhập CMS →</a></div>';
      $("#reviewQueue").innerHTML="";$("#mergedQueue").innerHTML="";
      return;
    }
    const problems=[];
    if(!quality.response.ok)problems.push(quality.result.detail||quality.result.error||"Không tải được tín hiệu chất lượng.");
    if(!reviews.response.ok)problems.push(reviews.result.detail||reviews.result.error||"Không tải được đề xuất duyệt.");
    const tasks=quality.response.ok&&Array.isArray(quality.result.tasks)?quality.result.tasks:[];
    const proposals=reviews.response.ok&&Array.isArray(reviews.result.items)?reviews.result.items:[];
    const history=reviews.response.ok&&Array.isArray(reviews.result.history)?reviews.result.history:[];
    $("#qualityQueue").innerHTML=quality.response.ok?renderQualityTasks(tasks,quality.result.can_manage):'<div class="empty"><strong>Chưa tải được tín hiệu chất lượng</strong>Thử tải lại sau.</div>';
    $("#reviewQueue").innerHTML=reviews.response.ok?renderReviewTasks(proposals):'<div class="empty"><strong>Chưa tải được đề xuất duyệt</strong>Thử tải lại sau.</div>';
    $("#mergedQueue").innerHTML=reviews.response.ok?renderMergedHistory(history):"";
    $("#total").textContent=String(countOpenWork(tasks.filter(t=>!["resolved","muted"].includes(t.status)),proposals));
    document.querySelectorAll("[data-quality-action]").forEach(button=>button.addEventListener("click",async()=>{
      const key=button.closest("[data-task-key]")?.dataset.taskKey,action=button.dataset.qualityAction;
      if(!key||!action)return;
      button.disabled=true;
      try{
        const {response,result}=await requestJson("/api/cms/quality",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task_key:key,action,due_at:button.closest("[data-task-key]")?.querySelector("[data-quality-due]")?.value||""})});
        if(!response.ok)throw new Error(result.detail||result.error||"Không lưu được trạng thái.");
        await load();
      }catch(error){$("#notice").textContent=error.message;$("#notice").className="notice error";button.disabled=false}
    }));
    const times=[quality.result.computed_at,reviews.result.checked_at].filter(Boolean).map(Date.parse).filter(Number.isFinite);
    $("#checked").textContent=times.length?"Cập nhật lúc "+when(new Date(Math.max(...times)).toISOString()):"";
    if(problems.length){$("#notice").textContent=problems.join(" ");$("#notice").className="notice error"}
    else{$("#notice").textContent=(quality.result.note||"Việc chất lượng được tính lại từ main.")+" Trạng thái đề xuất lấy từ hàng đợi review. Merge chưa xác nhận deploy.";$("#notice").className="notice"}
  }catch(error){
    $("#qualityQueue").innerHTML='<div class="empty"><strong>Chưa tải được danh sách</strong>Kiểm tra kết nối rồi thử lại.</div>';
    $("#reviewQueue").innerHTML="";$("#mergedQueue").innerHTML="";
    $("#notice").textContent=error?.message||"Lỗi không xác định";$("#notice").className="notice error";
  }finally{busy=false;$("#refresh").disabled=false}
}
$("#refresh").addEventListener("click",load);
load();
