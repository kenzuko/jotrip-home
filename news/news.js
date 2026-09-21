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
    fetch("../data/home-support.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/source-registry.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json())
  ]).then(([support,registry])=>{
    const sourceById=new Map((registry.sources||[]).map(x=>[x.id,x]));
    const now=Date.now();
    const items=(support.hot_now?.items||[])
      .filter(x=>isActive(x,now))
      .sort((a,b)=>Date.parse(b.published_at||b.verified_at||0)-Date.parse(a.published_at||a.verified_at||0));

    $("#newsCount").textContent=items.length?items.length+" cập nhật còn mới":"Hôm nay chưa có gì mới";
    $("#newsUpdated").textContent=fmtDate(support.updated_at)||"Hôm nay";

    if(!items.length){
      $("#newsList").innerHTML='<div class="news-empty">Hôm nay chưa có thay đổi nào đủ lớn để phải để ý.</div>';
      return;
    }

    $("#newsList").innerHTML=items.map(x=>{
      const source=sourceById.get(x.source_id)||null;
      const published=fmtDate(x.published_at||x.verified_at);
      const route=x.route||"../";
      const sourceUrl=source?.url||"";
      return '<article class="news-card">'+
        '<div class="news-card-meta"><span>'+esc(x.category||"CẬP NHẬT")+'</span>'+(published?'<time>'+esc(published)+'</time>':"")+'</div>'+
        '<div class="news-card-body"><strong>'+esc(x.title)+'</strong><p>'+esc(x.short_summary||"")+'</p></div>'+
        '<div class="news-card-actions"><a href="../'+esc(route.replace(/^\/+/,''))+'">Xem liên quan →</a>'+(sourceUrl?'<a href="'+esc(sourceUrl)+'" target="_blank" rel="noopener">Nguồn ↗</a>':"")+'</div>'+
      '</article>';
    }).join("");
  }).catch(()=>{
    $("#newsCount").textContent="Chưa mở được lúc này";
    $("#newsList").innerHTML='<div class="news-empty">Mục này chưa mở được. Thử lại sau một chút nhé.</div>';
  });
})();