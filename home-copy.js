(()=> {
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const set=(s,t)=>{const e=q(s);if(e&&t)e.textContent=t};

  fetch("data/home-copy.json?t="+Date.now(),{cache:"no-store"})
    .then(r=>r.json())
    .then(d=>{
      set(".hero-kicker",d.hero?.kicker);
      set(".hero-copy h1",d.hero?.title);
      set(".hero-copy>p:not(.hero-kicker)",d.hero?.lead);

      const slides=qa(".hero-slide");
      (d.hero?.slides||[]).slice(0,slides.length).forEach((slide,i)=>{
        const el=slides[i],img=el?.querySelector("img");
        if(!el||!img)return;
        if(slide.label)el.dataset.label=slide.label;
        if(slide.image)img.src=slide.image;
        if(slide.alt)img.alt=slide.alt;
      });

      if(d.hero?.slides?.[0]?.label)set(".hero-scene-label",d.hero.slides[0].label);

      for(const [id,v] of Object.entries(d.sections||{})){
        if(id==="happening") continue;
        set("#"+id+" .eyebrow",v.eyebrow);
        set("#"+id+" .section-heading h2",v.title);
        if(id==="heritage"){
          set("#heritage .heritage-intro .eyebrow",v.eyebrow);
          set("#heritage .heritage-intro h2",v.title);
          set("#heritage .heritage-intro>p:last-child",v.lead);
        }
      }
    })
    .catch(()=>{});
})();