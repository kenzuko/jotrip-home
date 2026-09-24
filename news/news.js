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
    fetch("../data/source-registry.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/operational-notices.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{notices:[]}).catch(()=>({notices:[]}))
  ]).then(([support,registry,notices])=>{
    const sourceById=new Map((registry.sources||[]).map(x=>[x.id,x]));
    const days=Number.isInteger(notices?.retention_days)&&notices.retention_days>0?notices.retention_days:3;
    function currentItems(){
      const now=Date.now();
      const updates=(support.hot_now?.items||[]).filter(x=>isActive(x,now));
      const operationals=(notices?.notices||[]).filter(x=>{
        if(x.status!=="CANCELLED"||typeof x.date!=="string")return false;
        const start=Date.parse(x.date+"T00:00:00+07:00");
        return Number.isFinite(start)&&now>=start&&now<start+days*86400000;
      }).map(x=>({
        category:"SHOW / THÔNG BÁO",
        title:x.title,short_summary:x.summary+" "+x.booking_message,
        published_at:x.date,verified_at:x.date,
        source_text:x.source,
        route:"places/detail.html?id=tinh-hoa-viet-nam"
      }));
      return [...operationals,...updates]
        .sort((a,b)=>Date.parse(b.published_at||b.verified_at||0)-Date.parse(a.published_at||a.verified_at||0));
    }
    function renderNews(){
      const items=currentItems();

    $("#newsCount").textContent=items.length?items.length+" điều đáng chú ý":"Hôm nay chưa có gì mới";
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
        '<div class="news-card-body"><strong>'+esc(x.title)+'</strong><p>'+esc(x.short_summary||"")+'</p>'+
        (x.source_text?'<small>'+esc(x.source_text)+'</small>':"")+'</div>'+
        '<div class="news-card-actions"><a href="../'+esc(route.replace(/^\/+/,''))+'">Xem liên quan →</a>'+(sourceUrl?'<a href="'+esc(sourceUrl)+'" target="_blank" rel="noopener">Nguồn ↗</a>':"")+'</div>'+
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