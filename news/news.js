(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const fmtDate=value=>{
    if(!value)return"";
    const raw=/^\d{4}-\d{2}-\d{2}$/.test(value)?value+"T12:00:00+07:00":value;
    const d=new Date(raw);
    return Number.isNaN(d.getTime())?"":new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
  };
  const isActive=(item,now)=>!item.expires_at||Date.parse(item.expires_at)>now;

  Promise.all([
    fetch("../data/home-support.json",{cache:"default"}).then(r=>r.json()),
    fetch("../data/source-registry.json",{cache:"default"}).then(r=>r.json()),
    fetch("../data/operational-notices.json",{cache:"default"}).then(r=>r.ok?r.json():{notices:[]}).catch(()=>({notices:[]})),
    fetch("../data/editorial-events.json",{cache:"default"}).then(r=>r.ok?r.json():{items:[]}).catch(()=>({items:[]}))
  ]).then(([support,registry,notices,events])=>{
    const sourceById=new Map((registry.sources||[]).map(x=>[x.id,x]));
    const days=Number.isInteger(notices?.retention_days)&&notices.retention_days>0?notices.retention_days:3;
    function currentItems(){
      const now=Date.now();
      const updates=(support.hot_now?.items||[]).filter(x=>isActive(x,now));
      const editorialEvents=(events?.items||[]).filter(x=>isActive(x,now));
      const operationalRoute=x=>({
        place_sunset_town:"places/detail.html?id=sunset-town",
        place_exotica:"places/detail.html?id=exotica",
        activity_tinh_hoa_viet_nam:"places/detail.html?id=tinh-hoa-viet-nam",
        activity_sac_mau_venice:"places/detail.html?id=sac-mau-venice"
      })[x.entity_id]||"news/";
      const operationalCategory=x=>x.status==="BOOKING_FULL"?"ĐẶT CHỖ / SUNSET TOWN":
        ["SUSPENDED","SUSPENDED_UPGRADE"].includes(x.status)?"HOẠT ĐỘNG / TẠM DỪNG":"BIỂU DIỄN / THÔNG BÁO";
      const operationals=(notices?.notices||[]).filter(x=>{
        const eventStart=typeof x.date==="string"?Date.parse(x.date+"T00:00:00+07:00"):NaN;
        const visibleFrom=x.effective_from?Date.parse(x.effective_from+"T00:00:00+07:00"):
          Number.isFinite(eventStart)?eventStart:-Infinity;
        const fallbackEnd=Number.isFinite(eventStart)?eventStart+days*86400000:Infinity;
        const visibleUntil=x.valid_until?Date.parse(x.valid_until):fallbackEnd;
        if(!Number.isFinite(visibleFrom)&&visibleFrom!==-Infinity)return false;
        if(!Number.isFinite(visibleUntil)&&visibleUntil!==Infinity)return false;
        if(now<visibleFrom||now>=visibleUntil)return false;
        return ["CANCELLED","BOOKING_FULL","SUSPENDED","SUSPENDED_UPGRADE"].includes(x.status);
      }).map(x=>({
        category:operationalCategory(x),
        title:x.title,short_summary:[x.summary,x.booking_message].filter(Boolean).join(" "),
        published_at:x.effective_from||x.date,verified_at:x.effective_from||x.date,
        source_text:x.source,
        route:operationalRoute(x)
      }));
      const seen=new Set();
      return [...operationals,...editorialEvents,...updates]
        .sort((a,b)=>Date.parse(b.published_at||b.verified_at||0)-Date.parse(a.published_at||a.verified_at||0))
        .filter(x=>{const key=x.event_id||x.title;if(seen.has(key))return false;seen.add(key);return true});
    }
    function renderNews(){
      const items=currentItems();

    $("#newsCount").textContent=items.length?items.length+" điều đáng chú ý":"Hôm nay chưa có gì mới";
    const latestDate=[support.updated_at,events?.updated_at,...items.map(x=>x.published_at||x.verified_at).filter(Boolean)].filter(Boolean)
      .sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
    $("#newsUpdated").textContent=fmtDate(latestDate)||"Hôm nay";

    if(!items.length){
      $("#newsList").innerHTML='<div class="news-empty">Hôm nay chưa có thay đổi nào đủ lớn để phải để ý.</div>';
      return;
    }

    $("#newsList").innerHTML=items.map(x=>{
      const source=sourceById.get(x.source_id)||null;
      const published=fmtDate(x.published_at||x.verified_at);
      const route=x.route||"../";
      return '<article class="news-card">'+
        '<div class="news-card-meta"><span>'+esc(x.category||"CẬP NHẬT")+'</span>'+(published?'<time>'+esc(published)+'</time>':"")+'</div>'+
        '<div class="news-card-body"><strong>'+esc(x.title)+'</strong><p>'+esc(x.short_summary||"")+'</p>'+
        ((x.source_text||source?.label)?'<small>'+esc(x.source_text||source.label)+'</small>':"")+'</div>'+
        '<div class="news-card-actions"><a href="../'+esc(route.replace(/^\/+/,''))+'">Xem liên quan →</a></div>'+
      '</article>';
    }).join("");
    }
    renderNews();
    setInterval(renderNews,60000);
  }).catch(()=>{
    $("#newsCount").textContent="Chưa mở được lúc này";
    $("#newsList").innerHTML='<div class="news-empty">Mục này chưa mở được. Thử lại sau một chút nhé.</div>';
  });
})();