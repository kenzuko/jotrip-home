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
  // Front-page stories are handpicked; do not confuse the Cẩm nang teaser with
  // the practical /nearme directory. All picks must also exist in the public feed.
  const featured=[
    "knowledge_116_cho-phu-quoc-co-that-su-leo-cay",
    "knowledge_008_rach-vem",
    "knowledge_056_bun-quay-phu-quoc",
    "knowledge_067_nha-thung-nuoc-mam",
    "knowledge_142_ham-ninh-truoc-va-sau-chinh-trang",
    "knowledge_014_bai-sao",
    "knowledge_099_vi-sao-goi-la-phu-quoc",
    "knowledge_138_phu-quoc-khi-troi-mua"
  ];
  const discovery=[
    "knowledge_070_cho-duong-dong-an-gi",
    "knowledge_131_sunset-watching",
    "knowledge_150_mot-ngay-o-phu-quoc-van-hanh-the-nao",
    "knowledge_127_snorkeling",
    "knowledge_105_nguon-goc-ten-hon-thom",
    "knowledge_125_cau-ca-lon",
    "knowledge_132_sunrise-watching",
    "knowledge_126_cau-muc-dem",
    "knowledge_006_ham-ninh",
    "knowledge_122_lich-su-nghe-nuoc-mam",
    "knowledge_137_visit-fish-sauce-house-pepper-farm"
  ];
  const homeCopy={
    "knowledge_116_cho-phu-quoc-co-that-su-leo-cay":["Chó Phú Quốc có thật sự leo cây?","Nhanh nhẹn, giỏi leo trèo, nhưng chuyện chó Phú Quốc leo cây có đúng như lời đồn?","CHUYỆN ĐẢO"],
    "knowledge_008_rach-vem":["Rạch Vẹm lúc nào cũng có sao biển?","Bức ảnh thì đẹp, nhưng không phải ngày nào đến cũng gặp sao biển.","BÃI BIỂN"],
    "knowledge_056_bun-quay-phu-quoc":["Ăn bún quậy sao cho đúng điệu?","Tự pha chén chấm, chọn topping rồi thưởng thức theo cách người địa phương.","ẨM THỰC"],
    "knowledge_067_nha-thung-nuoc-mam":["Một chuyến ghé nhà thùng","Cá cơm, thùng gỗ và những mẻ nước mắm ủ qua nhiều tháng.","LÀNG NGHỀ"],
    "knowledge_142_ham-ninh-truoc-va-sau-chinh-trang":["Cây cầu Hàm Ninh ngày ấy","Chuyện cây cầu cảng cũ và một phần ký ức của làng biển.","CHUYỆN ĐẢO"],
    "knowledge_014_bai-sao":["Bãi Sao hôm nào đẹp?","Chọn ngày tắm biển theo gió, sóng và tình hình thực tế.","BÃI BIỂN"],
    "knowledge_099_vi-sao-goi-la-phu-quoc":["Vì sao gọi là Phú Quốc?","Một cái tên, nhiều cách kể và những điều lịch sử còn bỏ ngỏ.","CHUYỆN ĐẢO"],
    "knowledge_138_phu-quoc-khi-troi-mua":["Trời mưa thì đi đâu?","Đổi lịch nhẹ nhàng, chọn điểm gần và đừng vội bỏ cả ngày đi chơi.","TRẢI NGHIỆM"],
    "knowledge_070_cho-duong-dong-an-gi":["Sáng ở chợ Dương Đông ăn gì?","Món nóng buổi sáng và nhịp mua bán của người dân đảo.","ẨM THỰC"],
    "knowledge_131_sunset-watching":["Ngắm hoàng hôn ở đâu?","Dinh Cậu hay Bãi Trường, mỗi nơi cho một buổi chiều khác nhau.","TRẢI NGHIỆM"],
    "knowledge_150_mot-ngay-o-phu-quoc-van-hanh-the-nao":["Một ngày trên đảo bắt đầu thế nào?","Từ chợ sáng, làng chài đến những con phố lên đèn.","CHUYỆN ĐẢO"],
    "knowledge_127_snorkeling":["Ngắm san hô có gì thú vị?","Một thế giới khác dưới làn nước quanh quần đảo An Thới.","TRẢI NGHIỆM"],
    "knowledge_105_nguon-goc-ten-hon-thom":["Vì sao có tên Hòn Thơm?","Nhiều cách kể về một cái tên quen thuộc của Nam đảo.","CHUYỆN ĐẢO"],
    "knowledge_125_cau-ca-lon":["Một ngày đi câu cá lớn","Ra khơi tìm bãi câu và trải nghiệm chuyến biển đúng nghĩa.","TRẢI NGHIỆM"],
    "knowledge_132_sunrise-watching":["Đón bình minh ở Hàm Ninh","Ghé bờ Đông lúc làng chài bắt đầu một ngày mới.","TRẢI NGHIỆM"],
    "knowledge_126_cau-muc-dem":["Đêm ra biển câu mực","Đảo lên đèn, tàu ra khơi và một buổi tối không giống trên bờ.","TRẢI NGHIỆM"],
    "knowledge_006_ham-ninh":["Hàm Ninh không chỉ có hải sản","Một góc bờ Đông có nhịp sống làng chài rất riêng.","ĐIỂM ĐẾN"],
    "knowledge_122_lich-su-nghe-nuoc-mam":["Nước mắm Phú Quốc có chuyện gì hay?","Từ nghề biển tới những thùng gỗ thành biểu tượng của đảo.","LÀNG NGHỀ"],
    "knowledge_137_visit-fish-sauce-house-pepper-farm":["Ghé nhà thùng rồi thăm vườn tiêu","Khám phá một Phú Quốc khác, nằm ngoài những bãi biển.","TRẢI NGHIỆM"]
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
    const eligible=items.filter(o=>o&&typeof o.topic_id==="string"&&labels[o.topic_type]
      &&o.topic_type!=="PRACTICAL"
      &&typeof o.title==="string"&&o.title.length
      &&o.route==="/guide/article.html?id="+encodeURIComponent(o.topic_id));
    const byId=new Map(eligible.map(o=>[o.topic_id,o]));
    const featuredAvailable=featured.map(id=>byId.get(id)).filter(Boolean);
    const pool=[...new Map([...featured,...discovery].map(id=>byId.get(id)).filter(Boolean)
      .map(o=>[o.topic_id,o])).values()];
    if(!featuredAvailable.length||pool.length<3)return [];
    // Start this editorial rotation with the Phú Quốc dog story, then move
    // one lead each local calendar day. No reshuffle on page refresh.
    const startDay=Math.floor(Date.UTC(2026,8,25)/86400000);
    const leadIndex=((day-startDay)%featuredAvailable.length+featuredAvailable.length)%featuredAvailable.length;
    const lead=featuredAvailable[leadIndex];
    const ranked=pool.filter(o=>o.topic_id!==lead.topic_id).sort((a,b)=>
      hash(day+":"+a.topic_id)-hash(day+":"+b.topic_id));
    const picked=[lead];
    // First two discoveries must be from different topics, including the lead.
    for(const item of ranked){
      if(picked.some(o=>o.topic_type===item.topic_type))continue;
      picked.push(item);
      if(picked.length===3)break;
    }
    // The fourth article is visible only on desktop and should also diversify.
    for(const item of ranked){
      if(picked.length>=4)break;
      if(picked.some(o=>o.topic_id===item.topic_id||o.topic_type===item.topic_type))continue;
      picked.push(item);
    }
    for(const item of ranked){
      if(picked.length>=4)break;
      if(!picked.some(o=>o.topic_id===item.topic_id))picked.push(item);
    }
    return picked;
  }
  function renderCard(item,index){
    const copy=homeCopy[item.topic_id];
    const link=make("a","home-library-card"+(index===0?" home-library-lead":""));
    link.href=item.route;
    link.append(
      make("span","home-library-topic",copy?.[2]||labels[item.topic_type]),
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
