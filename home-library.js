/* Homepage Cẩm nang: practical reading only. Explore remains for places,
   Chuyện đảo remains for legends and local stories. */
(() => {
  "use strict";
  const section=document.getElementById("home-library");
  const grid=section?.querySelector(".home-library-grid");
  if(!section||!grid)return;

  // Handpicked how-to articles from the READY_PUBLIC guide. A story or a
  // bare destination listing must never become the homepage guide lead.
  const guides=[
    {id:"knowledge_014_bai-sao",topic:"BÃI BIỂN",group:"BEACH",
      title:"Bãi Sao hôm nào đẹp?",
      intro:"Xem gió, sóng và tình hình thực tế trước khi chọn một ngày tắm biển."},
    {id:"knowledge_056_bun-quay-phu-quoc",topic:"ẨM THỰC",group:"FOOD",
      title:"Ăn bún quậy sao cho đúng điệu?",
      intro:"Chọn món, tự pha chén chấm rồi thưởng thức cho ra chất Phú Quốc."},
    {id:"knowledge_125_cau-ca-lon",topic:"TRẢI NGHIỆM",group:"SEA",
      title:"Đi câu cá lớn cần biết gì?",
      intro:"Phân biệt một chuyến biển thật sự với tour tham quan có thêm đoạn câu."},
    {id:"knowledge_067_nha-thung-nuoc-mam",topic:"LÀNG NGHỀ",group:"CRAFT",
      title:"Ghé nhà thùng nước mắm thế nào cho thú vị?",
      intro:"Nhìn tận mắt thùng gỗ, cách ủ chượp và những điều đáng hỏi người làm nghề."},
    {id:"knowledge_126_cau-muc-dem",topic:"TRẢI NGHIỆM",group:"SEA",
      title:"Đi câu mực đêm có gì cần biết?",
      intro:"Chọn một buổi tối trên biển và chuẩn bị cho chuyến đi thoải mái hơn."},
    {id:"knowledge_133_night-market",topic:"ĂN UỐNG",group:"FOOD",
      title:"Đi chợ đêm ăn gì, hỏi giá thế nào?",
      intro:"Đi một vòng chợ đêm nhẹ nhàng, chọn món vừa ý và hỏi giá trước khi gọi."},
    {id:"knowledge_137_visit-fish-sauce-house-pepper-farm",topic:"TRẢI NGHIỆM",group:"CRAFT",
      title:"Ghé nhà thùng rồi thăm vườn tiêu",
      intro:"Một lịch trình tìm hiểu hai nghề truyền thống, không phải chạy theo điểm check-in."}
  ];
  const approvedById=new Map();
  const make=(tag,className,content)=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(content!==undefined)node.textContent=String(content);
    return node;
  };
  // A Phú Quốc day is stable for all readers, wherever they are travelling from.
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const part=name=>Number(parts.find(p=>p.type===name)?.value||0);
  const today=Math.floor(Date.UTC(part("year"),part("month")-1,part("day"))/86400000);
  const start=Math.floor(Date.UTC(2026,8,25)/86400000);
  const hash=value=>{
    let h=2166136261;
    for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  };

  function choose(items){
    approvedById.clear();
    for(const item of items){
      if(item?.topic_id&&item.route==="/guide/article.html?id="+encodeURIComponent(item.topic_id)){
        approvedById.set(item.topic_id,item);
      }
    }
    // Show only fully published, photographically supported practical guides.
    const available=guides.filter(g=>{
      const p=approvedById.get(g.id);
      return p?.image?.url && /^\/assets\/(?:media|uploads)\/|^https:\/\/(?:commons\.wikimedia\.org|visitphuquoc\.com\.vn)\//.test(p.image.url);
    });
    if(available.length<3)return [];
    const leadCandidates=guides.slice(0,4).filter(g=>available.some(a=>a.id===g.id));
    if(!leadCandidates.length)return [];
    const dayOffset=((today-start)%leadCandidates.length+leadCandidates.length)%leadCandidates.length;
    const lead=leadCandidates[dayOffset];
    const remaining=available.filter(g=>g.id!==lead.id)
      .sort((a,b)=>hash(today+":"+a.id)-hash(today+":"+b.id));
    const result=[lead];
    // The three visible mobile cards should invite three different needs.
    for(const guide of remaining){
      if(result.some(p=>p.group===guide.group))continue;
      result.push(guide);
      if(result.length===3)break;
    }
    for(const guide of remaining){
      if(result.length===4)break;
      if(!result.some(p=>p.id===guide.id))result.push(guide);
    }
    return result;
  }

  function renderCard(guide){
    const data=approvedById.get(guide.id);
    const card=make("a","home-library-card");
    card.href=data.route;
    card.dataset.guideId=guide.id;
    const figure=make("figure","home-library-card-image");
    const image=make("img");
    image.src=data.image.url;
    image.alt=data.image.alt||guide.title;
    image.loading="lazy";
    image.decoding="async";
    figure.append(image);
    const copy=make("div","home-library-card-copy");
    copy.append(
      make("span","home-library-topic",guide.topic),
      make("strong",null,guide.title),
      make("p",null,guide.intro),
      make("span","home-library-action","Đọc cẩm nang →")
    );
    card.append(figure,copy);
    return card;
  }

  grid.addEventListener("error",event=>{
    const image=event.target;
    if(image?.tagName!=="IMG")return;
    const figure=image.closest(".home-library-card-image");
    if(figure){
      figure.classList.add("is-missing");
      image.remove();
    }
  },true);

  async function load(){
    try{
      const response=await fetch("/data/views/knowledge-home.json",{cache:"no-store"});
      if(!response.ok)throw Error("Guide feed unavailable");
      const payload=await response.json();
      if(!Array.isArray(payload.objects)||!Number.isInteger(payload.count))return;
      const selected=choose(payload.objects);
      if(selected.length<3)return;
      grid.replaceChildren(...selected.map(renderCard));
      const count=String(payload.count);
      const label=section.querySelector(".home-library-count");
      const all=section.querySelector(".home-library-all-link");
      const mobile=section.querySelector(".home-library-mobile-cta");
      if(label)label.textContent="CẨM NANG PHÚ QUỐC / "+count+" BÀI";
      if(all)all.textContent="Xem thư viện "+count+" bài →";
      if(mobile)mobile.textContent="Xem thư viện "+count+" bài →";
    }catch(_error){
      // A usable editorial fallback is included in index.html for offline visits.
    }
  }
  if("IntersectionObserver" in window){
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(x=>x.isIntersecting))return;
      observer.disconnect();
      load();
    },{rootMargin:"700px 0px"});
    observer.observe(section);
  }else load();
})();
