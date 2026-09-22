(() => {
  "use strict";
  const endpoint="/data/views/knowledge-public.json";
  const page=document.body.dataset.knowledgePage;
  const labels={PLACE:"Điểm đến",NATURE:"Thiên nhiên",FOOD:"Ẩm thực",PRACTICAL:"Đi lại & tiện ích",HISTORY_LORE:"Lịch sử & văn hóa",ACTIVITY:"Trải nghiệm",MEMORY_CHANGE:"Đảo đổi thay"};
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
    count.textContent=matching.length+" bài";
    cards.replaceChildren();
    if(!matching.length){cards.append(el("p",null,"Chưa tìm thấy bài phù hợp. Bạn thử từ khác nhé."));return;}
    const fragment=document.createDocumentFragment();
    for(const o of matching){
      const a=el("a","knowledge-card");a.href=o.route;
      a.append(el("span","type",labels[o.topic_type]||"Cẩm nang"));
      a.append(el("h2",null,o.title));
      a.append(el("p",null,o.editorial.short_summary));
      a.append(el("span","read","Đọc bài →"));
      fragment.append(a);
    }
    cards.append(fragment);
  }
  function showFilters(){
    filters.replaceChildren();
    for(const key of ["ALL",...Object.keys(labels).filter(x=>items.some(o=>o.topic_type===x))]){
      const button=el("button",null,key==="ALL"?"Tất cả":labels[key]);
      button.type="button";
      button.setAttribute("aria-pressed",String(key===active));
      button.addEventListener("click",()=>{active=key;showFilters();showList();});
      filters.append(button);
    }
  }
  function showArticle(o){
    const ed=o.editorial;
    document.title=o.title+" - Cẩm nang Phú Quốc";
    document.querySelector('link[rel="canonical"]')?.setAttribute("href","https://openphuquoc.com"+o.route);
    document.querySelector('meta[name="description"]')?.setAttribute("content",ed.short_summary.slice(0,190));
    article.replaceChildren();
    const root=el("article","knowledge-article");
    const back=el("a","knowledge-back","← Tất cả bài cẩm nang");
    back.href="/guide/knowledge.html";root.append(back);
    root.append(el("p","knowledge-type",labels[o.topic_type]||"Cẩm nang"),el("h1",null,o.title),el("p","knowledge-lead",ed.short_summary));
    for(const [title,value] of [["Điều nên biết",ed.practical],["Thực tế có thể khác bạn nghĩ",ed.expectation_vs_reality]]){
      if(!value)continue;
      const section=el("section");section.append(el("h2",null,title),el("p",null,value));root.append(section);
    }
    if(ed.before_you_go?.length){
      const section=el("section");section.append(el("h2",null,"Trước khi đi"));
      const list=el("ul");for(const item of ed.before_you_go)list.append(el("li",null,item));
      section.append(list);root.append(section);
    }
    if(ed.curiosity_questions?.length){
      const section=el("section");section.append(el("h2",null,"Có thể bạn đang thắc mắc"));
      const list=el("ul");for(const item of ed.curiosity_questions)list.append(el("li",null,item));
      section.append(list);root.append(section);
    }
    const more=el("aside","knowledge-further");
    more.append(el("h2",null,"Xem thông tin hôm nay"));
    const weather=el("a",null,"Thời tiết & biển");weather.href="/weather/";
    const map=el("a",null,"Bản đồ khám phá");map.href="/explore/";
    more.append(weather,map);root.append(more);article.append(root);
  }
  async function init(){
    try{
      const response=await fetch(endpoint,{cache:"no-store"});
      if(!response.ok)throw Error("HTTP "+response.status);
      const payload=await response.json();items=payload.objects||[];
      if(page==="library"){showFilters();showList();input.addEventListener("input",showList);}
      else if(page==="article"){
        const id=new URLSearchParams(location.search).get("id")||"";
        const found=items.find(o=>o.topic_id===id);
        if(found)showArticle(found);
        else{
          const link=el("a",null,"Xem tất cả bài");link.href="/guide/knowledge.html";
          article.replaceChildren(el("p",null,"Bài này chưa được công khai hoặc không tồn tại."),link);
        }
      }
    }catch(error){
      const target=page==="library"?cards:article;
      target?.replaceChildren(el("p",null,"Cẩm nang chưa mở được lúc này. Bạn thử tải lại trang nhé."));
    }
  }
  init();
})();