/* Homepage Cẩm nang: editorial lead + topic-diverse, stable daily discovery.
   The lightweight public feed is generated ONLY from READY_PUBLIC articles. */
(() => {
  "use strict";
  const section=document.getElementById("home-library");
  const grid=section?.querySelector(".home-library-grid");
  if(!section||!grid)return;
  const labels={
    PLACE:"ĐIỂM ĐẾN",NATURE:"THIÊN NHIÊN",FOOD:"ẨM THỰC",
    PRACTICAL:"ĐI LẠI & TIỆN ÍCH",HISTORY_LORE:"LỊCH SỬ & VĂN HÓA",
    ACTIVITY:"TRẢI NGHIỆM",MEMORY_CHANGE:"CHUYỆN ĐẢO"
  };
  const curated=[
    "knowledge_014_bai-sao",
    "knowledge_056_bun-quay-phu-quoc",
    "knowledge_067_nha-thung-nuoc-mam",
    "knowledge_138_phu-quoc-khi-troi-mua"
  ];
  const homeCopy={
    "knowledge_014_bai-sao":["Bãi Sao hôm nào đẹp?","Chọn ngày tắm biển theo gió, sóng và điều kiện thực tế, không chỉ theo ảnh đẹp."],
    "knowledge_056_bun-quay-phu-quoc":["Ăn bún quậy sao cho đúng điệu?","Tự pha chén chấm, chọn topping và hiểu vì sao món này được người địa phương yêu thích."],
    "knowledge_067_nha-thung-nuoc-mam":["Một chuyến ghé nhà thùng","Những thùng gỗ, cá cơm, muối và câu chuyện nghề nước mắm trên đảo."],
    "knowledge_138_phu-quoc-khi-troi-mua":["Trời mưa thì đi đâu?","Đổi lịch theo từng khu, chọn điểm có mái che và biết lúc nào nên ở yên."]
  };
  const make=(tag,className,value)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(value!==undefined)node.textContent=String(value);
    return node;
  };
  // Use Phú Quốc local calendar dates, not browser/visitor time zones.
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const datePart=type=>Number(parts.find(p=>p.type===type)?.value||0);
  const day=Math.floor(Date.UTC(datePart("year"),datePart("month")-1,datePart("day"))/86400000);
  const hash=value=>{
    let h=2166136261;
    for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  };
  function select(items){
    const approved=items.filter(o=>o&&typeof o.topic_id==="string"&&labels[o.topic_type]
      &&typeof o.title==="string"&&o.title.length
      &&o.route==="/guide/article.html?id="+encodeURIComponent(o.topic_id));
    const unique=[...new Map(approved.map(o=>[o.topic_id,o])).values()];
    if(unique.length<3)return [];
    const curatedAvailable=curated.map(id=>unique.find(o=>o.topic_id===id)).filter(Boolean);
    const lead=curatedAvailable.length?curatedAvailable[((day%curatedAvailable.length)+curatedAvailable.length)%curatedAvailable.length]:unique[day%unique.length];
    const ranked=unique.filter(o=>o.topic_id!==lead.topic_id).sort((a,b)=>
      hash(String(day)+":"+a.topic_id)-hash(String(day)+":"+b.topic_id));
    const picked=[lead];
    // Spread the three visible mobile stories across three different subjects.
    for(const item of ranked){
      if(picked.some(o=>o.topic_id===item.topic_id))continue;
      if(picked.length<3&&picked.some(o=>o.topic_type===item.topic_type))continue;
      picked.push(item);
      if(picked.length===4)break;
    }
    for(const item of ranked){
      if(picked.length===4)break;
      if(!picked.some(o=>o.topic_id===item.topic_id))picked.push(item);
    }
    return picked;
  }
  function renderCard(item,index){
    const copy=homeCopy[item.topic_id];
    const link=make("a","home-library-card"+(index===0?" home-library-lead":""));
    link.href=item.route;
    link.append(
      make("span","home-library-topic",labels[item.topic_type]),
      make("strong",null,copy?.[0]||item.title),
      make("small",null,copy?.[1]||item.short_summary||""),
      make("span","home-library-action",index===0?"Đọc bài →":"Đọc thêm →")
    );
    return link;
  }
  async function load(){
    try{
      const response=await fetch("/data/views/knowledge-home.json",{cache:"no-store"});
      if(!response.ok)throw new Error("Public guide feed unavailable");
      const feed=await response.json();
      if(!Array.isArray(feed.objects)||!Number.isInteger(feed.count)||feed.count<3)return;
      const selected=select(feed.objects);
      if(selected.length<3)return;
      grid.replaceChildren(...selected.map(renderCard));
      const count=String(feed.count);
      section.querySelector(".home-library-count").textContent="CẨM NANG PHÚ QUỐC / "+count+" BÀI ĐÃ XUẤT BẢN";
      section.querySelector(".home-library-all-link").textContent="Mở tất cả "+count+" bài →";
      section.querySelector(".home-library-mobile-cta").textContent="Khám phá tất cả "+count+" bài →";
    }catch(_error){
      // Existing editorial cards remain usable when offline or if the feed fails.
    }
  }
  if("IntersectionObserver" in window){
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      load();
    },{rootMargin:"700px 0px"});
    observer.observe(section);
  }else load();
})();
