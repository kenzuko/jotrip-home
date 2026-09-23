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
let busy=false;
async function load(){
  if(busy)return;
  busy=true;$("#refresh").disabled=true;$("#notice").className="notice hidden";$("#queue").innerHTML='<div class="loading">Đang tổng hợp việc cần xử lý…</div>';
  try{
    const response=await fetch("/api/cms/quality",{credentials:"include",cache:"no-store"});
    const result=await response.json().catch(()=>({}));
    if(response.status===401){
      $("#total").textContent="—";$("#checked").textContent="Cần đăng nhập";
      $("#queue").innerHTML='<div class="empty"><strong>Đăng nhập CMS để xem</strong><a class="task-action" href="index.html">Đăng nhập CMS →</a></div>';return;
    }
    if(!response.ok)throw new Error(result.detail||result.error||"Không tải được danh sách việc.");
    const tasks=Array.isArray(result.tasks)?result.tasks:[];
    const rank={high:0,medium:1,low:2};
    tasks.sort((a,b)=>(rank[a.severity]??3)-(rank[b.severity]??3)||String(a.surface||"").localeCompare(String(b.surface||""),"vi"));
    $("#total").textContent=String(result.count??tasks.length);
    const date=new Date(result.computed_at||Date.now());
    $("#checked").textContent="Tính lại lúc "+date.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"});
    if(!tasks.length){$("#queue").innerHTML='<div class="empty"><strong>Chưa có việc được phát hiện</strong>Dữ liệu được tính lại mỗi lần mở trang.</div>';return}
    $("#queue").innerHTML=tasks.map(task=>{
      const id=String(task.entity_id||"");
      const isFood=id.startsWith("food_");
      const path=isFood?"index.html?module=foods&record=":"index.html?module=venues&record=";
      const field=String(task.field||"");
      const action=id?'<a class="task-action" href="'+path+encodeURIComponent(id)+"&field="+encodeURIComponent(field)+'">Mở đúng trường →</a>':"";
      return '<article class="task-card"><div class="task-head"><h2 class="task-title">'+esc(names[task.rule_id]||task.rule_id||"Việc cần xử lý")+'</h2><div class="task-pills"><span class="pill '+esc(task.severity)+'">'+esc(severity[task.severity]||"Cần xem")+'</span><span class="pill">'+esc(task.surface||"")+'</span></div></div><p class="task-evidence">'+esc(task.evidence||"")+'</p><p class="task-next"><strong>Bước kế tiếp:</strong> '+esc(task.next_action||"Mở dữ liệu và kiểm tra nguồn.")+'</p>'+action+'</article>';
    }).join("");
    if(result.note){$("#notice").textContent=result.note;$("#notice").className="notice"}
  }catch(error){
    $("#queue").innerHTML='<div class="empty"><strong>Chưa tải được danh sách</strong>Kiểm tra kết nối rồi thử lại.</div>';
    $("#notice").textContent=error.message||"Lỗi không xác định";$("#notice").className="notice error";
  }finally{busy=false;$("#refresh").disabled=false}
}
$("#refresh").addEventListener("click",load);
load();
