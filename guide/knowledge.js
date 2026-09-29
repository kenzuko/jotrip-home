(() => {
  "use strict";
  const endpoint="/data/views/knowledge-public.json";
  const localized=path=>window.OpenPQI18n?.localize?.(path)||path;
  const page=document.body.dataset.knowledgePage;
  const tr=(key,fallback,vars={})=>window.OpenPQI18n?.format?.("knowledge."+key,vars,fallback)||
    String(fallback).replace(/\{([A-Za-z0-9_]+)\}/g,(_,k)=>Object.prototype.hasOwnProperty.call(vars,k)?String(vars[k]):"{"+k+"}");
  const labelForType=key=>tr("types."+key,{PLACE:"Điểm đến",NATURE:"Thiên nhiên",FOOD:"Ẩm thực",PRACTICAL:"Đi lại & tiện ích",HISTORY_LORE:"Lịch sử & văn hóa",ACTIVITY:"Trải nghiệm",MEMORY_CHANGE:"Đảo đổi thay"}[key]||"Cẩm nang");
  const fold=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
  const el=(tag,cls,value)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node;};
  const filters=document.getElementById("knowledgeFilters");
  const cards=document.getElementById("knowledgeCards");
  const article=document.getElementById("knowledgeArticle");
  const input=document.getElementById("knowledgeQuery");
  const count=document.getElementById("knowledgeCount");
  let items=[],active="ALL";
  function showList(){
    const query=fold(input.value).trim();
    const matching=items.filter(o=>(active==="ALL"||o.topic_type===active)&&(!query||fold([o.title,o.editorial.short_summary,o.editorial.practical].join(" ")).includes(query)));
    count.textContent=tr("count","{count} bài",{count:matching.length});
    cards.replaceChildren();
    if(!matching.length){cards.append(el("p",null,tr("no_match","Chưa tìm thấy bài phù hợp. Bạn thử từ khác nhé.")));return;}
    const fragment=document.createDocumentFragment();
    for(const o of matching){
      const a=el("a","knowledge-card");a.href=localized(o.route);
      const photo=o.media?.images?.[0];
      if(photo){
        const frame=el("figure","knowledge-card-photo");
        const img=el("img");img.src=photo.url;img.alt=photo.alt||o.title;
        img.loading="lazy";img.decoding="async";
        img.onerror=()=>frame.remove();
        frame.append(img);a.append(frame);
      }
      a.append(el("span","type",labelForType(o.topic_type)));
      a.append(el("h2",null,o.title));
      a.append(el("p",null,o.editorial.short_summary));
      a.append(el("span","read",tr("read","Đọc bài →")));
      fragment.append(a);
    }
    cards.append(fragment);
  }
  function showFilters(){
    filters.replaceChildren();
    for(const key of ["ALL",..."PLACE,NATURE,FOOD,PRACTICAL,HISTORY_LORE,ACTIVITY,MEMORY_CHANGE".split(",").filter(x=>items.some(o=>o.topic_type===x))]){
      const button=el("button",null,key==="ALL"?tr("all","Tất cả"):labelForType(key));
      button.type="button";
      button.setAttribute("aria-pressed",String(key===active));
      button.addEventListener("click",()=>{active=key;showFilters();showList();});
      filters.append(button);
    }
  }
  function showArticle(o){
    const ed=o.editorial;
    document.title=o.title+" - "+tr("title_suffix","Cẩm nang Phú Quốc");
    document.querySelector('link[rel="canonical"]')?.setAttribute("href","https://openphuquoc.com"+localized(o.route));
    document.querySelector('meta[name="description"]')?.setAttribute("content",ed.short_summary.slice(0,190));
    article.replaceChildren();
    const root=el("article","knowledge-article");root.dataset.cmsRecord=o.topic_id;
    const back=el("a","knowledge-back",tr("back_all","← Tất cả bài cẩm nang"));
    back.href=localized("/guide/knowledge.html");root.append(back);
    const headline=el("h1",null,o.title),lead=el("p","knowledge-lead",ed.short_summary);
    headline.dataset.cmsField="title";lead.dataset.cmsField="editorial.short_summary";
    root.append(el("p","knowledge-type",labelForType(o.topic_type)),headline,lead);
    const photographs=o.media?.images||[];
    if(photographs.length){
      const gallery=el("div","knowledge-article-photos"+(photographs.length===1?" single":""));
      for(const photo of photographs){
        const figure=el("figure","knowledge-article-photo");
        const img=el("img");img.src=photo.url;img.alt=photo.alt||o.title;
        img.loading=gallery.children.length?"lazy":"eager";img.decoding="async";
        img.onerror=()=>{figure.classList.add("image-unavailable");img.remove();figure.prepend(el("p",null,tr("image_unavailable","Ảnh hiện chưa tải được.")));};
        figure.append(img);
        if(photo.caption||photo.credit){
          const cap=el("figcaption");
          if(photo.caption)cap.append(el("span",null,photo.caption));
          if(photo.credit){
            const managed=/^CC(?:0| BY)/i.test(String(photo.license||"")) ||
              /^https:\/\/creativecommons\.org\/(?:licenses|publicdomain)\//i.test(String(photo.license_url||"")) ||
              /(?:^|\s)(?:Kho ảnh|Kho tư liệu)?\s*JoTrip(?:\s|$|·)/i.test(String(photo.credit||""));
            if(!managed){
              const creditText=tr("photo_prefix","Ảnh: ")+String(photo.credit).replace(/^Ảnh:\s*/i,"");
              cap.append(el("small",null,creditText));
            }
          }
          figure.append(cap);
        }
        gallery.append(figure);
      }
      root.append(gallery);
    }
    const fallbackHeadings={
      PLACE:["Ghé thế nào cho tiện?","Điều nên biết trước khi tới","Trước khi ghé"],
      NATURE:["Xem điều kiện thực tế","Những điều dễ bỏ sót","Khi ra ngoài"],
      FOOD:["Ăn và chọn món","Điều cần biết khi gọi","Trước khi ăn hoặc mua"],
      PRACTICAL:["Chuẩn bị thế nào?","Những trường hợp cần lưu ý","Trước khi đi"],
      HISTORY_LORE:["Tìm hiểu thêm","Hiểu đúng câu chuyện","Nếu ghé thăm"],
      ACTIVITY:["Sắp lịch thế nào?","Điều có thể khác dự tính","Trước chuyến đi"],
      MEMORY_CHANGE:["Nhìn đảo hôm nay","Đọc tư liệu đúng thời điểm","Nếu muốn xem tận nơi"]
    };
    const fallback=fallbackHeadings[o.topic_type]||["Điều nên biết","Đọc thêm","Trước khi đi"];
    const heading=[
      tr("headings."+o.topic_type+".practical",fallback[0]),
      tr("headings."+o.topic_type+".reality",fallback[1]),
      tr("headings."+o.topic_type+".before",fallback[2])
    ];
    if(o.topic_type==="FOOD"&&[64,65,66,67,68].includes(o.number))heading[0]=tr("headings.FOOD.buy","Chọn mua và tìm hiểu");
    for(const [title,value,field] of [
      [heading[0],ed.practical,"editorial.practical"],
      [heading[1],ed.expectation_vs_reality,"editorial.expectation_vs_reality"]]){
      if(!value)continue;
      const section=el("section"),text=el("p",null,value);text.dataset.cmsField=field;
      section.append(el("h2",null,title),text);root.append(section);
    }
    if(ed.before_you_go?.length){
      const section=el("section");section.append(el("h2",null,heading[2]));
      const list=el("ul");
      ed.before_you_go.forEach((item,i)=>{
        const li=el("li"),label=el("span",null,item);
        label.dataset.cmsField="editorial.before_you_go."+i;
        li.append(label);list.append(li);
      });
      section.append(list);root.append(section);
    }
    if(o.location?.map && window.OpenPQVisual){
      const location=el("div","knowledge-location");
      location.innerHTML=OpenPQVisual.locator(null,{
        title:tr("location_title","Địa điểm trên bản đồ"),label:o.location.label,
        map:o.location.map,
        openLabel:tr("open_map","Mở bản đồ lớn ↗")
      });
      if(location.firstElementChild)root.append(location);
    }
    // Research questions remain in internal data until answers are editorially verified.
    const more=el("aside","knowledge-further");
    more.append(el("h2",null,tr("further","Tìm hiểu thêm")));
    for(const item of o.links||[]){
      const link=el("a",null,item.label);
      link.href=item.url;
      link.target="_blank";
      link.rel="noopener noreferrer";
      more.append(link);
    }
    const weather=el("a",null,tr("weather","Thời tiết & biển"));weather.href=localized("/weather/");
    const map=el("a",null,tr("explore_map","Bản đồ khám phá"));map.href=localized("/explore/");
    more.append(weather,map);root.append(more);article.append(root);
  }
  async function init(){
    try{
      await window.OpenPQI18n?.loadUi?.().catch(()=>null);
      const payload=window.OpenPQI18nContent?.knowledge
        ? await window.OpenPQI18nContent.knowledge()
        : await fetch(endpoint,{cache:"default"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()});
      items=payload.objects||[];
      if(page==="library"){
        const params=new URLSearchParams(location.search);
        const categoryFromUrl=params.get("category");
        if(["PLACE","NATURE","FOOD","PRACTICAL","HISTORY_LORE","ACTIVITY","MEMORY_CHANGE"].includes(categoryFromUrl))active=categoryFromUrl;
        if(params.has("q"))input.value=params.get("q")||"";
        showFilters();showList();input.addEventListener("input",showList);
      }
      else if(page==="article"){
        const id=new URLSearchParams(location.search).get("id")||"";
        const found=items.find(o=>o.topic_id===id);
        if(found)showArticle(found);
        else{
          const link=el("a",null,tr("view_all","Xem tất cả bài"));link.href=localized("/guide/knowledge.html");
          article.replaceChildren(el("p",null,tr("missing","Bài này chưa được công khai hoặc không tồn tại.")),link);
        }
      }
    }catch(error){
      const target=page==="library"?cards:article;
      target?.replaceChildren(el("p",null,tr("load_error","Cẩm nang chưa mở được lúc này. Bạn thử tải lại trang nhé.")));
    }
  }
  init();
})();