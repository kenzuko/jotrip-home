const $=selector=>document.querySelector(selector);
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const when=value=>{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?"":date.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"medium",timeStyle:"short"});
};


const reviewState={items:[],filter:"all",query:"",visible:8,loading:false,firstOpen:true};
const normalizeReview=value=>String(value||"").normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase().trim();
function reviewMatches(item){
  if(reviewState.filter==="ready"&&item.draft)return false;
  if(reviewState.filter==="draft"&&!item.draft)return false;
  const q=normalizeReview(reviewState.query);
  return !q||normalizeReview([item.number,item.title,item.author].join(" ")).includes(q);
}
function renderQueue(){
  const filtered=reviewState.items.filter(reviewMatches);
  const visible=filtered.slice(0,reviewState.visible);
  $("#reviewShown").textContent=filtered.length+" / "+reviewState.items.length+
    " đề xuất khớp bộ lọc";
  document.querySelectorAll("[data-review-filter]").forEach(button=>
    button.setAttribute("aria-pressed",String(button.dataset.reviewFilter===reviewState.filter)));
  $("#reviewMore").hidden=filtered.length<=reviewState.visible;
  $("#reviewMore").textContent="Xem thêm "+Math.min(8,filtered.length-reviewState.visible)+
    " đề xuất ("+Math.min(reviewState.visible,filtered.length)+"/"+filtered.length+")";
  if(!visible.length){
    $("#queue").innerHTML='<div class="empty"><h3>'+
      (reviewState.items.length?"Không có đề xuất khớp bộ lọc":"Chưa có đề xuất nào")+
      '</h3><p>'+(reviewState.items.length?"Thử tìm bằng tên, số PR hoặc chọn bộ lọc khác.":"Đề xuất từ CMS sẽ hiện ở đây sau khi gửi duyệt.")+
      '</p></div>';
    return;
  }
  $("#queue").innerHTML=visible.map(item=>{
    const number=Number(item.number),author=item.author?"@"+item.author:"Không rõ người gửi";
    const hasStats=[item.changed_files,item.additions,item.deletions].every(Number.isFinite);
    const stats=hasStats?(item.changed_files+" tệp thay đổi · +"+
      item.additions+" / −"+item.deletions+" dòng"):
      "Số tệp và dòng thay đổi: mở PR trên GitHub để xem";
    const url="https://github.com/kenzuko/jotrip-home/pull/"+number;
    return'<article class="card review-pr-card" data-review-pr="'+number+'">'+
      '<div class="card-head"><span class="state '+(item.draft?"draft":"ready")+'">'+
      (item.draft?"PR nháp":"Đang mở")+'</span><span class="number">#'+number+'</span></div>'+
      '<h3>'+esc(item.title||"Đề xuất CMS #"+number)+'</h3>'+
      '<p class="meta">Người gửi: '+esc(author)+' · Cập nhật '+esc(when(item.updated_at))+'</p>'+
      '<p class="detail">'+esc(stats)+'</p>'+
      '<div class="actions"><button class="action secondary field-toggle" type="button" aria-expanded="false" aria-controls="diff-'+
      number+'" data-pr="'+number+'">So sánh theo trường</button>'+
      '<a class="action" href="'+url+'" target="_blank" rel="noopener noreferrer">Mở PR trên GitHub ↗</a></div>'+
      '<div class="field-diff hidden" id="diff-'+number+'"></div></article>';
  }).join("");
  document.querySelectorAll(".field-toggle").forEach(button=>
    button.addEventListener("click",()=>showDiff(button)));
}

async function load(){
  if(reviewState.loading)return;
  reviewState.loading=true;
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
    reviewState.items=Array.isArray(result.items)?result.items:[];
    $("#count").textContent=reviewState.items.length+" đề xuất đang mở";
    $("#checked").textContent="Kiểm tra lúc "+when(result.checked_at);
    const selected=Number(new URLSearchParams(location.search).get("pr")||0);
    if(reviewState.firstOpen&&selected){
      const index=reviewState.items.findIndex(item=>Number(item.number)===selected);
      if(index>=0){
        reviewState.filter="all";reviewState.query="";
        $("#reviewSearch").value="";reviewState.visible=Math.max(8,index+1);
      }
    }
    renderQueue();
    if(reviewState.firstOpen){
      reviewState.firstOpen=false;focusRequestedReview();
    }
    renderHistory(result.history||[]);
    loadQuality();
  }catch(error){
    $("#count").textContent="Chưa tải được hàng đợi";
    $("#queue").innerHTML="";
    $("#error").textContent=error?.message||"Không tải được hàng đợi duyệt.";
  }finally{
    button.disabled=false;
    reviewState.loading=false;
  }
}




