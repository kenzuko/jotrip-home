(()=> {
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const set=(s,t,path)=>{const e=q(s);if(e&&t){e.textContent=t;if(path)e.dataset.cmsField=path;}};

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
        if(slide.label)el.dataset.label=slide.label;
        if(slide.image)img.src=slide.image;
        if(slide.alt)img.alt=slide.alt;
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
    })
    .catch(()=>{});
})();
