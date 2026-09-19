const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();

function searchCorpus(corpus,query){
  const q=norm(query).trim();
  if(!q)return [];
  const terms=q.split(/\s+/).filter(Boolean);
  return (corpus.chunks||[]).map(ch=>{
    const title=norm(ch.title),text=norm(ch.text);
    let score=0;
    if(title.includes(q))score+=20;
    if(text.includes(q))score+=10;
    terms.forEach(t=>{
      if(title.includes(t))score+=4;
      if(text.includes(t))score+=1;
    });
    return {ch,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,8);
}

function snippet(text,query){
  const raw=String(text||"").replace(/\s+/g," ").trim();
  const q=norm(query);
  const n=norm(raw);
  let pos=n.indexOf(q);
  if(pos<0){
    const first=q.split(/\s+/).find(Boolean);
    pos=first?n.indexOf(first):-1;
  }
  if(pos<0)pos=0;
  const start=Math.max(0,pos-90),end=Math.min(raw.length,pos+260);
  return (start>0?"…":"")+raw.slice(start,end)+(end<raw.length?"…":"");
}

function renderSearch(corpus,query){
  const box=$("#guideSearchResults");
  const results=searchCorpus(corpus,query);
  box.hidden=false;
  box.innerHTML=
    '<div class="search-results-head"><div><span>KẾT QUẢ SỔ TAY</span><strong>'+esc(query)+'</strong></div><b>'+results.length+' kết quả gần nhất</b></div>'+
    (results.length?results.map(({ch})=>
      '<details class="handbook-result">'+
        '<summary><strong>'+esc(ch.title)+'</strong><span>'+esc(snippet(ch.text,query))+'</span></summary>'+
        '<div>'+esc(ch.text).replace(/\n/g,"<br>")+'</div>'+
      '</details>'
    ).join(""):'<div class="search-empty">Chưa thấy mục phù hợp. Thử từ ngắn hơn như “visa”, “Safari”, “Bãi Sao”, “câu cá”, “khách sạn”.</div>');
  box.scrollIntoView({behavior:"smooth",block:"nearest"});
}

Promise.all([
  fetch("data.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
  fetch("../data/utilities.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
  fetch("../data/handbook-r3-index.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
  fetch("../data/handbook-r3-corpus.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json())
]).then(([d,u,index,corpus])=>{
  $("#sourceMeta").textContent="Sổ tay "+d.version+" · nội dung nền đã nạp đầy đủ để tra cứu, dữ liệu động vẫn đối chiếu nguồn live.";
  $("#handbookCoverage").textContent=(index.sections||[]).length+" nhóm nội dung · tìm trực tiếp trong toàn bộ sổ tay R3";

  const featuredIds=["start","arrival","stay","mobility","international","north","south","sea","practical","safety","culture","history"];
  const featured=(index.sections||[]).filter(x=>featuredIds.includes(x.id));
  $("#knowledgeGrid").innerHTML=featured.map(x=>{
    const q=(x.topics||[])[0]||x.label;
    return '<button type="button" data-guide-query="'+esc(q)+'"><span>'+esc(x.slides||"")+'</span><strong>'+esc(x.label)+'</strong><small>'+esc((x.topics||[]).slice(0,3).join(" · "))+'</small></button>';
  }).join("");

  document.querySelectorAll("[data-guide-query]").forEach(btn=>btn.onclick=()=>{
    const q=btn.dataset.guideQuery||"";
    $("#guideQ").value=q;
    renderSearch(corpus,q);
  });

  $("#guideSearch").onsubmit=e=>{
    e.preventDefault();
    const q=$("#guideQ").value.trim();
    if(q)renderSearch(corpus,q);
  };

  $("#guideQ").addEventListener("input",()=>{
    if(!$("#guideQ").value.trim())$("#guideSearchResults").hidden=true;
  });

  $("#zoneRail").innerHTML=d.zones.map(z=>
    '<article class="zone-card reveal"><img src="'+esc(z.image)+'" alt="'+esc(z.name)+'"><div><span>'+esc(z.tag)+'</span><h3>'+esc(z.name)+'</h3><p>'+esc(z.summary)+'</p><small>'+esc(z.best_for)+'</small></div></article>'
  ).join("");

  const times=(u.travel_times||[]).filter(x=>!(x.from==="Bắc đảo"&&x.to==="Nam đảo"));
  $("#distanceBars").innerHTML=times.map(x=>
    '<article class="distance-route reveal"><div><span>'+esc(x.from)+'</span><b>→</b><span>'+esc(x.to)+'</span></div><strong>'+x.min+'-'+x.max+' phút</strong></article>'
  ).join("");

  $("#northRhythm").innerHTML=d.north_rhythm.map(x=>
    '<article class="rhythm-card reveal"><span>'+esc(x.type)+'</span><strong>'+esc(x.name)+'</strong><p>'+esc(x.note)+'</p></article>'
  ).join("");

  $("#hotelTiers").innerHTML=d.hotels.tiers.map(x=>
    '<article class="tier-card reveal"><strong>'+esc(x.name)+'</strong><p>'+esc(x.note)+'</p></article>'
  ).join("");

  $("#hotelAreas").innerHTML=d.hotels.areas.map(x=>
    '<article class="hotel-area reveal"><span>'+esc(x.name)+'</span><strong>'+esc(x.hotels)+'</strong><p>'+esc(x.note)+'</p></article>'
  ).join("");

  $("#foodGrid").innerHTML=d.food.map(x=>
    '<article class="food-card reveal"><span>'+esc(x.group)+'</span><strong>'+esc(x.items)+'</strong><p>'+esc(x.note)+'</p></article>'
  ).join("");

  $("#itineraryRail").innerHTML=d.itineraries.map(x=>
    '<article class="itinerary-card reveal"><h3>'+esc(x.name)+'</h3><ol>'+x.days.map(day=>'<li>'+esc(day)+'</li>').join("")+'</ol><p>'+esc(x.note)+'</p></article>'
  ).join("");

  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{
    if(e.isIntersecting){e.target.classList.add("in");obs.unobserve(e.target)}
  }),{threshold:.08,rootMargin:"60px 0px -10px"});
  document.querySelectorAll(".reveal").forEach(el=>obs.observe(el));
}).catch(err=>{
  console.warn("[Guide]",err);
  $("#sourceMeta").textContent="Chưa tải được cẩm nang lúc này.";
  $("#handbookCoverage").textContent="Dữ liệu tạm thời chưa sẵn sàng";
});