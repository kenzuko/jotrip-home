(()=>{
"use strict";
const $=q=>document.querySelector(q);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels={closed:"Đã đóng cửa",location:"Sai vị trí",hours:"Giờ hoạt động",phone:"Số điện thoại",details:"Thông tin khác",new_place:"Địa điểm mới",other:"Bổ sung"};
const states={new:"Chưa xử lý",reviewing:"Đang kiểm tra",resolved:"Đã xử lý",rejected:"Không phù hợp"};
let session;
async function read(url,init={}){
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...init});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||("HTTP "+response.status));
  return body;
}
const status=message=>{$("#status").textContent=message};
async function load(){
  status("Đang tải hàng chờ...");
  try{
    const current=$("#filter").value;
    const result=await read("/api/cms/feedback"+(current?"?status="+encodeURIComponent(current):""));
    $("#count").textContent=(result.items||[]).length+" góp ý (tối đa 50 gần nhất)";
    $("#queue").innerHTML=(result.items||[]).map(x=>
      '<article class="item" data-id="'+esc(x.id)+'">'+
      '<span class="tag">'+esc(labels[x.issue]||x.issue)+'</span> '+
      '<span class="meta">'+esc(new Date(x.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}))+'</span>'+
      '<h2>'+esc(x.entity_label)+'</h2>'+
      '<p class="meta">'+esc(x.entity_type)+(x.entity_id?" · "+esc(x.entity_id):"")+' · '+esc(x.source_path)+'</p>'+
      '<div class="note">'+esc(x.details||"Người dùng chưa gửi mô tả thêm.")+'</div>'+
      (x.has_photo?'<a href="/api/cms/feedback/photo?id='+encodeURIComponent(x.id)+'" target="_blank" rel="noopener">Xem ảnh đính kèm ↗</a>'+
        '<img class="evidence" loading="lazy" alt="Ảnh cộng đồng gửi, chưa xác minh" src="/api/cms/feedback/photo?id='+encodeURIComponent(x.id)+'">':"")+
      '<div class="controls"><label>Trạng thái <select class="item-state" '+(session.role==="viewer"||session.role==="operator"?"disabled":"")+'>'+
      Object.entries(states).map(([key,name])=>'<option value="'+key+'" '+(x.status===key?"selected":"")+'>'+name+'</option>').join("")+
      '</select></label><input class="item-note" maxlength="1000" placeholder="Ghi chú xử lý..." value="'+esc(x.moderator_note||"")+'" '+
      (["viewer","operator"].includes(session.role)?"disabled":"")+'>'+
      (["admin","editor"].includes(session.role)?'<button class="save primary">Lưu xử lý</button>':"")+
      '</div></article>').join("")||'<p>Chưa có góp ý nào trong mục này.</p>';
    status("");
  }catch(e){status("Không mở được hàng chờ: "+e.message);}
}
async function init(){
  try{
    session=await read("/api/cms/session");
    $("#work").hidden=false;
    $("#filter").addEventListener("change",load);
    $("#refresh").addEventListener("click",load);
    $("#queue").addEventListener("click",async event=>{
      const button=event.target.closest(".save");
      if(!button)return;
      const item=button.closest("[data-id]");
      button.disabled=true;
      try{
        await read("/api/cms/feedback",{method:"PATCH",headers:{"content-type":"application/json"},
          body:JSON.stringify({id:item.dataset.id,status:item.querySelector(".item-state").value,
            note:item.querySelector(".item-note").value})});
        await load();
      }catch(e){status("Chưa lưu được: "+e.message);button.disabled=false;}
    });
    await load();
  }catch(e){
    $("#login").hidden=false;
    $("#login").querySelector("p").textContent=e.message==="Chưa đăng nhập"?"Đăng nhập CMS để xem hàng chờ.":"Không kiểm tra được quyền CMS: "+e.message;
  }
}
init();
})();
