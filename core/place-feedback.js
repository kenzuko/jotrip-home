/* Shared, account-free correction form. All reports remain unverified until CMS review. */
(()=>{
  "use strict";
  const labels={
    closed:"Nơi này đã đóng cửa",location:"Vị trí trên bản đồ chưa đúng",
    hours:"Giờ hoạt động đã thay đổi",phone:"Số điện thoại chưa đúng",
    details:"Thông tin khác chưa chính xác",new_place:"Đề xuất địa điểm mới",
    other:"Tôi muốn bổ sung thông tin"
  };
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let dialog,form,status,submit,photoRow,config=null,current=null,loadConfig;
  // Public apex hosts use the CMS intake directly. No credentials or account required.
  const apiEndpoint=["openphuquoc.com","www.openphuquoc.com"].includes(location.hostname)
    ?"https://cms.openphuquoc.com/api/feedback":"/api/feedback";
  const validType=value=>["place","activity","venue","hotel","utility","article","general"].includes(value)?value:"general";
  function init(){
    if(dialog)return;
    dialog=document.createElement("dialog");
    dialog.className="opq-feedback";
    dialog.setAttribute("aria-labelledby","opqFeedbackTitle");
    dialog.innerHTML='<form id="opqFeedbackForm" method="dialog">'+
      '<div class="opq-feedback-head"><div><small>CÙNG GIỮ THÔNG TIN CHÍNH XÁC</small><h2 id="opqFeedbackTitle">Góp ý thông tin</h2></div>'+
        '<button type="button" class="opq-feedback-close" aria-label="Đóng cửa sổ">×</button></div>'+
      '<p class="opq-feedback-context" id="opqFeedbackContext"></p>'+
      '<label class="opq-feedback-field">Bạn muốn góp ý điều gì?<select name="issue" required></select></label>'+
      '<label class="opq-feedback-field" id="opqFeedbackNewName" hidden>Tên địa điểm<input name="new_name" maxlength="120" placeholder="Tên địa điểm bạn muốn thêm"></label>'+
      '<label class="opq-feedback-field">Chia sẻ thêm (nếu có)<textarea name="details" maxlength="1500" rows="4" placeholder="Thông tin đúng là gì? Bạn biết từ khi nào?"></textarea></label>'+
      '<label class="opq-feedback-field" id="opqFeedbackPhoto" hidden>Ảnh thực tế (không bắt buộc, tối đa 3 MB)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label>'+
      '<label class="opq-feedback-trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>'+
      '<p class="opq-feedback-note">Không cần đăng nhập. Chỉ gửi thông tin liên quan đến địa điểm hoặc bài viết. Tránh ảnh có thông tin cá nhân. <a href="/about/feedback-privacy.html" target="_blank" rel="noopener">Dữ liệu góp ý được sử dụng thế nào?</a></p>'+
      '<p class="opq-feedback-status" role="status" aria-live="polite"></p>'+
      '<div class="opq-feedback-actions"><button type="button" data-feedback-cancel>Bỏ qua</button><button type="submit" class="opq-feedback-send">Gửi góp ý</button></div>'+
      '</form>';
    document.body.appendChild(dialog);
    form=dialog.querySelector("form");
    status=dialog.querySelector(".opq-feedback-status");
    submit=dialog.querySelector(".opq-feedback-send");
    photoRow=dialog.querySelector("#opqFeedbackPhoto");
    dialog.querySelector(".opq-feedback-close").addEventListener("click",()=>dialog.close());
    dialog.querySelector("[data-feedback-cancel]").addEventListener("click",()=>dialog.close());
    dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close();});
    form.querySelector("[name=issue]").addEventListener("change",syncKind);
    form.addEventListener("submit",send);
  }
  function syncKind(){
    const isNew=form.elements.issue.value==="new_place";
    form.querySelector("#opqFeedbackNewName").hidden=!isNew;
    form.elements.new_name.required=isNew;
    form.elements.details.required=isNew;
    form.elements.details.minLength=isNew?10:0;
    form.querySelector("[name=details]").closest("label").firstChild.textContent=isNew?"Địa chỉ hoặc khu vực (bắt buộc)":"Chia sẻ thêm (nếu có)";
    form.querySelector("[name=details]").placeholder=isNew
      ?"Địa chỉ hoặc khu vực, đặc điểm nhận biết, giờ mở cửa nếu biết..."
      :"Thông tin đúng là gì? Bạn biết từ khi nào?";
  }
  async function capabilities(){
    if(config)return config;
    if(!loadConfig)loadConfig=fetch(apiEndpoint,{cache:"no-store",credentials:"omit"})
      .then(r=>r.ok?r.json():null).catch(()=>null);
    const result=await loadConfig||{enabled:false,photo_enabled:false};
    if(result.enabled)config=result;
    else loadConfig=null; // Allow retry after backend setup without trapping visitor in a stale disabled state.
    return result;
  }
  function open(details={}){
    init();
    current={
      entity_id:String(details.entity_id||"").slice(0,120),
      entity_type:validType(details.entity_type),
      entity_label:String(details.entity_label||"Trang thông tin này").slice(0,120)
    };
    form.reset();
    submit.type="submit";submit.onclick=null;
    form.querySelectorAll(".opq-feedback-field").forEach(el=>el.hidden=false);
    form.querySelector(".opq-feedback-note").hidden=false;
    const isNew=details.issue==="new_place";
    form.elements.issue.innerHTML=Object.entries(labels)
      .filter(([id])=>isNew?id==="new_place":current.entity_type==="article"?["details","other"].includes(id):id!=="new_place")
      .map(([id,label])=>'<option value="'+id+'">'+esc(current.entity_type==="article"&&id==="details"?"Thông tin trong bài chưa đúng":label)+'</option>').join("");
    form.elements.issue.value=isNew?"new_place":"details";
    form.querySelector("#opqFeedbackContext").textContent=isNew
      ?"Biết một địa điểm hữu ích chưa có trong danh sách? Chia sẻ với Open Phu Quoc nhé."
      :current.entity_label;
    syncKind();
    status.textContent="Đang kiểm tra kênh góp ý...";
    status.className="opq-feedback-status";
    submit.disabled=true;
    submit.textContent="Gửi góp ý";
    photoRow.hidden=true;
    if(dialog.showModal)dialog.showModal();else dialog.setAttribute("open","");
    capabilities().then(cfg=>{
      if(!dialog.open)return;
      if(!cfg.enabled){
        status.textContent="Kênh góp ý chưa sẵn sàng lúc này. Bạn thử lại sau nhé.";
        submit.disabled=true;
        return;
      }
      status.textContent="";
      submit.disabled=false;
      photoRow.hidden=!cfg.photo_enabled;
    });
  }
  async function send(event){
    event.preventDefault();
    if(!current||submit.disabled)return;
    const isNew=form.elements.issue.value==="new_place";
    const name=isNew?form.elements.new_name.value.trim():current.entity_label;
    if(!name){status.textContent="Bạn cho mình biết tên địa điểm nhé.";return;}
    const data=new FormData(form);
    data.set("entity_type",isNew?"general":current.entity_type);
    data.set("entity_id",isNew?"":current.entity_id);
    data.set("entity_label",name);
    data.set("source_url",location.href);
    const photo=data.get("photo");
    if(photo&&photo.size>3145728){status.textContent="Ảnh hơi lớn. Bạn chọn ảnh dưới 3 MB nhé.";return;}
    if(photo&&!photo.size)data.delete("photo");
    submit.disabled=true;submit.textContent="Đang gửi...";
    status.textContent="";
    try{
      const r=await fetch(apiEndpoint,{method:"POST",body:data,credentials:"omit",headers:{"Accept":"application/json"}});
      const result=await r.json().catch(()=>({}));
      if(!r.ok||!result.ok){
        const messages={rate_limited:"Bạn đã gửi khá nhiều góp ý. Mình thử lại sau nhé.",
          feedback_not_configured:"Kênh góp ý đang được chuẩn bị. Bạn quay lại sau nhé.",
          storage_unavailable:"Chưa lưu được góp ý. Bạn thử lại sau nhé.",
          photo_save_failed:"Chưa lưu được ảnh. Bạn thử gửi lại hoặc bỏ ảnh nhé.",
          photos_unavailable:"Chưa nhận ảnh lúc này. Bạn thử gửi lại không kèm ảnh nhé.",
          invalid_fields:"Bạn kiểm tra lại thông tin vừa nhập nhé."};
        throw new Error(messages[result.error]||"Chưa gửi được góp ý. Bạn thử lại sau nhé.");
      }
      form.querySelector("#opqFeedbackContext").textContent="Cảm ơn bạn đã giúp thông tin về Phú Quốc chính xác hơn.";
      form.querySelectorAll(".opq-feedback-field").forEach(el=>el.hidden=true);
      form.querySelector(".opq-feedback-note").hidden=true;
      status.className="opq-feedback-status opq-feedback-success";
      status.textContent="Đã nhận góp ý. Mã tham chiếu: "+result.reference+". Bên mình sẽ kiểm tra trước khi cập nhật.";
      submit.textContent="Hoàn tất";
      submit.type="button";
      submit.disabled=false;
      submit.onclick=()=>dialog.close();
    }catch(error){
      status.textContent=error.message;
      submit.disabled=false;submit.textContent="Gửi lại";
    }
  }
  document.addEventListener("click",event=>{
    const target=event.target.closest("[data-openpq-feedback]");
    if(!target)return;
    event.preventDefault();
    const fromQuery=target.hasAttribute("data-feedback-query-id")?new URLSearchParams(location.search).get("id"):"";
    open({entity_id:target.dataset.feedbackId||fromQuery,
      entity_label:target.dataset.feedbackName||document.querySelector("main h1")?.textContent||"Trang thông tin này",
      entity_type:target.dataset.feedbackType,issue:target.dataset.feedbackIssue});
  });
  window.OpenPQFeedback={open};
})();
