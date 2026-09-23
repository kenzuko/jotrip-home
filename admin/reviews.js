const $=selector=>document.querySelector(selector);
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const when=value=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":date.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"medium",timeStyle:"short"});
};

async function load(){
  const button=$("#refresh");
  button.disabled=true;
  $("#error").textContent="";
  $("#queue").innerHTML='<div class="loading">Đang tải hàng đợi…</div>';
  try{
    const response=await fetch("/api/cms/reviews",{credentials:"include",cache:"no-store"});
    const result=await response.json();
    if(response.status===401){
      $("#queue").innerHTML='<div class="empty"><h3>Cần đăng nhập CMS</h3><a class="action" href="/admin/">Đăng nhập</a></div>';
      $("#count").textContent="Chưa đăng nhập";
      return;
    }
    if(!response.ok)throw new Error(result.detail||result.error||"Không tải được hàng đợi");
    const items=Array.isArray(result.items)?result.items:[];
    $("#count").textContent=items.length===1?"1 đề xuất đang mở":items.length+" đề xuất đang mở";
    $("#checked").textContent="Kiểm tra lúc "+when(result.checked_at);
    if(!items.length){
      $("#queue").innerHTML='<div class="empty"><h3>Chưa có đề xuất nào</h3><p>Khi biên tập viên gửi nội dung duyệt từ CMS, đề xuất sẽ xuất hiện ở đây.</p><a class="action secondary" href="index.html">Về nội dung</a></div>';
    }else{
      $("#queue").innerHTML=items.map(item=>{
        const state=item.draft?"Bản nháp":"Sẵn sàng xem xét";
        const author=item.author?"@"+item.author:"Không rõ người gửi";
        return '<article class="card"><div class="card-head"><span class="state '+(item.draft?"draft":"ready")+'">'+state+'</span><span class="number">#'+Number(item.number)+'</span></div><h3>'+esc(item.title)+'</h3><p class="meta">Người gửi: '+esc(author)+' · Cập nhật '+esc(when(item.updated_at))+'</p><p class="detail">'+Number(item.changed_files)+' tệp thay đổi · +'+Number(item.additions)+' / −'+Number(item.deletions)+' dòng</p><div class="actions"><button class="action secondary field-toggle" type="button" data-pr="'+Number(item.number)+'">Xem diff theo trường</button><a class="action" href="'+esc(item.url)+'" target="_blank" rel="noopener">Mở PR trên GitHub ↗</a></div><div class="field-diff hidden" id="diff-'+Number(item.number)+'"></div></article>';
      }).join("");
      document.querySelectorAll(".field-toggle").forEach(button=>button.addEventListener("click",()=>showDiff(button)));
    }
    renderHistory(result.history||[]);
    loadQuality();
  }catch(error){
    $("#count").textContent="Chưa tải được hàng đợi";
    $("#queue").innerHTML="";
    $("#error").textContent=error?.message||"Không tải được hàng đợi duyệt.";
  }finally{
    button.disabled=false;
  }
}




async function loadQuality(){
  const host=$("#quality");
  try{
    const response=await fetch("/api/cms/quality",{credentials:"include",cache:"no-store"});
    const result=await response.json();
    if(!response.ok)throw new Error(result.detail||result.error||"Không tải được tín hiệu chất lượng");
    const items=Array.isArray(result.tasks)?result.tasks:[];
    if(!items.length){host.innerHTML='<div class="empty"><p>Chưa phát hiện việc cần kiểm tra theo các quy tắc hiện có.</p></div>';return}
    host.innerHTML=items.map(item=>{
      const module=item.surface==="Cẩm nang món ăn"?"foods":"venues";
      const action=item.severity==="high"?"Cần xử lý":item.severity==="medium"?"Nên kiểm tra":"Khoảng trống nội dung";
      const recordQuery=item.entity_id&&module==="venues"?"&record="+encodeURIComponent(item.entity_id)+"&field="+encodeURIComponent(item.field||""):"";
      return '<article class="card quality-card"><div class="card-head"><span class="severity '+esc(item.severity)+'">'+action+'</span><span class="number">'+esc(item.rule_id)+'</span></div><h3>'+esc(item.entity_id||item.surface)+'</h3><p class="meta">Trường: '+esc(item.field)+' · Mục: '+esc(item.surface)+' · Người phụ trách: '+esc(item.owner||"Chưa gán")+'</p><p class="detail">'+esc(item.evidence)+'</p><p class="detail"><strong>Bước tiếp theo:</strong> '+esc(item.next_action)+'</p><a class="action secondary" href="index.html?module='+encodeURIComponent(module)+recordQuery+'">Mở mục '+(module==="foods"?"Món ăn":"Địa điểm")+' trong CMS</a></article>';
    }).join("");
  }catch(error){
    host.innerHTML='<div class="empty"><p class="error">'+esc(error?.message||"Không tải được hàng đợi chất lượng.")+'</p></div>';
  }
}

