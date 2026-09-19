(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const id=new URLSearchParams(location.search).get("id")||"";

  const typeLabel={place:"ĐỊA ĐIỂM",activity:"TRẢI NGHIỆM"};
  const labels={
    family:"Gia đình",couple:"Cặp đôi",sea:"Biển",evening:"Buổi tối",nature:"Thiên nhiên",
    "local-life":"Đời sống địa phương","rainy-day":"Ngày mưa",show:"Biểu diễn",beach:"Bãi biển",
    culture:"Văn hóa",history:"Lịch sử",outdoor:"Ngoài trời",indoor:"Trong nhà",waterpark:"Công viên nước"
  };
  const zoneImages={
    zone_north:"https://commons.wikimedia.org/wiki/Special:Redirect/file/2%20Phu%20Quoc%20aerial%20view.jpg?width=1800",
    zone_central_west:"https://commons.wikimedia.org/wiki/Special:Redirect/file/Phu%20Quoc%20Beach.jpg?width=1800",
    zone_south:"https://commons.wikimedia.org/wiki/Special:Redirect/file/An%20Thoi%20fishing%20harbour%20Sunset%20Town%20Sun%20World%20Phu%20Quoc%20Vietnam.jpg?width=1800"
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

    if(!related.length) return '<p>Hiện chưa có gợi ý liên quan cho địa điểm này.</p>';

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
      ["Phụ thuộc thời tiết",entity.weather_dependency?weatherLevel(entity.weather_dependency):"Chưa xác định"],
      ["Giá tham khảo",entity.price_reference||priceRows[0]?.price_reference||"Kiểm tra theo ngày"],
      ["Cần kiểm tra trước khi đi",entity.live_check_required?"Có":"Không bắt buộc"]
    ];

    document.title=entity.name+" - Open Phu Quoc";

    root.innerHTML=
      '<section class="detail-hero" data-zone="'+esc(entity.zone_id||"")+'" style="--detail-image:url(&quot;'+esc(zoneImages[entity.zone_id]||zoneImages.zone_central_west)+'&quot;)">'+
        '<div class="detail-hero-inner">'+
          '<p class="detail-kicker">'+esc(typeLabel[entity.entity_type]||entity.entity_type)+' · '+esc(zone?.name||"PHÚ QUỐC")+'</p>'+
          '<h1>'+esc(entity.name)+'</h1>'+
          '<p class="lead">'+esc(entity.what_it_is||entity.why_go||"")+'</p>'+
          '<div class="detail-badges">'+[...new Set(tags)].slice(0,7).map(t=>'<span>'+esc(friendly(t))+'</span>').join("")+'</div>'+
        '</div>'+
      '</section>'+
      '<section class="detail-shell">'+
        '<div class="detail-main">'+
          (entity.why_go?'<article class="detail-panel"><span>VÌ SAO ĐI</span><h2>Điểm này đáng cân nhắc khi nào?</h2><p>'+esc(entity.why_go)+'</p></article>':'')+
          '<article class="detail-panel"><span>ĐỌC NHANH</span><h2>Những thứ cần biết trước khi đi.</h2><div class="fact-grid">'+facts.map(([k,v])=>'<div class="fact"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("")+'</div></article>'+
          ((entity.tips||[]).length?'<article class="detail-panel"><span>MẸO THỰC TẾ</span><h2>Nhớ mấy điều này.</h2><ul class="tips">'+entity.tips.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></article>':'')+
          (priceRows.length?'<article class="detail-panel"><span>GIÁ THAM KHẢO</span><h2>Mốc để so, không phải cam kết giá.</h2><div class="related-grid">'+priceRows.map(p=>'<a class="related-card" href="../utilities/#prices"><span>GIÁ ĐỘNG</span><strong>'+esc(p.name)+'</strong><small>'+esc(p.price_reference||"")+'</small><b>Kiểm tra →</b></a>').join("")+'</div></article>':'')+
          '<article class="detail-panel"><span>GỢI Ý GẦN ĐÂY</span><h2>Đi tiếp từ đây.</h2>'+renderRelated(entity,lookup)+'</article>'+
        '</div>'+
        '<aside class="detail-context">'+
          '<span>THÔNG TIN HỮU ÍCH</span>'+
          '<div class="context-card"><span>KHU VỰC</span><strong>'+esc(zone?.name||"Phú Quốc")+'</strong><small>'+esc(entity.area_code||"")+'</small></div>'+
          '<a class="context-link" href="../weather/"><span>☀</span><div><strong>Thời tiết & biển</strong><small>Xem tình hình mới nhất trước hoạt động ngoài trời</small></div><b>→</b></a>'+
          '<a class="context-link alt" href="../explore/?zone='+encodeURIComponent(entity.zone_id||"all")+'"><span>⌖</span><div><strong>Xem cùng khu</strong><small>'+esc(zone?.name||"Toàn đảo")+'</small></div><b>→</b></a>'+
          (priceRows.length?'<a class="context-link alt" href="../utilities/#prices"><span>₫</span><div><strong>Giá & quyền lợi</strong><small>Chọn đúng ngày đi để xem mức áp dụng</small></div><b>→</b></a>':'')+
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
