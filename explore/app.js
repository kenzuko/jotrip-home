(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const VISUALS="../data/visual-context.json";
  const levelStyle=document.createElement("style");levelStyle.textContent='.card-level{display:inline-flex;width:max-content;margin:10px 0 0;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:850}.card-level.level-1{background:#fff0e8;color:#9a452f}.card-level.level-2{background:#e8f5fb;color:#17638f}.card-level.level-3{background:#eef6f4;color:#315f5b}';document.head.appendChild(levelStyle);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const params=new URLSearchParams(location.search);
  const labels={
    family:"Gia đình",couple:"Cặp đôi",sea:"Biển",evening:"Buổi tối",nature:"Thiên nhiên",
    "local-life":"Đời sống địa phương","rainy-day":"Ngày mưa",show:"Biểu diễn",beach:"Bãi biển",
    culture:"Văn hóa",history:"Lịch sử",outdoor:"Ngoài trời",indoor:"Trong nhà",waterpark:"Công viên nước",
    "cable-car":"Cáp treo",resort:"Khu nghỉ dưỡng",architecture:"Kiến trúc",fireworks:"Pháo hoa",marine:"Biển đảo"
  };

  const state={
    zones:[],
    entities:[],
    facets:[],
    levels:[],
    planning:new Map(),
    visuals:{},
    zone:params.get("zone")||"all",
    intent:params.get("intent")||"all"
  };

  function tagsOf(x){
    return new Set([
      ...(x.categories||[]),
      ...(x.intents||[]),
      ...(x.best_for||[])
    ].map(v=>String(v).toLowerCase()));
  }

  function matchesIntent(entity,facet){
    if(!facet || facet.id==="all") return true;
    if((facet.include_ids||[]).includes(entity.id)) return true;
    const tags=tagsOf(entity);
    return (facet.match_any||[]).some(tag=>tags.has(String(tag).toLowerCase()));
  }

  function filtered(){
    const facet=state.facets.find(x=>x.id===state.intent);
    return state.entities.filter(x=>{
      const zoneOk=state.zone==="all" || x.zone_id===state.zone;
      return zoneOk && matchesIntent(x,facet);
    });
  }

  function zoneName(id){
    if(!id) return "Toàn đảo";
    return state.zones.find(z=>z.id===id)?.name || id;
  }

  function entityType(x){
    return x.entity_type==="activity"?"TRẢI NGHIỆM":"ĐỊA ĐIỂM";
  }

  function friendly(value){
    const raw=String(value??"");
    return labels[raw.toLowerCase()]||raw.replaceAll("-"," ");
  }

  function weatherLevel(value){
    return ({high:"Cao",medium:"Vừa",low:"Thấp",none:"Không đáng kể"})[String(value||"").toLowerCase()]||friendly(value);
  }

  function detailLink(x){
    return "../places/detail.html?id="+encodeURIComponent(x.slug||x.id);
  }

  function renderFilters(){
    const zoneHost=$("#zoneFilters");
    const intentHost=$("#intentFilters");
    if(zoneHost){
      zoneHost.innerHTML=[
        {id:"all",name:"Tất cả Phú Quốc"},
        ...state.zones
      ].map(z=>'<button type="button" data-zone="'+esc(z.id)+'" class="'+(state.zone===z.id?"active":"")+'">'+esc(z.name)+'</button>').join("");
      zoneHost.querySelectorAll("[data-zone]").forEach(btn=>btn.addEventListener("click",()=>{
        state.zone=btn.dataset.zone;
        syncUrl();
        render();
      }));
    }
    if(intentHost){
      intentHost.innerHTML=state.facets.map(f=>'<button type="button" data-intent="'+esc(f.id)+'" class="'+(state.intent===f.id?"active":"")+'">'+esc(f.label)+'</button>').join("");
      intentHost.querySelectorAll("[data-intent]").forEach(btn=>btn.addEventListener("click",()=>{
        state.intent=btn.dataset.intent;
        syncUrl();
        render();
      }));
    }
  }

  function syncUrl(){
    const q=new URLSearchParams();
    if(state.zone!=="all") q.set("zone",state.zone);
    if(state.intent!=="all") q.set("intent",state.intent);
    const next=q.toString()?location.pathname+"?"+q.toString():location.pathname;
    history.replaceState(null,"",next);
  }

  function renderCard(x){
    const planning=state.planning.get(x.id)||{};
    const visual=state.visuals?.places?.[x.id]?.images?.[0]||null;
    const visualHtml=visual
      ? '<figure class="explore-card-media"><img src="'+esc(visual.url)+'" alt="'+esc(visual.alt||x.name)+'" loading="lazy" decoding="async"><figcaption>'+esc(visual.caption||"")+'</figcaption></figure>'
      : '<div class="explore-card-illustration" data-zone="'+esc(x.zone_id||"all")+'"><span>⌖</span><strong>'+esc(zoneName(x.zone_id))+'</strong><small>Bối cảnh khu vực</small></div>';
    const level=state.levels.find(l=>l.id===planning.level);
    const strength=(planning.strengths||[])[0];
    const watch=(planning.watch_outs||[])[0];
    const tags=[...(x.categories||[]),...(x.intents||[])];
    const meta=[];
    if(x.best_time) meta.push(["Lúc nên đi",x.best_time]);
    if(x.duration) meta.push(["Thời lượng",x.duration]);
    if(x.weather_dependency) meta.push(["Phụ thuộc thời tiết",weatherLevel(x.weather_dependency)]);

    return '<article class="explore-card" data-zone="'+esc(x.zone_id||"")+'">'+
      visualHtml+
      '<div class="explore-card-body">'+
      '<div class="card-top"><span class="card-type">'+entityType(x)+' · '+esc(zoneName(x.zone_id))+'</span>'+
      (x.live_check_required?'<span class="card-live">KIỂM TRA TRƯỚC KHI ĐI</span>':'')+'</div>'+
      (level?'<span class="card-level level-'+level.id+'">'+esc(level.label)+'</span>':'')+
      '<h3>'+esc(x.name)+'</h3>'+
      '<p>'+esc(x.what_it_is||x.why_go||"")+'</p>'+
      (strength?'<div class="card-decision"><span>HỢP KHI</span><strong>'+esc(strength)+'</strong></div>':'')+
      (watch?'<div class="card-watch"><span>TRƯỚC KHI ĐI</span><strong>'+esc(watch)+'</strong></div>':'')+
      (meta.length?'<div class="card-meta">'+meta.map(([k,v])=>'<div><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("")+'</div>':'')+
      '<div class="card-tags">'+[...new Set(tags)].slice(0,5).map(t=>'<span>'+esc(friendly(t))+'</span>').join("")+'</div>'+
      '<a class="card-link" href="'+detailLink(x)+'"><span>Xem kỹ hơn</span><b>→</b></a>'+
      '</div>'+
    '</article>';
  }

  function render(){
    renderFilters();
    const rows=filtered();
    const facet=state.facets.find(x=>x.id===state.intent);
    const zoneLabel=state.zone==="all"?"Toàn đảo":zoneName(state.zone);
    const intentLabel=facet?.id==="all"?"":facet?.label||"";

    $("#resultEyebrow").textContent=[zoneLabel,intentLabel].filter(Boolean).join(" · ").toUpperCase();
    $("#resultTitle").textContent=rows.length+" lựa chọn phù hợp";

    const note=$("#facetNote");
    if(note){
      if(facet?.note){
        note.hidden=false;
        note.textContent=facet.note;
      }else{
        note.hidden=true;
        note.textContent="";
      }
    }

    const grid=$("#exploreGrid");
    grid.innerHTML=rows.length
      ? rows.map(renderCard).join("")
      : '<div class="loading">Chưa có lựa chọn phù hợp. Hãy thử bỏ bớt một điều kiện lọc.</div>';
  }

  $("#clearFilters")?.addEventListener("click",()=>{
    state.zone="all";
    state.intent="all";
    syncUrl();
    render();
  });

  Promise.all([
    fetch("../data/entities/zones.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/places.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/entities/activities.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/views/explore-facets.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch("../data/views/place-planning-levels.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
    fetch(VISUALS+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{}).catch(()=>({}))
  ]).then(([zones,places,activities,facets,planning,visuals])=>{
    state.zones=zones.entities||[];
    state.entities=[...(places.entities||[]),...(activities.entities||[])];
    state.facets=facets.intents||[];
    state.levels=planning.levels||[];
    state.planning=new Map((planning.items||[]).map(x=>[x.entity_id,x]));
    state.visuals=visuals||{};
    if(!state.zones.some(z=>z.id===state.zone)) state.zone="all";
    if(!state.facets.some(f=>f.id===state.intent)) state.intent="all";
    render();
  }).catch(error=>{
    console.warn(error);
    $("#resultTitle").textContent="Chưa tải được nội dung khám phá";
    $("#exploreGrid").innerHTML='<div class="loading">Thông tin khám phá đang tạm thời chưa tải được. Vui lòng thử lại sau.</div>';
  });
})();
