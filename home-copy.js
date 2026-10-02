(()=> {
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  // CMS copy can hydrate before or after the deferred English runtime; always
  // hand hydrated strings back through the locale layer before they settle.
  const tr=t=>window.OpenPQEnglishSite?.translateString?.(t)||t;
  const set=(s,t,path)=>{const e=q(s);if(e&&t){e.textContent=tr(t);if(path)e.dataset.cmsField=path;}};
  const retranslate=()=>window.OpenPQEnglishSite?.walk?.(document);
  const afterEnglishReady=()=>{
    if(window.OpenPQEnglishSite?.load){
      window.OpenPQEnglishSite.load().then(retranslate).catch(()=>{});
      return;
    }
    document.addEventListener("openpq:english-ready",retranslate,{once:true});
  };

  const load=window.OpenPQPublicData?.json||((url)=>fetch(url,{cache:"default"}).then(r=>{
    if(!r.ok)throw new Error(String(r.status));return r.json();
  }));
  load("data/home-copy.json")
    .then(d=>{
      set(".hero-kicker",d.hero?.kicker,"hero.kicker");
      set(".hero-copy h1",d.hero?.title,"hero.title");
      set(".hero-copy>p:not(.hero-kicker)",d.hero?.lead,"hero.lead");

      const slides=qa(".hero-slide");
      (d.hero?.slides||[]).slice(0,slides.length).forEach((slide,i)=>{
        const el=slides[i],img=el?.querySelector("img");
        if(!el||!img)return;
        if(slide.label)el.dataset.label=tr(slide.label);
        if(slide.image)img.src=slide.image;
        if(slide.alt)img.alt=tr(slide.alt);
      });

      if(d.hero?.slides?.[0]?.label)set(".hero-scene-label",d.hero.slides[0].label);

      set(".site-footer .footer-brand strong",d.footer?.title,"footer.title");
      set(".site-footer .footer-brand p",d.footer?.lead,"footer.lead");
      set(".site-footer .footer-brand small",d.footer?.note,"footer.note");
      for(const [id,v] of Object.entries(d.sections||{})){
        if(id==="happening") continue;
        set("#"+id+" .eyebrow",v.eyebrow,"sections."+id+".eyebrow");
        set("#"+id+" .section-heading h2",v.title,"sections."+id+".title");
        if(id==="heritage"){
          set("#heritage .heritage-intro .eyebrow",v.eyebrow,"sections."+id+".eyebrow");
          set("#heritage .heritage-intro h2",v.title,"sections."+id+".title");
          set("#heritage .heritage-intro>p:last-child",v.lead,"sections."+id+".lead");
        }
      }
      afterEnglishReady();
    })
    .catch(()=>{});

  // Short-lived editorial events use a tiny separate feed so a news post can be
  // surfaced immediately without rewriting operational data. The foundation
  // renderer still owns the Hot Now section; this layer only prepends active
  // editorial cards and keeps the existing three-card limit.
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  let editorialEvents=[];
  const activeEvents=()=>{
    const now=Date.now();
    return editorialEvents.filter(x=>!x.expires_at||Date.parse(x.expires_at)>now)
      .sort((a,b)=>Date.parse(b.published_at||b.verified_at||0)-Date.parse(a.published_at||a.verified_at||0));
  };
  const eventCard=x=>{
    const raw=x.published_at||x.verified_at||"";
    const published=raw?new Intl.DateTimeFormat("vi-VN",{day:"2-digit",month:"2-digit"}).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw+"T12:00:00+07:00":raw)):"";
    return '<a class="hot-card" data-editorial-event="'+esc(x.event_id||x.title)+'" href="'+esc(x.route||"news/")+'"><span>'+esc(x.category||"CẬP NHẬT")+'</span><strong>'+esc(x.title)+'</strong><p>'+esc(x.short_summary||"")+'</p>'+(published?'<small>Cập nhật '+esc(published)+'</small>':"")+'</a>';
  };
  const syncEditorialEvents=()=>{
    const host=q("#hotNowList");if(!host)return;
    const active=activeEvents(),ids=new Set(active.map(x=>String(x.event_id||x.title)));
    host.querySelectorAll("[data-editorial-event]").forEach(el=>{if(!ids.has(el.dataset.editorialEvent||""))el.remove()});
    [...active].reverse().forEach(x=>{
      const id=String(x.event_id||x.title);
      if([...host.querySelectorAll("[data-editorial-event]")].some(el=>el.dataset.editorialEvent===id))return;
      host.insertAdjacentHTML("afterbegin",eventCard(x));
    });
    const cards=[...host.querySelectorAll("a.hot-card")];
    cards.slice(3).forEach(el=>el.remove());
  };
  load("data/editorial-events.json")
    .then(d=>{
      editorialEvents=Array.isArray(d?.items)?d.items:[];
      syncEditorialEvents();
      const host=q("#hotNowList");
      if(host)new MutationObserver(()=>syncEditorialEvents()).observe(host,{childList:true});
      setInterval(syncEditorialEvents,60000);
    })
    .catch(()=>{});
})();