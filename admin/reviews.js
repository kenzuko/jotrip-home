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
      return;
    }
    $("#queue").innerHTML=items.map(item=>{
      const state=item.draft?"Bản nháp":"Sẵn sàng xem xét";
      const author=item.author?"@"+item.author:"Không rõ người gửi";
      return '<article class="card"><div class="card-head"><span class="state '+(item.draft?"draft":"ready")+'">'+state+'</span><span class="number">#'+Number(item.number)+'</span></div><h3>'+esc(item.title)+'</h3><p class="meta">Người gửi: '+esc(author)+' · Cập nhật '+esc(when(item.updated_at))+'</p><p class="detail">'+Number(item.changed_files)+' tệp thay đổi · +'+Number(item.additions)+' / −'+Number(item.deletions)+' dòng</p><a class="action" href="'+esc(item.url)+'" target="_blank" rel="noopener">Mở diff trên GitHub ↗</a></article>';
    }).join("");
  }catch(error){
    $("#count").textContent="Chưa tải được hàng đợi";
    $("#queue").innerHTML="";
    $("#error").textContent=error?.message||"Không tải được hàng đợi duyệt.";
  }finally{
    button.disabled=false;
  }
}

$("#refresh").addEventListener("click",load);
load();