function renderHistory(items){
  const host=$("#history");
  if(!items.length){host.innerHTML='<div class="empty"><p>Chưa có thay đổi CMS nào được merge.</p></div>';return}
  host.innerHTML=items.map(item=>{
    const rollback=item.can_rollback?'<button class="action secondary rollback" type="button" data-pr="'+Number(item.number)+'">Tạo PR rollback</button>':"";
    return '<article class="card history-card"><div class="card-head"><span class="state merged">Đã merge</span><span class="number">#'+Number(item.number)+'</span></div><h3>'+esc(item.title)+'</h3><p class="meta">Người merge: '+esc(item.author||"Không rõ")+' · '+esc(when(item.merged_at))+' · '+Number(item.changed_files)+' tệp</p><p class="detail">Rollback sẽ tạo PR mới và chỉ dùng được nếu tệp chưa có sửa đổi mới hơn.</p><div class="actions"><a class="action secondary" href="'+esc(item.url)+'" target="_blank" rel="noopener">Mở PR đã merge ↗</a>'+rollback+'</div><p class="rollback-status" id="rollback-'+Number(item.number)+'"></p></article>';
  }).join("");
  document.querySelectorAll(".rollback").forEach(button=>button.addEventListener("click",()=>proposeRollback(button)));
}
async function proposeRollback(button){
  const number=Number(button.dataset.pr);
  if(!confirm("Tạo một PR mới để khôi phục nội dung ngay trước PR #"+number+"? Việc này chưa public cho tới khi cậu kiểm tra và merge PR rollback."))return;
  const status=$("#rollback-"+number);
  button.disabled=true;status.textContent="Đang kiểm tra xung đột và tạo PR…";
  try{
    const response=await fetch("/api/cms/rollback",{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify({pr_number:number})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.detail||result.error||"Không tạo được PR rollback");
    status.innerHTML='Đã tạo PR <a href="'+esc(result.pull_request.url)+'" target="_blank" rel="noopener">#'+Number(result.pull_request.number)+' ↗</a>';
    button.textContent="Đã tạo PR #"+Number(result.pull_request.number);
  }catch(error){status.textContent=error?.message||"Không tạo được PR rollback.";button.disabled=false}
}

async function showDiff(button){
  const pr=Number(button.dataset.pr),panel=$("#diff-"+pr);
  if(!panel)return;
  if(!panel.classList.contains("hidden")){panel.classList.add("hidden");return}
  panel.classList.remove("hidden");
  panel.innerHTML='<p class="loading">Đang so sánh từng trường với bản live…</p>';
  button.disabled=true;
  try{
    const response=await fetch("/api/cms/review-diff?pr="+pr,{credentials:"include",cache:"no-store"});
    const result=await response.json();
    if(!response.ok)throw new Error(result.detail||result.error||"Không tải được diff");
    const files=Array.isArray(result.fields)?result.fields:[];
    const rows=files.flatMap(file=>file.fields.map(change=>({path:file.path,...change})));
    if(!rows.length){panel.innerHTML='<p class="empty-diff">Không có trường thay đổi trong các tệp CMS được hỗ trợ.</p>';return}
    panel.innerHTML='<h4>Thay đổi theo trường · kiểm tra lúc '+esc(when(result.checked_at))+'</h4>'+rows.map(row=>'<div class="field-row"><strong>'+esc(row.path)+' · '+esc(row.field)+'</strong><div class="field-values"><pre class="old">'+esc(JSON.stringify(row.before,null,2)??"null")+'</pre><pre class="new">'+esc(JSON.stringify(row.after,null,2)??"null")+'</pre></div></div>').join("");
  }catch(error){panel.innerHTML='<p class="error">'+esc(error?.message||"Không tải được diff theo trường.")+'</p>'}
  finally{button.disabled=false}
}

$("#refresh").addEventListener("click",load);
load();