async function loadQuality(){
  const host=$("#quality");
  try{
    const response=await fetch("/api/cms/quality",{credentials:"include",cache:"no-store"});
    const result=await response.json();
    if(!response.ok)throw Error(result.detail||result.error||"Không tải được tín hiệu chất lượng");
    const items=Array.isArray(result.tasks)?result.tasks.filter(x=>!["resolved","muted"].includes(x.status)):[];
    if(!items.length){
      host.innerHTML='<div class="empty"><p>Chưa phát hiện công việc theo các quy tắc hiện tại.</p></div>';
      return;
    }
    const rank={high:0,medium:1,low:2};
    items.sort((a,b)=>(rank[a.severity]??3)-(rank[b.severity]??3));
    host.innerHTML='<p class="review-quality-intro">'+items.length+
      ' việc cần kiểm chứng. Hiển thị ba việc đầu; trạng thái và hạn xử lý xem tại Cần kiểm chứng.</p>'+
      items.slice(0,3).map(item=>{
        const id=String(item.entity_id||""),rule=String(item.rule_id||"");
        const module=rule==="FOOD_ARTICLE_GAP"?"foods":rule.startsWith("VENUE_")?"venues":null;
        const action=item.severity==="high"?"Ưu tiên":item.severity==="medium"?"Bổ sung":"Theo dõi";
        const name=String(item.evidence||"").match(/^(.{2,95}?)\s+(?:đang ACTIVE|có tọa độ|có thực thể món)\b/i)?.[1]||id||item.surface;
        const href=id&&module?"index.html?module="+module+"&record="+encodeURIComponent(id)+
          "&field="+encodeURIComponent(item.field||""):"quality.html";
        return'<article class="card quality-card"><div class="card-head">'+
          '<span class="severity '+esc(item.severity)+'">'+action+'</span></div>'+
          '<h3>'+esc(name)+'</h3><p class="detail">'+esc(item.evidence||"")+'</p>'+
          '<a class="action secondary" href="'+esc(href)+'">'+
          (id&&module?"Mở hồ sơ":"Mở hàng đợi đầy đủ")+' ↗</a></article>';
      }).join("");
  }catch(error){
    host.innerHTML='<div class="empty"><p class="error">'+
      esc(error?.message||"Không tải được hàng đợi chất lượng.")+'</p></div>';
  }
}

function renderHistory(items){
  const host=$("#history");
  if(!items.length){host.innerHTML='<div class="empty"><p>Chưa có thay đổi CMS nào được merge.</p></div>';return}
  host.innerHTML=items.map(item=>{
    const rollback=item.can_rollback?'<button class="action secondary rollback" type="button" data-pr="'+Number(item.number)+'">Tạo PR rollback</button>':"";
    return '<article class="card history-card"><div class="card-head"><span class="state merged">Đã merge</span><span class="number">#'+Number(item.number)+'</span></div><h3>'+esc(item.title)+'</h3><p class="meta">Người merge: '+esc(item.author||"Không rõ")+' · '+esc(when(item.merged_at))+' · '+(Number.isFinite(item.changed_files)?item.changed_files+" tệp":"Số tệp chưa rõ")+
    '</p><p class="detail">Rollback chỉ tạo đề xuất PR mới; nếu tệp đã thay đổi thêm, yêu cầu kiểm tra thủ công.</p><div class="actions"><a class="action secondary" href="'+esc(item.url)+'" target="_blank" rel="noopener">Mở PR đã merge ↗</a>'+rollback+'</div><p class="rollback-status" id="rollback-'+Number(item.number)+'"></p></article>';
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
  if(!panel.classList.contains("hidden")){panel.classList.add("hidden");button.setAttribute("aria-expanded","false");return}
  panel.classList.remove("hidden");button.setAttribute("aria-expanded","true");
  panel.innerHTML='<p class="loading">Đang so sánh bản đề xuất với main hiện tại…</p>';
  button.disabled=true;
  try{
    const response=await fetch("/api/cms/review-diff?pr="+pr,{credentials:"include",cache:"no-store"});
    const result=await response.json();
    if(!response.ok)throw new Error(result.detail||result.error||"Không tải được diff");
    const files=Array.isArray(result.fields)?result.fields:[];
    const rows=files.flatMap(file=>file.fields.map(change=>({path:file.path,...change})));
    if(!rows.length){panel.innerHTML='<p class="empty-diff">Không có trường thay đổi trong các tệp CMS được hỗ trợ.</p>';return}
    panel.innerHTML='<h4>So sánh với main hiện tại · kiểm tra lúc '+esc(when(result.checked_at))+'</h4>'+'<p class="review-diff-caption">'+rows.length+' trường hiển thị. Các thay đổi sau khi PR được gửi có thể khiến bản main hiện tại khác bản gốc.</p>'+rows.map(row=>'<div class="field-row"><strong>'+esc(row.path)+' · '+esc(row.field)+'</strong><div class="field-values"><pre class="old">'+esc(JSON.stringify(row.before,null,2)??"null")+'</pre><pre class="new">'+esc(JSON.stringify(row.after,null,2)??"null")+'</pre></div></div>').join("");
  }catch(error){panel.innerHTML='<p class="error">'+esc(error?.message||"Không tải được diff theo trường.")+'</p>'}
  finally{button.disabled=false}
}

$("#reviewSearch").addEventListener("input",event=>{
  reviewState.query=event.target.value;reviewState.visible=8;renderQueue();
});
document.querySelectorAll("[data-review-filter]").forEach(button=>
  button.addEventListener("click",()=>{
    reviewState.filter=button.dataset.reviewFilter;reviewState.visible=8;renderQueue();
  }));
$("#reviewMore").addEventListener("click",()=>{reviewState.visible+=8;renderQueue();});
$("#refresh").addEventListener("click",load);
load();
function focusRequestedReview(){
  const number=new URLSearchParams(location.search).get("pr");
  if(!number)return;
  const button=Array.from(document.querySelectorAll(".field-toggle")).find(item=>item.dataset.pr===number);
  if(!button)return;
  button.closest(".card")?.scrollIntoView({behavior:"smooth",block:"center"});
  button.click();
}
