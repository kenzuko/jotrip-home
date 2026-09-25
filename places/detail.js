(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const VISUALS="../data/visual-context.json";
  const CONTENT_LOCALE=(document.documentElement.lang||"vi").split("-")[0]||"vi";
  const EXPLAINERS="../data/i18n/"+CONTENT_LOCALE+"/place-explainers.json";
  const UI="../data/i18n/"+CONTENT_LOCALE+"/ui.json";
  const UI_FALLBACK="../data/i18n/vi/ui.json";
  const planningStyle=document.createElement("style");planningStyle.textContent='.pros-cons{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pros-cons>div{padding:16px;border-radius:16px;background:#eef9f5}.pros-cons>.watch{background:#fff7e8}.pros-cons strong{display:block;margin-bottom:8px;color:var(--ink);font-size:15px}.pros-cons .tips li:before{content:"+"}.pros-cons .watch .tips li:before{content:"!";color:#a86b12}.price-dimensions{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.price-dimensions span{padding:9px 11px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--ink);font-size:13px;font-weight:800}@media(max-width:760px){.pros-cons{grid-template-columns:1fr}.price-dimensions span{font-size:12px}}';document.head.appendChild(planningStyle);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  function setMeta(selector,attr,value){
    let el=document.querySelector(selector);
    if(!el){
      el=document.createElement("meta");
      const m=selector.match(/^meta\[(name|property)="([^"]+)"\]$/);
      if(!m)return;
      el.setAttribute(m[1],m[2]);
      document.head.appendChild(el);
    }
    el.setAttribute(attr,value);
  }
  function setCanonical(url){
    let el=document.querySelector('link[rel="canonical"]');
    if(!el){el=document.createElement("link");el.rel="canonical";document.head.appendChild(el)}
    el.href=url;
  }
  function applyEntityMeta(entity,image){
    const title=entity.name+" - Open Phu Quoc";
    const description=entity.what_it_is||entity.why_go||"Thông tin điểm đến Phú Quốc.";
    const key=entity.slug||entity.id;
    const url="https://cms.openphuquoc.com/places/detail.html?id="+encodeURIComponent(key);
    const shareImage=image||"https://cms.openphuquoc.com/assets/logo-master.png";
    document.title=title;
    setCanonical(url);
    setMeta('meta[name="description"]',"content",description);
    setMeta('meta[property="og:type"]',"content","article");
    setMeta('meta[property="og:title"]',"content",title);
    setMeta('meta[property="og:description"]',"content",description);
    setMeta('meta[property="og:url"]',"content",url);
    setMeta('meta[property="og:image"]',"content",shareImage);
    setMeta('meta[property="og:image:alt"]',"content",entity.name);
    setMeta('meta[name="twitter:card"]',"content","summary_large_image");
    setMeta('meta[name="twitter:title"]',"content",title);
    setMeta('meta[name="twitter:description"]',"content",description);
    setMeta('meta[name="twitter:image"]',"content",shareImage);
  }
  const id=new URLSearchParams(location.search).get("id")||"";

  const typeLabel={place:"ĐỊA ĐIỂM",activity:"TRẢI NGHIỆM"};
  const labels={
    family:"Gia đình",couple:"Cặp đôi",sea:"Biển",evening:"Buổi tối",nature:"Thiên nhiên",
    "local-life":"Đời sống địa phương","rainy-day":"Ngày mưa",show:"Biểu diễn",beach:"Bãi biển",
    culture:"Văn hóa",history:"Lịch sử",outdoor:"Ngoài trời",indoor:"Trong nhà",waterpark:"Công viên nước",
    "cable-car":"Cáp treo",resort:"Khu nghỉ dưỡng",architecture:"Kiến trúc",fireworks:"Pháo hoa",marine:"Biển đảo"
  };
  const priceDimensionLabel={travel_date:"Ngày đi",height_band:"Chiều cao",age_band:"Độ tuổi",ticket_bundle:"Loại vé hoặc combo",time_slot:"Khung giờ"};


  function friendly(value){
    const raw=String(value??"");
    return labels[raw.toLowerCase()]||raw.replaceAll("-"," ");
  }

  function weatherLevel(value){
    return ({high:"Cao",medium:"Vừa",low:"Thấp",none:"Không đáng kể"})[String(value||"").toLowerCase()]||friendly(value);
  }

  function detailHref(entity){
    return "detail.html?id="+encodeURIComponent(entity.slug||entity.id);
  }

  function renderRelated(entity,lookup){
    const related=(entity.related_entities||[])
      .map(id=>lookup.get(id))
      .filter(Boolean)
      .filter(x=>x.entity_type==="place"||x.entity_type==="activity");

    if(!related.length) return '<p>Chưa có điểm nào đủ liên quan để ghép vào đây.</p>';

    return '<div class="related-grid">'+related.map(x=>
      '<a class="related-card" href="'+detailHref(x)+'">'+
        '<span>'+esc(typeLabel[x.entity_type]||x.entity_type)+'</span>'+
        '<strong>'+esc(x.name)+'</strong>'+
        '<small>'+esc(x.what_it_is||x.why_go||"")+'</small>'+
        '<b>Xem →</b>'+
      '</a>'
    ).join("")+'</div>';
  }

  function localDateKey(){
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return p.year+"-"+p.month+"-"+p.day;
  }
  planningStyle.textContent += '.show-cancel-banner{margin:14px auto;max-width:1160px;padding:18px 22px;border:2px solid #c96e34;border-radius:16px;background:#fff6ea;color:#623518}.show-cancel-banner span{font-size:12px;font-weight:900;color:#974b16}.show-cancel-banner h2{font-size:22px;line-height:1.35;margin:8px 0}.show-cancel-banner p{margin:8px 0;line-height:1.55}.show-cancel-banner small{display:block;line-height:1.5}';
  function render(entity,zones,all,prices,planningData,visualData,explainerData,uiData,notices){
    const root=$("#detailRoot");
    const zone=zones.find(z=>z.id===entity.zone_id);
    const lookup=new Map(all.map(x=>[x.id,x]));
    const directPriceRows=prices.filter(p=>(p.related_entities||[]).includes(entity.id));
    const relatedPriceRows=prices.filter(p=>(p.related_entities||[]).some(id=>(entity.related_entities||[]).includes(id)));
    const priceRows=directPriceRows.length?directPriceRows:relatedPriceRows;
    const inheritedPrice=!directPriceRows.length&&relatedPriceRows.length>0;
    const tags=[...(entity.categories||[]),...(entity.intents||[]),...(entity.best_for||[])];
    const planning=(planningData.items||[]).find(x=>x.entity_id===entity.id)||{};
    const level=(planningData.levels||[]).find(x=>x.id===planning.level);
    const visual=visualData?.places?.[entity.id]||{};
    const explainer=explainerData?.items?.[entity.id]||{};
    const pc=uiData?.place_detail||{};
    const cc=uiData?.common||{};
    const placeTypeLabel=entity.entity_type==="activity"?(pc.type_activity||"TRẢI NGHIỆM"):(pc.type_place||"ĐỊA ĐIỂM");
    const visualImages=Array.isArray(visual.images)?visual.images:[];
    const heroVisual=window.OpenPQVisual?.pickHero?.(visualImages)||visualImages.find(x=>x?.url&&x.hero_eligible!==false)||null;
    const heroImage=heroVisual?.url||null;
    const heroSource=heroVisual?.source_label||null;
    const heroIsContext=!heroVisual;
    const heroAlt=heroVisual?.alt||entity.name;
    const extraVisuals=heroVisual?visualImages.filter(x=>x!==heroVisual):visualImages;
    const facts=[
      [pc.fact_area||"Khu vực",zone?.name||"Toàn đảo"],
      [pc.fact_best_time||"Lúc nên đi",entity.best_time||"Tùy lịch"],
      [pc.fact_duration||"Thời lượng",entity.duration||"Tùy trải nghiệm"],
      [pc.fact_weather||"Phụ thuộc thời tiết",entity.weather_dependency?weatherLevel(entity.weather_dependency):"Chưa xác định"],
      [pc.fact_price||"Giá tham khảo",entity.price_reference||priceRows[0]?.price_reference||"Kiểm tra theo ngày"],
      [pc.fact_before||"Trước khi đi",entity.live_check_required?"Xem lại tình hình mới nhất":"Không có bước bắt buộc"]
    ];
    if(level) facts.unshift([pc.fact_role||"Kiểu ghé phù hợp",level.label]);

    applyEntityMeta(entity,heroImage);
    const now=Date.now();
    const days=Number.isInteger(notices?.retention_days)&&notices.retention_days>0?notices.retention_days:3;
    const datedNotice=(notices?.notices||[]).find(x=>{
      if(x.entity_id!==entity.id||x.status!=="CANCELLED"||typeof x.date!=="string")return false;
      const start=Date.parse(x.date+"T00:00:00+07:00");
      return Number.isFinite(start)&&now>=start&&now<start+days*86400000;
    });
    const noticeBanner=datedNotice?
      '<aside class="show-cancel-banner" role="status" data-show-notice><span>THÔNG BÁO SUẤT DIỄN NGÀY '+esc(datedNotice.date.split("-").reverse().join("/"))+'</span>'+
      '<h2>'+esc(datedNotice.title)+'</h2><p>'+esc(datedNotice.summary)+'</p>'+
      '<p>'+esc(datedNotice.booking_message)+'</p><small>'+esc(datedNotice.source)+'</small></aside>':"";
    root.innerHTML=noticeBanner+
      '<section class="detail-hero" data-zone="'+esc(entity.zone_id||"")+'">'+
        (heroImage
          ? '<img class="detail-hero-photo" src="'+esc(heroImage)+'" alt="'+esc(heroAlt)+'" decoding="async">'
          : '<div class="detail-hero-fallback" aria-label="Sơ đồ vị trí '+esc(zone?.name||"Phú Quốc")+'">'+
              '<img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/PhuQuocMap.svg?width=900" alt="" aria-hidden="true">'+
              '<div><span>'+esc(cc.island_location||"Vị trí trên đảo")+'</span><strong>'+esc(zone?.name||"Phú Quốc")+'</strong><small>'+esc(cc.image_updating||"Ảnh điểm đến đang được cập nhật")+'</small></div>'+
            '</div>')+
        (heroIsContext?'<span class="detail-hero-context">'+esc(cc.zone_diagram||"Sơ đồ vùng")+'</span>':'')+
        (heroSource ? '<small class="detail-hero-credit">Ảnh: '+esc(String(heroSource).replace(/^Ảnh:\s*/i,""))+(heroVisual?.license?' · '+esc(heroVisual.license):'')+'</small>' : '<small class="detail-hero-credit">Bản đồ định hướng Phú Quốc</small>')+
        '<div class="detail-hero-inner">'+
          '<p class="detail-kicker">'+esc(placeTypeLabel)+' · '+esc(zone?.name||"PHÚ QUỐC")+'</p>'+
          '<h1>'+esc(entity.name)+'</h1>'+
          '<p class="lead">'+esc(entity.what_it_is||entity.why_go||"")+'</p>'+
          '<div class="detail-badges">'+[...new Set(tags)].slice(0,7).map(t=>'<span>'+esc(friendly(t))+'</span>').join("")+'</div>'+
        '</div>'+
      '</section>'+
      '<section class="detail-shell">'+
        '<section class="decision-summary">'+
          '<div class="decision-title"><span>'+esc(pc.quick_choice||"CHỌN NHANH")+'</span><strong>'+(level?esc(level.label):'Có hợp lịch của bạn không?')+'</strong><small>'+(level?esc(level.description):'Nhìn nhanh thời gian, thời tiết và cách ghép điểm trước khi đi.')+'</small></div>'+
          '<div><span>'+esc(pc.suitable_when||"HỢP KHI")+'</span><strong>'+esc((planning.strengths||[])[0]||entity.why_go||entity.what_it_is||'Bạn thấy chỗ này đúng gu của mình')+'</strong></div>'+
          '<div class="watch"><span>'+esc(pc.before_go||"TRƯỚC KHI ĐI")+'</span><strong>'+esc((planning.watch_outs||[])[0]||(entity.live_check_required?'Xem lại tình hình trong ngày trước khi khởi hành':'Chưa có lưu ý đặc biệt'))+'</strong></div>'+
        '</section>'+
        '<div class="detail-main">'+
          (explainer.lede?'<article class="detail-panel detail-explainer-intro"><span>'+esc(pc.why_understand||"VÌ SAO NƠI NÀY ĐÁNG HIỂU")+'</span><h2>'+esc(explainer.lede)+'</h2></article>':'')+
          (window.OpenPQVisual&&extraVisuals.length?OpenPQVisual.gallery(extraVisuals,{eyebrow:pc.images||"HÌNH ẢNH",title:pc.images_title||"Nhìn một vòng trước khi đi"}):"")+
          (window.OpenPQVisual?OpenPQVisual.locator(zone,{title:pc.location_title||"Ở đâu trên đảo?",label:zone?.name||"Phú Quốc",map:entity.map||visual.map||zone?.map,eyebrow:cc.island_location||"Vị trí",buttonLabel:cc.view_area_map||"Xem bản đồ khu vực",openLabel:cc.open_map||"Mở bản đồ lớn ↗",loadedLabel:cc.map_loaded||"Bản đồ đã mở"}):"")+
          (window.OpenPQVisual?OpenPQVisual.infographic(explainer.infographic||visual.infographic||[],{eyebrow:pc.explainer_eyebrow||"HIỂU ĐIỂM ĐẾN",title:pc.explainer_title||"Ba chuyện đáng biết trước khi ghé"}):"")+
          ((explainer.sections||[]).length?'<article class="detail-panel"><span>'+esc(pc.context||"BỐI CẢNH")+'</span><h2>'+esc(pc.context_title||"Đọc chỗ này như một nơi có câu chuyện.")+'</h2><div class="explainer-sections">'+explainer.sections.map(x=>'<section><h3>'+esc(x.heading||"")+'</h3><p>'+esc(x.body||"")+'</p></section>').join("")+'</div></article>':'')+
          ((explainer.visitor_questions||[]).length?'<article class="detail-panel detail-questions"><span>'+esc(pc.questions||"HỎI GÌ KHI TỚI?")+'</span><h2>'+esc(pc.questions_title||"Mấy câu hỏi giúp hiểu nơi này hơn.")+'</h2><ul>'+explainer.visitor_questions.map(x=>'<li>'+esc(x)+'</li>').join("")+'</ul></article>':'')+
          (entity.why_go?'<article class="detail-panel"><span>'+esc(pc.what_here||"CÓ GÌ Ở ĐÂY")+'</span><h2>'+esc(pc.what_here_title||"Chỗ này đáng ghé vì điều gì?")+'</h2><p>'+esc(entity.why_go)+'</p></article>':'')+
          '<article class="detail-panel"><span>'+esc(pc.quick_facts||"NẮM NHANH")+'</span><h2>'+esc(pc.quick_facts_title||"Mấy chuyện chính trước khi đi.")+'</h2><div class="fact-grid">'+facts.map(([k,v])=>'<div class="fact"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("")+'</div></article>'+
          ((planning.price_dimensions||[]).length?'<article class="detail-panel"><span>GIÁ VÉ</span><h2>Giá thay đổi theo những gì?</h2><p>Nếu nguồn chưa công bố đủ, Open Phu Quoc sẽ không tự điền số. Khi xem vé, nhớ chọn đúng:</p><div class="price-dimensions">'+planning.price_dimensions.map(x=>'<span>'+esc(priceDimensionLabel[x]||x)+'</span>').join("")+'</div></article>':'')+
          ((entity.tips||[]).length?'<article class="detail-panel"><span>TRƯỚC KHI ĐI</span><h2>Nhớ mấy chuyện này.</h2><ul class="tips">'+entity.tips.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></article>':'')+
          (priceRows.length?'<article class="detail-panel"><span>'+(inheritedPrice?'GIÁ ĐI CÙNG TRẢI NGHIỆM CHÍNH':'GIÁ THAM KHẢO')+'</span><h2>'+(inheritedPrice?'Quyền lợi này thường đi chung trong vé hoặc combo chính.':'Dùng để dự trù, không phải giá cố định.')+'</h2>'+(inheritedPrice?'<p>Giá bên dưới thuộc vé hoặc combo của trải nghiệm liên quan. Hãy chọn đúng ngày đi, chiều cao, độ tuổi và quyền lợi trước khi thanh toán.</p>':'')+'<div class="related-grid">'+priceRows.map(p=>'<a class="related-card" href="../utilities/#prices"><span>KIỂM TRA ĐÚNG NGÀY</span><strong>'+esc(p.name)+'</strong><small>'+esc(p.price_reference||"")+'</small><b>Kiểm tra →</b></a>').join("")+'</div></article>':'')+
          '<aside class="jotrip-service-card" aria-label="Gợi ý từ JoTrip"><span>GỢI Ý TỪ JOTRIP</span><strong>Muốn có xe riêng hoặc ghép trải nghiệm này vào một ngày trọn gói?</strong><p>JoTrip hỗ trợ xe, tour, vé và lịch trình tại Phú Quốc.</p><div class="jotrip-service-actions"><a href="tel:+84817060067">Gọi +84 817 060 067</a><a href="https://wa.me/84817060067" target="_blank" rel="noopener">WhatsApp</a><a href="https://zalo.me/0817060067" target="_blank" rel="noopener">Zalo</a></div></aside>'+
          '<article class="detail-panel"><span>'+esc(pc.nearby||"ĐI CÙNG GÌ CHO TIỆN")+'</span><h2>'+esc(pc.nearby_title||"Nếu còn thời gian, đi tiếp đâu?")+'</h2>'+renderRelated(entity,lookup)+'</article>'+
        '</div>'+
        '<aside class="detail-context">'+
          '<span>'+esc(pc.useful_now||"CẦN DÙNG KHI ĐANG ĐI")+'</span>'+
          '<div class="context-card"><span>'+esc(pc.area||"KHU VỰC")+'</span><strong>'+esc(zone?.name||"Phú Quốc")+'</strong><small>'+esc(entity.area_code||"")+'</small></div>'+
          '<a class="context-link" href="../weather/"><span>☀</span><div><strong>Thời tiết & biển</strong><small>Xem tình hình mới nhất trước hoạt động ngoài trời</small></div><b>→</b></a>'+
          '<a class="context-link alt" href="../explore/?zone='+encodeURIComponent(entity.zone_id||"all")+'"><span>⌖</span><div><strong>Xem thêm quanh đây</strong><small>'+esc(zone?.name||"Toàn đảo")+'</small></div><b>→</b></a>'+
          (priceRows.length?'<a class="context-link alt" href="../utilities/#prices"><span>₫</span><div><strong>Giá & quyền lợi</strong><small>Chọn đúng ngày đi trước khi so giá</small></div><b>→</b></a>':'')+
        '</aside>'+
      '</section>';

    window.OpenPQVisual?.bindLazyMaps(root);
    // If the detail page is kept open for days, still remove an expired announcement.
    if(datedNotice){
      const started=Date.parse(datedNotice.date+"T00:00:00+07:00");
      const deadline=started+days*86400000;
      const checkExpiry=setInterval(()=>{if(Date.now()>=deadline){root.querySelector("[data-show-notice]")?.remove();clearInterval(checkExpiry)}},60000);
    }
  }

  Promise.all([
    fetch("../data/entities/places.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/activities.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/zones.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/prices.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/views/place-planning-levels.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch(VISUALS+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{}),
    fetch(EXPLAINERS+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{items:{}}).catch(()=>fetch("../data/i18n/vi/place-explainers.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()).catch(()=>({items:{}}))),
    fetch(UI+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject()).catch(()=>fetch(UI_FALLBACK+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{}).catch(()=>({}))),
    fetch("../data/operational-notices.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{notices:[]}).catch(()=>({notices:[]}))
  ]).then(([places,activities,zones,prices,planning,visualData,explainerData,uiData,notices])=>{
    const all=[...(places.entities||[]),...(activities.entities||[])];
    const entity=all.find(x=>x.id===id||x.slug===id||x.legacy_id===id);
    if(!entity){
      $("#detailRoot").innerHTML='<section class="detail-loading"><strong>Không tìm thấy địa điểm.</strong><br><br><a href="../explore/">← Quay lại Explore</a></section>';
      return;
    }
    render(entity,zones.entities||[],all,prices.entities||[],planning,visualData,explainerData,uiData,notices);
  }).catch(error=>{
    console.warn(error);
    $("#detailRoot").innerHTML='<section class="detail-loading">Trang này chưa mở được lúc này. Thử lại sau một chút nhé.</section>';
  });
})();
