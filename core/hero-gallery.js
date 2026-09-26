/* Open Phu Quoc editorial hero master. 34 subjects + 2 mobile-first JoTrip sunsets.
   Every displayed set has four photos selected deterministically by local day
   and context. Only the first and next photo are requested by the page. */
(function(root){
  "use strict";
  const BYSA4="https://creativecommons.org/licenses/by-sa/4.0/";
  const BYSA3="https://creativecommons.org/licenses/by-sa/3.0/";
  const BY4="https://creativecommons.org/licenses/by/4.0/";
  const BY2="https://creativecommons.org/licenses/by/2.0/";
  const CC0="https://creativecommons.org/publicdomain/zero/1.0/";
  const local=(id,path,label,alt,topic,credit="Kho ảnh JoTrip",extra={})=>
    ({id,src:"/assets/"+path,label,alt,topic,credit,...extra});
  const cc=(id,file,creator,license,label,alt,topic,width=1800)=>{
    const licenses={
      "CC BY-SA 4.0":BYSA4,"CC BY-SA 3.0":BYSA3,"CC BY 4.0":BY4,
      "CC BY 2.0":BY2,CC0:CC0
    };
    return {id,src:"https://commons.wikimedia.org/wiki/Special:Redirect/file/"+
      encodeURIComponent(file)+"?width="+width,label,alt,topic,
      credit:creator,sourceUrl:"https://commons.wikimedia.org/wiki/File:"+encodeURIComponent(file),
      license,licenseUrl:licenses[license],cropped:true};
  };
  const list=[
    local("beach-aerial","photos/beach-aerial-jo-library.webp","NHỮNG DẢI CÁT TRẮNG","Hàng dừa và bãi cát trắng nhìn từ trên cao","beach","Ảnh: kho tư liệu JoTrip"),
    local("island-jetty","photos/island-jetty-jo-library.jpg","BẾN ĐẢO MÀU XANH","Cầu tàu và mặt biển xanh nhìn từ trên cao","sea","Ảnh: kho tư liệu JoTrip"),
    local("fishing-aerial","photos/fishing-boats-jo-library.jpg","NHỊP SỐNG TRÊN BIỂN","Thuyền nhỏ rải rác trên mặt biển nhìn từ trên cao","harbor","Ảnh: kho tư liệu JoTrip"),
    local("may-rut","media/editorial-may-rut-island.jpg","MỘT GÓC NAM ĐẢO","Bãi biển và đảo nhỏ ở vùng Nam đảo","sea","Ảnh: kho tư liệu JoTrip"),
    local("tropical-cove","media/editorial-tropical-cove.jpg","GÓC BIỂN BÌNH YÊN","Vịnh biển xanh và cây xanh trên đảo","beach","Ảnh: kho tư liệu JoTrip"),
    local("tropical-beach","media/editorial-tropical-beach.jpg","MÙA BIỂN XANH","Bờ biển nhiệt đới và bóng dừa","beach","Ảnh: kho tư liệu JoTrip"),
    local("reef-coast","media/editorial-reef-coast.jpg","NƠI BIỂN ĐỔI MÀU","Vùng nước xanh ngọc gần rạn san hô","sea","Ảnh: kho tư liệu JoTrip"),
    local("snorkeling","media/editorial-snorkeling-coral.jpg","THẾ GIỚI DƯỚI MẶT NƯỚC","Khám phá vùng san hô gần Phú Quốc","sea","Ảnh: kho tư liệu JoTrip"),
    local("fishing-fleet","media/editorial-fishing-fleet.jpg","MỘT NGÀY CỦA NGƯỜI ĐI BIỂN","Những chiếc tàu đánh cá trên biển Phú Quốc","harbor","Ảnh: kho tư liệu JoTrip"),
    local("fishing-golden","media/editorial-fishing-boat-sunset.jpg","VỀ PHÍA MẶT TRỜI LẶN","Ghe đánh cá dưới ánh chiều cuối ngày","sunset","Ảnh: kho tư liệu JoTrip"),
    local("fishing-trip-golden","media/jotrip-big-game-fishing-golden-hour-2025.jpg","ÁNH CHIỀU NGOÀI KHƠI","Chuyến câu cá lớn trong ánh nắng chiều","sea","Ảnh: JoTrip"),
    local("fishing-trip","media/jotrip-big-game-fishing-2026.jpg","MỘT CHUYẾN ĐI KHÓ QUÊN","Trải nghiệm câu cá lớn cùng JoTrip","experience","Ảnh: JoTrip"),
    local("night-fishing","media/jotrip-night-fishing-2025.jpg","ĐÊM TRÊN BIỂN","Trải nghiệm câu cá đêm tại Phú Quốc","experience","Ảnh: JoTrip"),
    local("fresh-squid","media/jotrip-fresh-squid-2025.jpg","HƯƠNG VỊ VỪA LÊN BỜ","Mực tươi của biển Phú Quốc","food","Ảnh: JoTrip"),
    local("grilled-squid","media/jotrip-grilled-squid-2025.jpg","MÓN NGON CUỐI NGÀY","Mực nướng trên bàn ăn","food","Ảnh: JoTrip"),
    local("ho-quoc-wide","media/editorial-ho-quoc-overview.webp","NGÔI CHÙA NHÌN RA BIỂN","Không gian chùa Hộ Quốc nhìn ra bờ biển","culture","Ảnh: kho tư liệu JoTrip"),
    local("ho-quoc-detail","media/editorial-ho-quoc-detail.jpg","MỘT KHOẢNG LẶNG","Chi tiết kiến trúc của chùa Hộ Quốc","culture","Ảnh: kho tư liệu JoTrip"),
    local("vinwonders-castle","media/editorial-vinwonders-castle.jpg","KHI HÀNH TRÌNH BẮT ĐẦU","Lâu đài VinWonders Phú Quốc","experience","Ảnh: kho tư liệu JoTrip"),
    local("vinwonders-show","media/editorial-vinwonders-show.jpg","SẮC MÀU VỀ ĐÊM","Sân khấu và ánh đèn tại VinWonders Phú Quốc","night","Ảnh: kho tư liệu JoTrip"),
    cc("kiss-aerial","Kiss Bridge Phu Quoc aerial sunset view.jpg","Vivu Vietnam","CC BY 4.0","CẦU HÔN TRONG ÁNH CHIỀU","Toàn cảnh Cầu Hôn và Sunset Town trong ánh chiều","sunset"),
    cc("kiss-panorama","Kiss Bridge at sunset Phu Quoc Island Vietnam.jpg","Vivu Vietnam","CC BY-SA 4.0","MỘT CUỘC HẸN VỚI HOÀNG HÔN","Cầu Hôn trên biển vào lúc hoàng hôn","sunset"),
    cc("sunset-cc0","1 Phu Quoc sunset.jpg","Elmschrat","CC0","PHÚ QUỐC, GIỜ MẶT TRỜI LẶN","Mặt trời lặn trên biển Phú Quốc","sunset"),
    cc("sunset-clock","Sunset-town-phu-quoc-2.jpg","Vivu Vietnam","CC BY-SA 4.0","THÁP ĐỒNG HỒ RỰC SÁNG","Tháp đồng hồ Sunset Town trong ánh nắng chiều","city"),
    cc("sunset-citywide","Sunset-town-phu-quoc-2.jpg","Vivu Vietnam","CC BY-SA 4.0","SẮC MÀU PHỐ BIỂN","Dãy nhà nhiều màu ở Sunset Town nhìn từ xa","city"),
    cc("sunset-night","Sunset Town Phu Quoc at night.jpg","Vivu Vietnam","CC BY-SA 4.0","PHỐ BIỂN LÊN ĐÈN","Sunset Town rực rỡ về đêm trong một đêm có show","night"),
    cc("night-fireworks","Kiss of the Sea fireworks show Sunset Town Sun World Phu Quoc night Vietnam.jpg","Vivu Vietnam","CC BY-SA 4.0","MỘT ĐÊM RỰC RỠ","Pháo hoa trong chương trình Kiss of the Sea tại Sunset Town","night"),
    cc("night-clock","Symphony of the Sea fireworks Campanile scenic observatory Phu Quoc Vietnam.jpg","Vivu Vietnam","CC BY-SA 4.0","KHI BẦU TRỜI BỪNG SÁNG","Ánh sáng chương trình biểu diễn bên tháp đồng hồ","night"),
        cc("night-market-fruit","Selling fruit in Phu Quoc night market Vietnam.jpg","FrogsLegs71","CC BY-SA 3.0","SẮC MÀU CHỢ ĐÊM","Một quầy trái cây trong chợ đêm Phú Quốc","market"),
    cc("night-market-ice","Making ice cream rolls in Phu Quoc night market Vietnam.jpg","FrogsLegs71","CC BY-SA 3.0","HƯƠNG VỊ VỀ ĐÊM","Quầy kem cuộn ở chợ đêm Phú Quốc","food"),
    cc("kem-aerial","Kem Beach aerial view Phu Quoc Island Vietnam.jpg","Vivu Vietnam","CC BY-SA 4.0","BIỂN XANH BÃI KHEM","Toàn cảnh Bãi Khem và hàng dừa nhìn từ trên cao","beach"),
    cc("long-beach-sunset","Sunset on the Long Beach in Phu Quoc Island, Vietnam, 5 March 2019.jpg","Alexey Komarov","CC BY-SA 4.0","HOÀNG HÔN BÃI TRƯỜNG","Mặt trời lặn trên Bãi Trường Phú Quốc","sunset"),
    cc("an-thoi-harbor","An Thoi fishing harbour Sunset Town Sun World Phu Quoc Vietnam.jpg","Vivu Vietnam","CC BY-SA 4.0","CỬA NGÕ NAM ĐẢO","Tàu ghe An Thới và Sunset Town nhìn từ trên cao","harbor"),
    cc("fish-sauce-vats","Vats at a Fish Sauce Factory on Phu Quoc Island in Vietnam 01.jpg","Frank Fox","CC BY-SA 4.0","NHỮNG MÙA MẮM TRONG NHÀ THÙNG","Các thùng gỗ ủ nước mắm truyền thống ở Phú Quốc","culture",1400),
    cc("pepper-farm","Pepper farm in vietnam.JPG","Tonbi ko","CC BY-SA 4.0","MÙI CAY CỦA ĐẤT ĐỎ","Vườn tiêu trên đảo Phú Quốc","culture",1500),
    cc("fishing-boat-cc0","Fishing boat Phu Quoc.jpg","Elmschrat","CC0","BUỔI SÁNG Ở BẾN CẢNG","Ghe đánh cá tại cảng Phú Quốc","harbor"),
    cc("waterfall-tranh","Suối Tranh Phú Quốc (37732306046).jpg","Sketyl","CC BY-SA 4.0","MỘT GÓC RỪNG XANH","Dòng thác ở Suối Tranh Phú Quốc","forest",1500),
    cc("shore-sao","Bai Sao, Phú Quốc, Vietnam (3870300491).jpg","Wikimedia Commons","CC BY-SA 2.0","MỘT GÓC BÃI SAO","Bờ cát trắng ở Bãi Sao Phú Quốc","beach",1500)
  ];
  const byId=Object.fromEntries(list.map(item=>[item.id,item]));
  // Each contextual shelf contains considerably more than the four slides
  // actually displayed. Leads have been selected for visual impact.
  const shelves={
    morning:{
      leads:["fishing-aerial","an-thoi-harbor","fishing-fleet","fishing-boat-cc0"],
      support:["island-jetty","ho-quoc-wide","tropical-cove","pepper-farm","may-rut","shore-sao","beach-aerial","fishing-trip"]},
    noon:{
      leads:["island-jetty","kem-aerial","beach-aerial","may-rut","tropical-cove"],
      support:["tropical-beach","long-beach-sunset","reef-coast","shore-sao","snorkeling","fishing-trip","ho-quoc-wide","an-thoi-harbor"]},
    afternoon:{
      leads:["tropical-beach","tropical-cove","an-thoi-harbor","sunset-citywide","fishing-trip-golden"],
      support:["kem-aerial","ho-quoc-wide","may-rut","fishing-fleet","long-beach-sunset","vinwonders-castle","fishing-golden","sunset-clock"]},
    sunset:{
      leads:["kiss-aerial","kiss-panorama","sunset-clock","fishing-golden","sunset-cc0"],
      support:["sunset-citywide","fishing-trip-golden","an-thoi-harbor","ho-quoc-wide","sunset-cc0","fishing-golden","night-market-fruit"]},
    night:{
      leads:["sunset-night","night-fireworks","night-clock","night-market-fruit"],
      support:["night-market-fruit","night-market-ice","night-fishing","vinwonders-show","grilled-squid","fresh-squid","sunset-clock"]},
    cloudy:{
      leads:["fishing-fleet","ho-quoc-wide","tropical-cove","fish-sauce-vats"],
      support:["pepper-farm","fishing-aerial","waterfall-tranh","ho-quoc-detail","tropical-beach","night-market-fruit","an-thoi-harbor"]},
    rainy:{
      leads:["fish-sauce-vats","ho-quoc-detail","pepper-farm","night-market-ice"],
      support:["night-market-fruit","night-market-ice","fresh-squid","grilled-squid","waterfall-tranh","ho-quoc-wide","fishing-fleet"]},
    "rainy-night":{
      leads:["night-market-fruit","night-market-ice","sunset-night","vinwonders-show"],
      support:["fish-sauce-vats","night-fishing","vinwonders-show","fresh-squid","grilled-squid","night-fireworks"]},
    "cloudy-night":{
      leads:["sunset-night","night-market-fruit","vinwonders-show"],
      support:["night-market-ice","night-fishing","vinwonders-show","fresh-squid","fish-sauce-vats","night-fireworks"]}
  };
  const vnDay=date=>{
    const parts=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(date);
    const get=key=>parts.find(p=>p.type===key)?.value;
    return get("year")+"-"+get("month")+"-"+get("day");
  };
  const hash=text=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0};
  function choose(mood,date=new Date()){
    const m=shelves[mood]?mood:"noon";
    const group=shelves[m],day=vnDay(date);
    // Calendar-day serial guarantees the featured cover rotates tomorrow.
    const n=Date.parse(day+"T00:00:00Z")/86400000;
    const lead=group.leads[((n+hash(m))%group.leads.length+group.leads.length)%group.leads.length];
    const candidates=[...new Set([...group.support,...group.leads])].filter(id=>id!==lead&&byId[id])
      .sort((a,b)=>hash(m+"|"+day+"|"+a)-hash(m+"|"+day+"|"+b));
    const chosen=[byId[lead]],used=new Set([chosen[0].topic]);
    for(const id of candidates){
      const next=byId[id];if(used.has(next.topic))continue;
      chosen.push(next);used.add(next.topic);
      if(chosen.length===4)break;
    }
    for(const id of candidates){
      if(chosen.length===4)break;
      if(!chosen.some(x=>x.id===id))chosen.push(byId[id]);
    }
    return chosen;
  }
  function variant(scene,mobile=false){
    if(mobile&&scene.mobile)return {...scene,...scene.mobile};
    return scene;
  }
  root.OpenPQHeroGallery={items:list,shelves,choose,variant,vnDay};
})(typeof window!=="undefined"?window:globalThis);
