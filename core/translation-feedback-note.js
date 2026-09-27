/* Load only on actual translated article pages. Existing VI/EN pages remain unchanged. */
(()=>{
  "use strict";
  const copy={
    ko:["이 글은 AI로 번역되었습니다. 표현이 어색하거나 잘못되었다면 수정 의견을 보내 주세요. ❤️","번역 수정 제안"],
    ru:["Этот материал переведён с помощью ИИ. Если заметите неточность, помогите нам улучшить перевод. ❤️","Предложить исправление"],
    lo:["ບົດຄວາມນີ້ແປໂດຍ AI. ຖ້າພົບຄຳແປຜິດ ກະລຸນາສົ່ງຄຳແນະນຳເພື່ອຊ່ວຍປັບປຸງ. ❤️","ແນະນຳການແກ້ໄຂ"],
    "zh-CN":["本文由 AI 翻译。如发现错误或不自然的表达，欢迎帮我们改进。❤️","提出翻译修改"],
    "zh-TW":["本文由 AI 翻譯。如發現錯誤或不自然的表達，歡迎幫我們改進。❤️","提出翻譯修改"],
    fr:["Cet article a été traduit avec l’aide de l’IA. Une erreur ou une tournure peu naturelle ? Aidez-nous à améliorer la traduction. ❤️","Proposer une correction"]
  };
  // The translator passes an exact DOM paragraph and its immutable revision.
  // Never reconstruct paragraph content from an older cached translation.
  function mount({container,paragraph,articleId,locale,revision,segmentId,sourceExcerpt="",articleTitle=""}={}){
    const strings=copy[locale];
    if(!strings||!container||!paragraph||!revision||
       !/^[a-zA-Z0-9_-]{1,120}$/.test(articleId||"")||
       !/^[a-zA-Z0-9_.-]{1,120}$/.test(segmentId||""))return false;
    const note=document.createElement("aside");
    note.className="opq-translation-note";
    note.lang=locale;
    const line=document.createElement("small");
    line.textContent=strings[0];
    const button=document.createElement("button");
    button.type="button";
    button.textContent=strings[1];
    button.addEventListener("click",()=>{
      const selection=window.getSelection();
      const chosen=selection&&selection.rangeCount&&paragraph.contains(selection.anchorNode)&&
        paragraph.contains(selection.focusNode)?selection.toString().trim():"";
      const excerpt=(chosen||paragraph.textContent||"").trim().slice(0,1200);
      if(excerpt.length<5||!window.OpenPQFeedback?.open)return;
      window.OpenPQFeedback.open({issue:"translation",entity_type:"article",entity_id:articleId,
        entity_label:articleTitle||document.title,target_locale:locale,segment_id:segmentId,
        translation_revision:revision,translation_excerpt:excerpt,source_excerpt:sourceExcerpt});
    });
    note.append(line,button);
    container.replaceChildren(note);
    return true;
  }
  window.OpenPQTranslationFeedback={mount,locales:Object.keys(copy)};
})();
