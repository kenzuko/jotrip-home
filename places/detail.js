(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const VISUALS="../data/visual-context.json";
  const planningStyle=document.createElement("style");planningStyle.textContent='.pros-cons{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pros-cons>div{padding:16px;border-radius:16px;background:#eef9f5}.pros-cons>.watch{background:#fff7e8}.pros-cons strong{display:block;margin-bottom:8px;color:var(--ink);font-size:15px}.pros-cons .tips li:before{content:"+"}.pros-cons .watch .tips li:before{content:"!";color:#a86b12}.price-dimensions{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}.price-dimensions span{padding:9px 11px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--ink);font-size:13px;font-weight:800}@media(max-width:760px){.pros-cons{grid-template-columns:1fr}.price-dimensions span{font-size:12px}}';document.head.appendChild(planningStyle);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const id=new URLSearchParams(location.search).get("id")||"";

  const typeLabel={place:"ĐỊA ĐIỂM",activity:"TRẢI NGHIỆM"};
  const labels={
    family:"Gia đình",couple:"Cặp đôi",sea:"Biển",evening:"Buổi tối",nature:"Thiên nhiên",
    "local-life":"Đời sống địa phương","rainy-day":"Ngày mưa",show:"Biểu diễn",beach:"Bãi biển",
    culture:"Văn hóa",history:"Lịch sử",outdoor:"Ngoài trời",indoor:"Trong nhà",waterpark:"Công viên nước",
    "cable-car":"Cáp treo",resort:"Khu nghỉ dưỡng",architecture:"Kiến trúc",fireworks:"Pháo hoa",marine:"Biển đảo"
  };
  const priceDimensionLabel={travel_date:"Ngày đi",height_band:"Chiều cao",age_band:"Độ tuổi",ticket_bundle:"Loại vé hoặc combo",time_slot:"Khung giờ"};
  const zoneVisuals={
    zone_north:{
      url:"https://commons.wikimedia.org/wiki/Special:Redirect/file/2%20Phu%20Quoc%20aerial%20view.jpg?width=1800",
      source_url:"https://commons.wikimedia.org/wiki/File:2_Phu_Quoc_aerial_view.jpg"
    },
    zone_central_west:{
      url:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Phu%20Quoc%20Beach.jpg?width=1800",
      source_url:"https://commons.wikimedia.org/wiki/File:Phu_Quoc_Beach.jpg"
    },
    zone_south:{
      url:"https://commons.wikimedia.org/wiki/Special:Redirect/file/An%20Thoi%20fishing%20harbour%20Sunset%20Town%20Sun%20World%20Phu%20Quoc%20Vietnam.jpg?width=1800",
      source_url:"https://commons.wikimedia.org/wiki/File:An_Thoi_fishing_harbour_Sunset_Town_Sun_World_Phu_Quoc_Vietnam.jpg"
    }
  };

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

  function render(entity,zones,all,prices,planningData,visualData){
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
    const visualImages=Array.isArray(visual.images)?visual.images:[];
    const heroVisual=visualImages[0]||null;
    const zoneVisual=zoneVisuals[entity.zone_id]||zoneVisuals.zone_central_west;
    const heroImage=heroVisual?.url||zoneVisual.url;
    const heroSource=heroVisual?.source_url||zoneVisual.source_url;
    const heroAlt=heroVisual?.alt||("Bối cảnh "+(zone?.name||"Phú Quốc"));
    const extraVisuals=heroVisual?visualImages.slice(1):visualImages;
    const facts=[
      ["Khu vực",zone?.name||"Toàn đảo"],
      ["Lúc nên đi",entity.best_time||"Tùy lịch"],
      ["Thời lượng",entity.duration||"Tùy trải nghiệm"],
      ["Phụ thuộc thời tiết",entity.weather_dependency?weatherLevel(entity.weather_dependency):"Chưa xác định"],
      ["Giá tham khảo",entity.price_reference||priceRows[0]?.price_reference||"Kiểm tra theo ngày"],
      ["Trước khi đi",entity.live_check_required?"Xem lại tình hình mới nhất":"Không có bước bắt buộc"]
    ];
    if(level) facts.unshift(["Kiểu ghé phù hợp",level.label]);

    document.title=entity.name+" - Open Phu Quoc";

    root.innerHTML=
      '<section class="detail-hero" data-zone="'+esc(entity.zone_id||"")+'">'+
        '<img class="detail-hero-photo" src="'+esc(heroImage)+'" alt="'+esc(heroAlt)+'" decoding="async">'+
        (heroSource?'<a class="detail-hero-credit" href="'+esc(heroSource)+'" target="_blank" rel="noopener">Nguồn ảnh ↗</a>':'')+
        '<div class="detail-hero-inner">'+
          '<p class="detail-kicker">'+esc(typeLabel[entity.entity_type]||entity.entity_type)+' · '+esc(zone?.name||"PHÚ QUỐC")+'</p>'+
          '<h1>'+esc(entity.name)+'</h1>'+
          '<p class="lead">'+esc(entity.what_it_is||entity.why_go||"")+'</p>'+
          '<div class="detail-badges">'+[...new Set(tags)].slice(0,7).map(t=>'<span>'+esc(friendly(t))+'</span>').join("")+'</div>'+
        '</div>'+
      '</section>'+
      '<section class="detail-shell">'+
        '<section class="decision-summary">'+
          '<div class="decision-title"><span>CHỌN NHANH</span><strong>'+(level?esc(level.label):'Có hợp lịch của bạn không?')+'</strong><small>'+(level?esc(level.description):'Nhìn nhanh thời gian, thời tiết và cách ghép điểm trước khi đi.')+'</small></div>'+
          '<div><span>HỢP KHI</span><strong>'+esc((planning.strengths||[])[0]||entity.why_go||entity.what_it_is||'Bạn thấy chỗ này đúng gu của mình')+'</strong></div>'+
          '<div class="watch"><span>TRƯỚC KHI ĐI</span><strong>'+esc((planning.watch_outs||[])[0]||(entity.live_check_required?'Xem lại tình hình trong ngày trước khi khởi hành':'Chưa có lưu ý đặc biệt'))+'</strong></div>'+
        '</section>'+
        '<div class="detail-main">'+
          (window.OpenPQVisual&&extraVisuals.length?OpenPQVisual.gallery(extraVisuals,{eyebrow:"HÌNH ẢNH",title:"Nhìn một vòng trước khi đi"}):"")+
          (window.OpenPQVisual?OpenPQVisual.locator(zone,{title:"Ở đâu trên đảo?",label:zone?.name||"Phú Quốc",map:entity.map||visual.map||zone?.map}):"")+
          (window.OpenPQVisual?OpenPQVisual.infographic(visual.infographic||[],{eyebrow:"NHÌN NHANH",title:"Hiểu chỗ này trong vài giây"}):"")+
          (entity.why_go?'<article class="detail-panel"><span>CÓ GÌ Ở ĐÂY</span><h2>Chỗ này đáng ghé vì điều gì?</h2><p>'+esc(entity.why_go)+'</p></article>':'')+
          '<article class="detail-panel"><span>NẮM NHANH</span><h2>Mấy chuyện chính trước khi đi.</h2><div class="fact-grid">'+facts.map(([k,v])=>'<div class="fact"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("")+'</div></article>'+
          ((planning.price_dimensions||[]).length?'<article class="detail-panel"><span>GIÁ VÉ</span><h2>Giá thay đổi theo những gì?</h2><p>Nếu nguồn chưa công bố đủ, Open Phu Quoc sẽ không tự điền số. Khi xem vé, nhớ chọn đúng:</p><div class="price-dimensions">'+planning.price_dimensions.map(x=>'<span>'+esc(priceDimensionLabel[x]||x)+'</span>').join("")+'</div></article>':'')+
          ((entity.tips||[]).length?'<article class="detail-panel"><span>TRƯỚC KHI ĐI</span><h2>Nhớ mấy chuyện này.</h2><ul class="tips">'+entity.tips.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></article>':'')+
          (priceRows.length?'<article class="detail-panel"><span>'+(inheritedPrice?'GIÁ ĐI CÙNG TRẢI NGHIỆM CHÍNH':'GIÁ THAM KHẢO')+'</span><h2>'+(inheritedPrice?'Quyền lợi này thường đi chung trong vé hoặc combo chính.':'Dùng để dự trù, không phải giá cố định.')+'</h2>'+(inheritedPrice?'<p>Giá bên dưới thuộc vé hoặc combo của trải nghiệm liên quan. Hãy chọn đúng ngày đi, chiều cao, độ tuổi và quyền lợi trước khi thanh toán.</p>':'')+'<div class="related-grid">'+priceRows.map(p=>'<a class="related-card" href="../utilities/#prices"><span>KIỂM TRA ĐÚNG NGÀY</span><strong>'+esc(p.name)+'</strong><small>'+esc(p.price_reference||"")+'</small><b>Kiểm tra →</b></a>').join("")+'</div></article>':'')+
          '<article class="detail-panel"><span>ĐI CÙNG GÌ CHO TIỆN</span><h2>Nếu còn thời gian, đi tiếp đâu?</h2>'+renderRelated(entity,lookup)+'</article>'+
        '</div>'+
        '<aside class="detail-context">'+
          '<span>CẦN DÙNG KHI ĐANG ĐI</span>'+
          '<div class="context-card"><span>KHU VỰC</span><strong>'+esc(zone?.name||"Phú Quốc")+'</strong><small>'+esc(entity.area_code||"")+'</small></div>'+
          '<a class="context-link" href="../weather/"><span>☀</span><div><strong>Thời tiết & biển</strong><small>Xem tình hình mới nhất trước hoạt động ngoài trời</small></div><b>→</b></a>'+
          '<a class="context-link alt" href="../explore/?zone='+encodeURIComponent(entity.zone_id||"all")+'"><span>⌖</span><div><strong>Xem thêm quanh đây</strong><small>'+esc(zone?.name||"Toàn đảo")+'</small></div><b>→</b></a>'+
          (priceRows.length?'<a class="context-link alt" href="../utilities/#prices"><span>₫</span><div><strong>Giá & quyền lợi</strong><small>Chọn đúng ngày đi trước khi so giá</small></div><b>→</b></a>':'')+
        '</aside>'+
      '</section>';

    window.OpenPQVisual?.bindLazyMaps(root);
  }

  Promise.all([
    fetch("../data/entities/places.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/activities.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/zones.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/prices.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/views/place-planning-levels.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch(VISUALS+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{})
  ]).then(([places,activities,zones,prices,planning,visualData])=>{
    const all=[...(places.entities||[]),...(activities.entities||[])];
    const entity=all.find(x=>x.id===id||x.slug===id||x.legacy_id===id);
    if(!entity){
      $("#detailRoot").innerHTML='<section class="detail-loading"><strong>Không tìm thấy địa điểm.</strong><br><br><a href="../explore/">← Quay lại Explore</a></section>';
      return;
    }
    render(entity,zones.entities||[],all,prices.entities||[],planning,visualData);
  }).catch(error=>{
    console.warn(error);
    $("#detailRoot").innerHTML='<section class="detail-loading">Không tải được dữ liệu địa điểm lúc này.</section>';
  });
})();
