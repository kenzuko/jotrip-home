/* Public reports remain proposals. Only CMS editors may change review state. */
(()=>{
"use strict";
const $=q=>document.querySelector(q);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels={closed:"Đã đóng cửa",location:"Sai vị trí",hours:"Giờ hoạt động",phone:"Số điện thoại",details:"Thông tin khác",new_place:"Địa điểm mới",other:"Bổ sung",translation:"Bản dịch"};
const states={new:"Chưa xử lý",reviewing:"Đang kiểm tra",resolved:"Đã xử lý",rejected:"Không phù hợp"};
let session,offset=0,loading=false,relatedKey="",correctionOffset=0,correctionLoading=false,pendingQueueReload=false,pendingCorrectionReload=false;
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
  return (s==="/"||/^\/(nearme|go|places|stories|guide)\/[a-zA-Z0-9/._-]*(?:\?id=[a-zA-Z0-9_-]{1,120})?$/.test(s))&&!s.startsWith("//")?s:null;
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
  const translation=x.issue==="translation";
  const similar=Number(x.similar_count||1)>1&&/^[a-f0-9]{24}$/.test(String(x.triage_key||""));
  const similarHtml=similar?' <button type="button" class="related-chip" data-related="'+esc(x.triage_key)+'">'+Number(x.similar_count)+' góp ý cùng chủ đề ↗</button>':"";
  const translationBox=translation?'<div class="translation-box"><small>Ngôn ngữ: '+esc(x.language||"?")+
    (x.source_revision?" · Phiên bản: "+esc(x.source_revision):"")+'</small>'+
    (x.quoted_text?'<strong>Đoạn được góp ý</strong><blockquote lang="'+esc(x.language||"")+'">'+esc(x.quoted_text)+'</blockquote>':"")+
    (x.suggested_text?'<strong>Khách đề xuất</strong><blockquote class="proposal" lang="'+esc(x.language||"")+'">'+esc(x.suggested_text)+'</blockquote>'+(writable()?'<button type="button" class="reuse-suggestion">Đưa vào ô kiểm duyệt ↓</button>':""):"")+
    '<label><strong>Câu đã kiểm tra (chỉ lưu khi chọn Đã xử lý)</strong><textarea class="approved-text" maxlength="1500" '+(writable()?"":"disabled")+' placeholder="Nhập bản sửa đã được biên tập viên xác nhận...">'+esc(x.approved_text||"")+'</textarea></label>'+
    '<small>Bản sửa được lưu vào kho góp ý đã duyệt, không tự cập nhật bài công khai.</small></div>':"";
  return '<article class="item" data-id="'+esc(x.id)+'">'+
    '<span class="tag">'+esc(labels[x.issue]||x.issue)+'</span> '+similarHtml+
    '<span class="meta">'+esc(new Date(x.created_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}))+'</span>'+
    '<h2>'+esc(x.entity_label)+'</h2>'+
    '<p class="meta">'+esc(x.entity_type)+(x.entity_id?" · "+esc(x.entity_id):"")+
      ' · Mã góp ý: <code>'+esc(x.id)+'</code></p>'+
    '<div class="note">'+esc(x.details||"Người dùng chưa gửi mô tả thêm.")+'</div>'+translationBox+
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
  if(loading){if(reset)pendingQueueReload=true;return;}
  loading=true;
  const next=reset?0:offset;
  status("Đang tải hàng chờ...");
  $("#loadMore").disabled=true;
  try{
    const filter=$("#filter").value;
    const query=new URLSearchParams({offset:String(next)});
    if(filter&&!relatedKey)query.set("status",filter);
    if(relatedKey)query.set("related",relatedKey);
    if($("#sortFilter").value)query.set("sort",$("#sortFilter").value);
    if(!relatedKey&&$("#kindFilter").value)query.set("kind",$("#kindFilter").value);
    if(!relatedKey&&$("#kindFilter").value==="translation"&&$("#languageFilter").value)query.set("language",$("#languageFilter").value);
    const result=await read("/api/cms/feedback?"+query);
    const items=result.items||[];
    if(reset)$("#queue").innerHTML="";
    $("#relatedBanner").hidden=!relatedKey;
    $("#queue").insertAdjacentHTML("beforeend",items.map(record).join(""));
    offset=Number(result.next_offset||0);
    $("#loadMore").hidden=!result.has_more;
    $("#loadMore").disabled=false;
    $("#count").textContent=$("#queue").querySelectorAll(".item").length+" góp ý đang hiển thị";
    if(!$("#queue").children.length)$("#queue").innerHTML="<p>Chưa có góp ý trong mục này.</p>";
    status("");
  }catch(e){status("Không mở được hàng chờ: "+e.message);$("#loadMore").disabled=false;}
  finally{loading=false;if(pendingQueueReload){pendingQueueReload=false;void load(true);}}
}
function correctionCard(item){
  const source=publicHref(item.source_path);
  const date=new Date(item.approved_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"});
  return '<article class="correction-card"><span class="tag">'+esc(item.language||"?")+'</span> '+
    '<span class="meta">'+esc(date)+' · Đã duyệt bởi '+esc(item.approved_by||"biên tập viên")+'</span>'+
    '<h2>'+esc(item.entity_id||"Bài viết")+'</h2>'+
    '<small>'+(item.source_revision?'Phiên bản: '+esc(item.source_revision)+' · ':"")+
    'Chỉ áp dụng lại sau khi khớp đúng đoạn và phiên bản bài viết.</small>'+
    (item.quoted_text?'<strong>Đoạn đã góp ý</strong><blockquote lang="'+esc(item.language)+'">'+esc(item.quoted_text)+'</blockquote>':"")+
    '<strong>Câu đã duyệt</strong><blockquote class="approved" lang="'+esc(item.language)+'">'+esc(item.approved_text)+'</blockquote>'+
    '<div class="links">'+(source?'<a class="action" href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">Xem bài liên quan ↗</a>':"")+
    '<button type="button" class="copy-approved">Sao chép câu đã duyệt</button></div></article>';
}
async function loadCorrections(reset=true){
  if(correctionLoading){if(reset)pendingCorrectionReload=true;return;}
  correctionLoading=true;
  const next=reset?0:correctionOffset;
  $("#correctionStatus").textContent="Đang mở kho câu sửa...";
  $("#correctionMore").disabled=true;
  try{
    const query=new URLSearchParams({offset:String(next)});
    if($("#correctionLanguage").value)query.set("language",$("#correctionLanguage").value);
    const q=$("#correctionQuery").value.trim();
    if(q)query.set("q",q);
    const result=await read("/api/cms/feedback/corrections?"+query);
    if(reset)$("#correctionRows").replaceChildren();
    $("#correctionRows").insertAdjacentHTML("beforeend",(result.items||[]).map(correctionCard).join(""));
    correctionOffset=Number(result.next_offset||0);
    $("#correctionMore").hidden=!result.has_more;
    $("#correctionCount").textContent=$("#correctionRows").children.length+" câu đã duyệt";
    if(!$("#correctionRows").children.length)$("#correctionRows").textContent="Chưa có câu sửa phù hợp.";
    $("#correctionStatus").textContent="";
  }catch(e){$("#correctionStatus").textContent="Chưa mở được kho câu sửa: "+e.message;}
  finally{$("#correctionMore").disabled=false;correctionLoading=false;if(pendingCorrectionReload){pendingCorrectionReload=false;void loadCorrections(true);}}
}
function showTab(name){
  const queue=name==="queue";
  $("#queueView").hidden=!queue;
  $("#correctionView").hidden=queue;
  $("#queueTab").setAttribute("aria-selected",String(queue));
  $("#correctionTab").setAttribute("aria-selected",String(!queue));
  if(!queue)loadCorrections(true);
}
async function init(){
  try{
    session=await read("/api/cms/session");
    $("#work").hidden=false;
    $("#queueTab").addEventListener("click",()=>showTab("queue"));
    $("#correctionTab").addEventListener("click",()=>showTab("correction"));
    $("#correctionSearch").addEventListener("submit",event=>{event.preventDefault();loadCorrections(true);});
    $("#correctionLanguage").addEventListener("change",()=>loadCorrections(true));
    $("#correctionMore").addEventListener("click",()=>loadCorrections(false));
    $("#correctionRows").addEventListener("click",async event=>{
      const button=event.target.closest(".copy-approved");
      if(!button)return;
      const content=button.closest(".correction-card").querySelector(".approved").textContent;
      try{await navigator.clipboard.writeText(content);$("#correctionStatus").textContent="Đã sao chép câu đã duyệt.";}
      catch{$("#correctionStatus").textContent="Không tự sao chép được, bạn chọn đoạn văn rồi sao chép nhé.";}
    });
    $("#clearRelated").addEventListener("click",()=>{relatedKey="";$("#relatedBanner").hidden=true;load(true);});
    $("#sortFilter").addEventListener("change",()=>load(true));
    $("#filter").addEventListener("change",()=>load(true));
    $("#kindFilter").addEventListener("change",()=>{
      const translated=$("#kindFilter").value==="translation";
      $("#languageFilterWrap").hidden=!translated;
      if(!translated)$("#languageFilter").value="";
      load(true);
    });
    $("#languageFilter").addEventListener("change",()=>load(true));
    $("#refresh").addEventListener("click",()=>load(true));
    $("#loadMore").addEventListener("click",()=>load(false));
    $("#queue").addEventListener("click",async event=>{
      const related=event.target.closest("[data-related]");
      if(related){
        relatedKey=related.dataset.related;$("#filter").value="";$("#relatedBanner").hidden=false;
        $("#sortFilter").value="recent";load(true);return;
      }
      const fill=event.target.closest(".reuse-suggestion");
      if(fill){
        const item=fill.closest("[data-id]");
        const text=item.querySelector(".proposal")?.textContent||"";
        const field=item.querySelector(".approved-text");
        if(field&&text){field.value=text;field.focus();status("Đã đưa câu khách đề xuất vào ô kiểm duyệt. Bạn đối chiếu với bản gốc trước khi duyệt.");}
        return;
      }
      const button=event.target.closest(".save");
      if(!button)return;
      const item=button.closest("[data-id]");
      const next=item.querySelector(".item-state").value;
      const note=item.querySelector(".item-note").value.trim();
      const approved=item.querySelector(".approved-text")?.value.trim()||"";
      if(item.querySelector(".approved-text")&&next==="resolved"&&approved.length<3){
        status("Bạn cần nhập bản dịch đã kiểm tra trước khi đánh dấu hoàn tất.");
        item.querySelector(".approved-text").focus();
        return;
      }
      if(["resolved","rejected"].includes(next)&&note.length<10){
        status("Khi kết thúc góp ý, bạn ghi rõ cách đã kiểm tra hoặc lý do xử lý (ít nhất 10 ký tự).");
        item.querySelector(".item-note").focus();
        return;
      }
      button.disabled=true;
      try{
        await read("/api/cms/feedback",{method:"PATCH",headers:{"content-type":"application/json"},
          body:JSON.stringify({id:item.dataset.id,status:next,note,approved_text:next==="resolved"?approved:""})});
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