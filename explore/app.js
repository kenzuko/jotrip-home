(() => {
  "use strict";

  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const params=new URLSearchParams(location.search);

  const state={
    zones:[],
    entities:[],
    facets:[],
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
    const tags=[...(x.categories||[]),...(x.intents||[])];
    const meta=[];
    if(x.best_time) meta.push(["Lúc nên đi",x.best_time]);
    if(x.duration) meta.push(["Thời lượng",x.duration]);
    if(x.weather_dependency) meta.push(["Phụ thuộc weather",String(x.weather_dependency).toUpperCase()]);

    return '<article class="explore-card" data-zone="'+esc(x.zone_id||"")+'">'+
      '<div class="card-top"><span class="card-type">'+entityType(x)+' · '+esc(zoneName(x.zone_id))+'</span>'+
      (x.live_check_required?'<span class="card-live">CHECK LIVE</span>':'')+'</div>'+
      '<h3>'+esc(x.name)+'</h3>'+
      '<p>'+esc(x.what_it_is||x.why_go||"")+'</p>'+
      (meta.length?'<div class="card-meta">'+meta.map(([k,v])=>'<div><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join("")+'</div>':'')+
      '<div class="card-tags">'+[...new Set(tags)].slice(0,5).map(t=>'<span>'+esc(t)+'</span>').join("")+'</div>'+
      '<a class="card-link" href="'+detailLink(x)+'"><span>Xem chi tiết</span><b>→</b></a>'+
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
      : '<div class="loading">Chưa có entity phù hợp với bộ lọc này. Thử bỏ bớt một điều kiện.</div>';
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
    fetch("../data/views/explore-facets.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json())
  ]).then(([zones,places,activities,facets])=>{
    state.zones=zones.entities||[];
    state.entities=[...(places.entities||[]),...(activities.entities||[])];
    state.facets=facets.intents||[];
    if(!state.zones.some(z=>z.id===state.zone)) state.zone="all";
    if(!state.facets.some(f=>f.id===state.intent)) state.intent="all";
    render();
  }).catch(error=>{
    console.warn(error);
    $("#resultTitle").textContent="Chưa tải được Explore";
    $("#exploreGrid").innerHTML='<div class="loading">Dữ liệu Explore đang tạm thời chưa tải được.</div>';
  });
})();