/* Public reports remain proposals. Only CMS editors may change review state. */
(()=>{
"use strict";
const $=q=>document.querySelector(q);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels={closed:"Đã đóng cửa",location:"Sai vị trí",hours:"Giờ hoạt động",phone:"Số điện thoại",details:"Thông tin khác",new_place:"Địa điểm mới",other:"Bổ sung"};
const states={new:"Chưa xử lý",reviewing:"Đang kiểm tra",resolved:"Đã xử lý",rejected:"Không phù hợp"};
let session,offset=0,loading=false;
async function read(url,init={}){
  const response=await fetch(url,{credentials:"same-origin",cache:"no-store",...init});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||("HTTP "+response.status));
  return body;
}
const writable=()=>["admin","editor"].includes(session?.role);
const status=message=>{$("#status").textContent=message;};
function publicHref(raw){
  const s=String(raw||"");
  return /^\/(nearme|go|places|stories|guide)\/[a-zA-Z0-9/_-]*(?:\?id=[a-zA-Z0-9_-]{1,120})?$/.test(s)&&!s.startsWith("//")?s:null;
}
function editorHref(x){
  const id=String(x.entity_id||"");
  if(!/^[a-zA-Z0-9_-]{1,120}$/.test(id))return null;
  let module=null;
  if(x.entity_type==="venue")module="venues";
  if(x.entity_type==="utility")module="utilities";
  if(x.entity_type==="article"){
    if(String(x.source_path||"").startsWith("/stories/"))module="stories";
    if(String(x.source_path||"").startsWith("/guide/"))module="guide";
  }
  return module?"index.html?module="+encodeURIComponent(module)+"&record="+encodeURIComponent(id):null;
}
function record(x){
  const source=publicHref(x.source_path),editor=editorHref(x);
  return '<article class="item" data-id="'+esc(x.id)+'">'+
    '<span class="tag">'+esc(labels[x.issue]||x.issue)+'</span> '+
    '<span class="meta">'+esc(new Date(x.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}))+'</span>'+
    '<h2>'+esc(x.entity_label)+'</h2>'+
    '<p class="meta">'+esc(x.entity_type)+(x.entity_id?" · "+esc(x.entity_id):"")+
      ' · Mã góp ý: <code>'+esc(x.id)+'</code></p>'+
    '<div class="note">'+esc(x.details||"Người dùng chưa gửi mô tả thêm.")+'</div>'+
    '<div class="links">'+(source?'<a class="action" href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">Xem trang liên quan ↗</a>':"")+
      (editor?'<a class="action" href="'+esc(editor)+'">Mở hồ sơ CMS ↗</a>':"")+
    '</div>'+
    (x.has_photo?'<a href="/api/cms/feedback/photo?id='+encodeURIComponent(x.id)+'" target="_blank" rel="noopener noreferrer">Xem ảnh riêng tư ↗</a>'+
      '<img class="evidence" loading="lazy" alt="Ảnh cộng đồng gửi, chưa xác minh" src="/api/cms/feedback/photo?id='+encodeURIComponent(x.id)+'">':"")+
    '<div class="controls"><label>Trạng thái <select class="item-state" '+(writable()?"":"disabled")+'>'+
    Object.entries(states).map(([key,name])=>'<option value="'+key+'" '+(x.status===key?"selected":"")+'>'+name+'</option>').join("")+
    '</select></label><input class="item-note" maxlength="1000" placeholder="Ghi chú kiểm chứng hoặc lý do xử lý..." value="'+esc(x.moderator_note||"")+'" '+
    (writable()?"":"disabled")+'>'+
    (writable()?'<button type="button" class="save primary">Lưu xử lý</button>':"")+
    '</div></article>';
}
async function load(reset=true){
  if(loading)return;
  loading=true;
  const next=reset?0:offset;
  status("Đang tải hàng chờ...");
  $("#loadMore").disabled=true;
  try{
    const filter=$("#filter").value;
    const query=new URLSearchParams({offset:String(next)});
    if(filter)query.set("status",filter);
    const result=await read("/api/cms/feedback?"+query);
    const items=result.items||[];
    if(reset)$("#queue").innerHTML="";
    $("#queue").insertAdjacentHTML("beforeend",items.map(record).join(""));
    offset=Number(result.next_offset||0);
    $("#loadMore").hidden=!result.has_more;
    $("#loadMore").disabled=false;
    $("#count").textContent=$("#queue").querySelectorAll(".item").length+" góp ý đang hiển thị";
    if(!$("#queue").children.length)$("#queue").innerHTML="<p>Chưa có góp ý trong mục này.</p>";
    status("");
  }catch(e){status("Không mở được hàng chờ: "+e.message);$("#loadMore").disabled=false;}
  finally{loading=false;}
}
async function init(){
  try{
    session=await read("/api/cms/session");
    $("#work").hidden=false;
    $("#filter").addEventListener("change",()=>load(true));
    $("#refresh").addEventListener("click",()=>load(true));
    $("#loadMore").addEventListener("click",()=>load(false));
    $("#queue").addEventListener("click",async event=>{
      const button=event.target.closest(".save");
      if(!button)return;
      const item=button.closest("[data-id]");
      const next=item.querySelector(".item-state").value;
      const note=item.querySelector(".item-note").value.trim();
      if(["resolved","rejected"].includes(next)&&note.length<10){
        status("Khi kết thúc góp ý, bạn ghi rõ cách đã kiểm tra hoặc lý do xử lý (ít nhất 10 ký tự).");
        item.querySelector(".item-note").focus();
        return;
      }
      button.disabled=true;
      try{
        await read("/api/cms/feedback",{method:"PATCH",headers:{"content-type":"application/json"},
          body:JSON.stringify({id:item.dataset.id,status:next,note})});
        await load(true);
      }catch(e){status("Chưa lưu được: "+e.message);button.disabled=false;}
    });
    await load(true);
  }catch(e){
    $("#login").hidden=false;
    $("#login").querySelector("p").textContent=e.message==="Chưa đăng nhập"?"Đăng nhập CMS để xem hàng chờ.":"Không kiểm tra được quyền CMS: "+e.message;
  }
}
init();
})();