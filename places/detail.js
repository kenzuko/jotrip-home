(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const id=new URLSearchParams(location.search).get("id")||"";

  const typeLabel={place:"ĐỊA ĐIỂM",activity:"TRẢI NGHIỆM"};

  function sourceText(ref){
    if(!ref) return "Nguồn chưa rõ";
    if((ref.slides||[]).length) return (ref.source_id||"source")+" · slide "+ref.slides.join(", ");
    if((ref.chunks||[]).length) return (ref.source_id||"source")+" · "+ref.chunks.join(", ");
    return ref.source_id||"source";
  }

  function detailHref(entity){
    return "detail.html?id="+encodeURIComponent(entity.slug||entity.id);
  }

  function renderRelated(entity,lookup){
    const related=(entity.related_entities||[])
      .map(id=>lookup.get(id))
      .filter(Boolean)
      .filter(x=>x.entity_type==="place"||x.entity_type==="activity");

    if(!related.length) return '<p>Chưa có liên kết địa điểm/trải nghiệm trực tiếp trong graph.</p>';

    return '<div class="related-grid">'+related.map(x=>
      '<a class="related-card" href="'+detailHref(x)+'">'+
        '<span>'+esc(typeLabel[x.entity_type]||x.entity_type)+'</span>'+
        '<strong>'+esc(x.name)+'</strong>'+
        '<small>'+esc(x.what_it_is||x.why_go||"")+'</small>'+
        '<b>Xem →</b>'+
      '</a>'
    ).join("")+'</div>';
  }

  function render(entity,zones,all,prices){
    const root=$("#detailRoot");
    const zone=zones.find(z=>z.id===entity.zone_id);
    const lookup=new Map(all.map(x=>[x.id,x]));
    const priceRows=prices.filter(p=>(p.related_entities||[]).includes(entity.id));
    const tags=[...(entity.categories||[]),...(entity.intents||[]),...(entity.best_for||[])];
    const facts=[
      ["Khu vực",zone?.name||"Toàn đảo"],
      ["Lúc nên đi",entity.best_time||"Tùy lịch"],
      ["Thời lượng",entity.duration||"Tùy trải nghiệm"],
      ["Phụ thuộc weather",entity.weather_dependency?String(entity.weather_dependency).toUpperCase():"Không gắn mức"],
      ["Giá tham khảo",entity.price_reference||priceRows[0]?.price_reference||"Kiểm tra theo ngày"],
      ["Live check",entity.live_check_required?"Có - kiểm tra trước khi đi":"Không bắt buộc"]
    ];

    document.title=entity.name+" - Open Phu Quoc";

    root.innerHTML=
      '<section class="detail-hero" data-zone="'+esc(entity.zone_id||"")+'">'+
        '<div class="detail-hero-inner">'+
          '<p class="detail-kicker">'+esc(typeLabel[entity.entity_type]||entity.entity_type)+' · '+esc(zone?.name||"PHÚ QUỐC")+'</p>'+
          '<h1>'+esc(entity.name)+'</h1>'+
          '<p class="lead">'+esc(entity.what_it_is||entity.why_go||"")+'</p>'+
          '<div class="detail-badges">'+[...new Set(tags)].slice(0,7).map(t=>'<span>'+esc(t)+'</span>').join("")+'</div>'+
        '</div>'+
      '</section>'+
      '<section class="detail-shell">'+
        '<div class="detail-main">'+
          (entity.why_go?'<article class="detail-panel"><span>VÌ SAO ĐI</span><h2>Điểm này đáng cân nhắc khi nào?</h2><p>'+esc(entity.why_go)+'</p></article>':'')+
          '<article class="detail-panel"><span>ĐỌC NHANH</span><h2>Những thứ cần biết trước khi đi.</h2><div class="fact-grid">'+facts.map(([k,v])=>'<div class="fact"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("")+'</div></article>'+
          ((entity.tips||[]).length?'<article class="detail-panel"><span>TIPS</span><h2>Nhớ mấy điều này.</h2><ul class="tips">'+entity.tips.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></article>':'')+
          (priceRows.length?'<article class="detail-panel"><span>GIÁ THAM KHẢO</span><h2>Mốc để so, không phải cam kết giá.</h2><div class="related-grid">'+priceRows.map(p=>'<a class="related-card" href="../utilities/#prices"><span>GIÁ ĐỘNG</span><strong>'+esc(p.name)+'</strong><small>'+esc(p.price_reference||"")+'</small><b>Kiểm tra →</b></a>').join("")+'</div></article>':'')+
          '<article class="detail-panel"><span>LIÊN QUAN</span><h2>Đi tiếp từ đây.</h2>'+renderRelated(entity,lookup)+'</article>'+
          '<article class="detail-panel"><span>NGUỒN</span><h2>Dữ liệu này đến từ đâu?</h2><div class="source-list">'+(entity.source_refs||[]).map(ref=>'<div class="source-row">'+esc(sourceText(ref))+'</div>').join("")+'</div></article>'+
        '</div>'+
        '<aside class="detail-context">'+
          '<span>CONTEXT</span>'+
          '<div class="context-card"><span>KHU VỰC</span><strong>'+esc(zone?.name||"Phú Quốc")+'</strong><small>'+esc(entity.area_code||"")+'</small></div>'+
          '<a class="context-link" href="../weather/"><span>☀</span><div><strong>Weather & biển</strong><small>Xem live trước hoạt động phụ thuộc thời tiết</small></div><b>→</b></a>'+
          '<a class="context-link alt" href="../explore/?zone='+encodeURIComponent(entity.zone_id||"all")+'"><span>⌖</span><div><strong>Xem cùng khu</strong><small>'+esc(zone?.name||"Toàn đảo")+'</small></div><b>→</b></a>'+
          (priceRows.length?'<a class="context-link alt" href="../utilities/#prices"><span>₫</span><div><strong>Giá & quyền lợi</strong><small>Dữ liệu động - kiểm tra đúng ngày</small></div><b>→</b></a>':'')+
        '</aside>'+
      '</section>';
  }

  Promise.all([
    fetch("../data/entities/places.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/activities.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/zones.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/prices.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json())
  ]).then(([places,activities,zones,prices])=>{
    const all=[...(places.entities||[]),...(activities.entities||[])];
    const entity=all.find(x=>x.id===id||x.slug===id||x.legacy_id===id);
    if(!entity){
      $("#detailRoot").innerHTML='<section class="detail-loading"><strong>Không tìm thấy địa điểm.</strong><br><br><a href="../explore/">← Quay lại Explore</a></section>';
      return;
    }
    render(entity,zones.entities||[],all,prices.entities||[]);
  }).catch(error=>{
    console.warn(error);
    $("#detailRoot").innerHTML='<section class="detail-loading">Không tải được dữ liệu địa điểm lúc này.</section>';
  });
})();