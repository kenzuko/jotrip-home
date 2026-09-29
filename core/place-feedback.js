/* Shared, account-free correction form. All reports remain unverified until CMS review. */
(()=>{
  "use strict";
  const labels={
    closed:"Nơi này đã đóng cửa",location:"Vị trí trên bản đồ chưa đúng",
    hours:"Giờ hoạt động đã thay đổi",phone:"Số điện thoại chưa đúng",
    details:"Thông tin khác chưa chính xác",new_place:"Đề xuất địa điểm mới",
    other:"Tôi muốn bổ sung thông tin",translation:"Bản dịch chưa tự nhiên hoặc chưa đúng"
  };
  const translationLocales=new Set(["ko","ru","lo","zh-Hans","zh-Hant","fr"]);
  const translationNotices={
    ko:["이 번역은 AI의 도움을 받아 작성되었으며 계속 다듬고 있습니다. 부정확하거나 어색한 표현이 있다면 Open Phu Quoc이 더 나은 번역으로 고칠 수 있도록 알려주세요. ❤️","번역 수정 제안"],
    ru:["Этот перевод выполнен с помощью ИИ и ещё дорабатывается. Если вы заметили неточность или неестественную фразу, сообщите нам, чтобы Open Phu Quoc мог улучшить перевод. ❤️","Предложить исправление"],
    lo:["ຄຳແປນີ້ຈັດເຮັດຂຶ້ນດ້ວຍການຊ່ວຍເຫຼືອຂອງ AI ແລະຍັງກຳລັງປັບປຸງ. ຖ້າພົບຈຸດທີ່ບໍ່ຖືກຕ້ອງ ຫຼືບໍ່ເປັນທຳມະຊາດ ກະລຸນາແນະນຳເພື່ອໃຫ້ Open Phu Quoc ປັບແກ້ໃຫ້ດີຂຶ້ນ. ❤️","ແນະນຳການແກ້ໄຂ"],
    "zh-Hans":["本翻译在 AI 辅助下完成，目前仍在持续完善。如果您发现不准确或不自然的表达，欢迎提出建议，帮助 Open Phu Quoc 改进翻译。❤️","建议修改翻译"],
    "zh-Hant":["本翻譯在 AI 協助下完成，目前仍在持續完善。如果您發現不準確或不自然的表達，歡迎提出建議，協助 Open Phu Quoc 改進翻譯。❤️","建議修改翻譯"],
    fr:["Cette traduction a été réalisée avec l’aide de l’IA et continue d’être améliorée. Si un passage vous semble inexact ou peu naturel, signalez-le pour aider Open Phu Quoc à mieux le formuler. ❤️","Proposer une correction"]
  };
  const translationUI=window.OpenPQFeedbackLocales||{};
  const currentLocale=()=>document.documentElement.lang||"vi";
  const isAiTranslation=()=>translationLocales.has(currentLocale())&&(
    document.body.dataset.aiTranslation==="true"||document.querySelector("[data-translation-ai='true']")
  );
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let dialog,form,status,submit,photoRow,config=null,current=null,loadConfig,lastSelection="",selectionButton=null;
  // Public feedback is served from the canonical Open Phu Quoc origin.
  const apiEndpoint="/api/feedback";
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
      '<label class="opq-feedback-field" id="opqFeedbackQuote" hidden>Đoạn bạn muốn góp ý<textarea name="quoted_text" maxlength="500" rows="2" placeholder="Chọn đoạn trong bài hoặc dán vào đây"></textarea></label>'+
      '<label class="opq-feedback-field" id="opqFeedbackSuggestion" hidden>Cách viết bạn đề xuất<textarea name="suggested_text" maxlength="1500" rows="3" placeholder="Bạn có thể viết lại câu này nếu muốn"></textarea></label>'+
      '<label class="opq-feedback-field" id="opqFeedbackDetails">Chia sẻ thêm (nếu có)<textarea name="details" maxlength="1500" rows="4" placeholder="Thông tin đúng là gì? Bạn biết từ khi nào?"></textarea></label>'+
      '<input type="hidden" name="language"><input type="hidden" name="source_revision">'+
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
  const localeCopy=()=>translationUI[current?.language]||null;
  function syncKind(){
    const isNew=form.elements.issue.value==="new_place",isTranslation=form.elements.issue.value==="translation",ui=localeCopy();
    form.querySelector("#opqFeedbackNewName").hidden=!isNew;
    form.querySelector("#opqFeedbackQuote").hidden=!isTranslation;
    form.querySelector("#opqFeedbackSuggestion").hidden=!isTranslation;
    form.elements.new_name.required=isNew;
    form.elements.details.required=isNew;
    form.elements.details.minLength=isNew?10:0;
    const detailsField=form.querySelector("#opqFeedbackDetails");
    detailsField.firstChild.textContent=isNew?"Địa chỉ hoặc khu vực (bắt buộc)":ui?.details||"Chia sẻ thêm (nếu có)";
    form.elements.details.placeholder=isNew?"Địa chỉ hoặc khu vực, đặc điểm nhận biết, giờ mở cửa nếu biết...":
      ui?.detailsHint||"Thông tin đúng là gì? Bạn biết từ khi nào?";
    form.querySelector("#opqFeedbackQuote").firstChild.textContent=ui?.quote||"Đoạn bạn muốn góp ý";
    form.querySelector("#opqFeedbackSuggestion").firstChild.textContent=ui?.suggestion||"Cách viết bạn đề xuất";
    form.elements.quoted_text.placeholder=ui?.quoteHint||"Chọn đoạn trong bài hoặc dán vào đây";
    form.elements.suggested_text.placeholder=ui?.suggestionHint||"Bạn có thể viết lại câu này nếu muốn";
    form.elements.issue.closest("label").firstChild.textContent=ui?.question||"Bạn muốn góp ý điều gì?";
    dialog.querySelector("#opqFeedbackTitle").textContent=ui?.title||"Góp ý thông tin";
    dialog.querySelector(".opq-feedback-head small").textContent=ui?.kicker||"CÙNG GIỮ THÔNG TIN CHÍNH XÁC";
    dialog.querySelector(".opq-feedback-close").setAttribute("aria-label",ui?.close||"Đóng cửa sổ");
    dialog.querySelector("[data-feedback-cancel]").textContent=ui?.cancel||"Bỏ qua";
    form.querySelector(".opq-feedback-note").innerHTML=ui
      ?esc(ui.privacy)+' <a href="/about/feedback-privacy.html" target="_blank" rel="noopener">'+esc(ui.privacyLink)+'</a>.'
      :'Không cần đăng nhập. Chỉ gửi thông tin liên quan đến địa điểm hoặc bài viết. Tránh ảnh có thông tin cá nhân. <a href="/about/feedback-privacy.html" target="_blank" rel="noopener">Dữ liệu góp ý được sử dụng thế nào?</a>';
    submit.textContent=ui?.submit||"Gửi góp ý";
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
      entity_label:String(details.entity_label||"Trang thông tin này").slice(0,120),
      language:String(details.language||currentLocale()).slice(0,12),
      source_revision:String(details.source_revision||document.body.dataset.translationRevision||"").slice(0,80),
      quoted_text:String(details.quoted_text||"").slice(0,500)
    };
    form.reset();
    submit.type="submit";submit.onclick=null;
    form.querySelectorAll(".opq-feedback-field").forEach(el=>el.hidden=false);
    form.querySelector(".opq-feedback-note").hidden=false;
    form.elements.language.value=current.language;
    form.elements.source_revision.value=current.source_revision;
    form.elements.quoted_text.value=current.quoted_text;
    const isNew=details.issue==="new_place",isTranslation=details.issue==="translation"&&translationLocales.has(current.language)&&current.entity_type==="article";
    form.elements.issue.innerHTML=Object.entries(labels)
      .filter(([id])=>isNew?id==="new_place":current.entity_type==="article"?["details","other",...(translationLocales.has(current.language)?["translation"]:[])].includes(id):id!=="new_place"&&id!=="translation")
      .map(([id,label])=>'<option value="'+id+'">'+esc(translationUI[current.language]?.issues?.[id]||(current.entity_type==="article"&&id==="details"?"Thông tin trong bài chưa đúng":label))+'</option>').join("");
    form.elements.issue.value=isNew?"new_place":isTranslation?"translation":"details";
    form.querySelector("#opqFeedbackContext").textContent=isNew
      ?"Biết một địa điểm hữu ích chưa có trong danh sách? Chia sẻ với Open Phu Quoc nhé."
      :current.entity_label;
    syncKind();
    const ui=localeCopy();
    if(isTranslation)form.querySelector("#opqFeedbackContext").textContent=current.language.toUpperCase()+" · "+current.entity_label;
    status.textContent=ui?.checking||"Đang kiểm tra kênh góp ý...";
    status.className="opq-feedback-status";
    submit.disabled=true;
    submit.textContent=ui?.submit||"Gửi góp ý";
    photoRow.hidden=true;
    if(dialog.showModal)dialog.showModal();else dialog.setAttribute("open","");
    capabilities().then(cfg=>{
      if(!dialog.open)return;
      if(!cfg.enabled){
        status.textContent=ui?.unavailable||"Kênh góp ý chưa sẵn sàng lúc này. Bạn thử lại sau nhé.";
        submit.disabled=true;
        return;
      }
      status.textContent="";
      submit.disabled=false;
      photoRow.hidden=isTranslation||!cfg.photo_enabled;
    });
  }
  async function send(event){
    event.preventDefault();
    if(!current||submit.disabled)return;
    const isNew=form.elements.issue.value==="new_place",ui=localeCopy();
    const name=isNew?form.elements.new_name.value.trim():current.entity_label;
    if(!name){status.textContent="Bạn cho mình biết tên địa điểm nhé.";return;}
    const data=new FormData(form);
    data.set("entity_type",isNew?"general":current.entity_type);
    data.set("entity_id",isNew?"":current.entity_id);
    data.set("entity_label",name);
    data.set("source_url",location.href);
    if(data.get("issue")!=="translation"){
      data.delete("quoted_text");data.delete("suggested_text");data.set("source_revision","");
    }
    if(data.get("issue")==="translation"&&Math.max(String(data.get("details")||"").trim().length,String(data.get("suggested_text")||"").trim().length)<5){status.textContent=ui?.missing||"Bạn thêm câu sửa hoặc mô tả lỗi nhé.";form.elements.suggested_text.focus();return;}
    const photo=data.get("photo");
    if(photo&&photo.size>3145728){status.textContent="Ảnh hơi lớn. Bạn chọn ảnh dưới 3 MB nhé.";return;}
    if(photo&&!photo.size)data.delete("photo");
    submit.disabled=true;submit.textContent=ui?.sending||"Đang gửi...";
    status.textContent="";
    try{
      const r=await fetch(apiEndpoint,{method:"POST",body:data,credentials:"omit",headers:{"Accept":"application/json"}});
      const result=await r.json().catch(()=>({}));
      if(!r.ok||!result.ok){
        const messages={rate_limited:ui?.rate||"Bạn đã gửi khá nhiều góp ý. Mình thử lại sau nhé.",
          feedback_not_configured:ui?.unavailable||"Kênh góp ý đang được chuẩn bị. Bạn quay lại sau nhé.",
          storage_unavailable:ui?.server||"Chưa lưu được góp ý. Bạn thử lại sau nhé.",
          photo_save_failed:ui?.server||"Chưa lưu được ảnh. Bạn thử gửi lại hoặc bỏ ảnh nhé.",
          photos_unavailable:ui?.unavailable||"Chưa nhận ảnh lúc này. Bạn thử gửi lại không kèm ảnh nhé.",
          invalid_fields:ui?.invalid||"Bạn kiểm tra lại thông tin vừa nhập nhé."};
        throw new Error(messages[result.error]||"Chưa gửi được góp ý. Bạn thử lại sau nhé.");
      }
      form.querySelector("#opqFeedbackContext").textContent=ui?.successTitle||"Cảm ơn bạn đã giúp thông tin về Phú Quốc chính xác hơn.";
      form.querySelectorAll(".opq-feedback-field").forEach(el=>el.hidden=true);
      form.querySelector(".opq-feedback-note").hidden=true;
      status.className="opq-feedback-status opq-feedback-success";
      status.textContent=ui?ui.sent.replace("{ref}",result.reference):"Đã nhận góp ý. Mã tham chiếu: "+result.reference+". Bên mình sẽ kiểm tra trước khi cập nhật.";
      submit.textContent=ui?.done||"Hoàn tất";
      submit.type="button";
      submit.disabled=false;
      submit.onclick=()=>dialog.close();
    }catch(error){
      status.textContent=error.message;
      submit.disabled=false;submit.textContent=ui?.retry||"Gửi lại";
    }
  }
  function selectedArticleText(){
    const selection=window.getSelection?.();
    if(!selection||selection.isCollapsed||!selection.rangeCount)return "";
    const root=document.querySelector("#articleRoot article, #knowledgeArticle article");
    if(!root||!root.contains(selection.getRangeAt(0).commonAncestorContainer))return "";
    return String(selection).trim().slice(0,500);
  }
  function refresh(){
    // No misleading AI banner on Vietnamese/English or untranslated articles.
    const active=!!isAiTranslation(),language=currentLocale(),copy=translationNotices[language];
    document.querySelectorAll('[data-openpq-feedback][data-feedback-type="article"]:not([data-feedback-issue="translation"])').forEach(button=>{
      if(!button.dataset.feedbackOriginalLabel)button.dataset.feedbackOriginalLabel=button.textContent;
      let note=button.parentElement.querySelector("[data-opq-translation-note]");
      if(!active){button.hidden=false;if(note)note.remove();return;}
      button.hidden=true;
      if(!note){
        note=document.createElement("div");
        note.className="opq-translation-note";
        note.setAttribute("data-opq-translation-note","");
        note.innerHTML='<p></p><button class="opq-feedback-trigger opq-feedback-trigger--quiet" type="button" data-openpq-feedback data-feedback-query-id data-feedback-type="article" data-feedback-issue="translation"></button>';
        button.insertAdjacentElement("beforebegin",note);
      }
      note.querySelector("p").textContent=copy[0];
      const trigger=note.querySelector("button");
      trigger.lang=language;
      trigger.textContent=copy[1]+" ↗";
      trigger.dataset.feedbackRevision=document.body.dataset.translationRevision||"";
    });
  }
  document.addEventListener("pointerdown",event=>{
    if(event.target.closest?.("[data-openpq-feedback]"))lastSelection=selectedArticleText();
  },true);
  document.addEventListener("click",event=>{
    const target=event.target.closest?.("[data-openpq-feedback]");
    if(!target)return;
    event.preventDefault();
    const fromQuery=target.hasAttribute("data-feedback-query-id")?new URLSearchParams(location.search).get("id"):"";
    open({entity_id:target.dataset.feedbackId||fromQuery,
      entity_label:target.dataset.feedbackName||document.querySelector("main h1")?.textContent||"Trang thông tin này",
      entity_type:target.dataset.feedbackType,issue:target.dataset.feedbackIssue,
      language:target.lang||target.dataset.feedbackLanguage||currentLocale(),
      source_revision:target.dataset.feedbackRevision,
      quoted_text:target.dataset.feedbackIssue==="translation"?(lastSelection||selectedArticleText()):""});
    lastSelection="";
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",refresh);
  else refresh();
  window.OpenPQFeedback={open,refresh};
})();
