(() => {
  "use strict";

  const labels={
    WEATHER:"THỜI TIẾT",
    TRANSPORT:"BIỂN & TÀU",
    AIRPORT:"SÂN BAY",
    EDITORIAL:"GỢI Ý",
    ASTRONOMICAL:"HOÀNG HÔN"
  };
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  let rules=[];

  async function loadRules(){
    try{
      const r=await fetch("data/views/today-rules.json?t="+Date.now(),{cache:"no-store"});
      if(r.ok){
        const d=await r.json();
        rules=Array.isArray(d.rules)?d.rules:[];
      }
    }catch(e){}
  }

  function render(state){
    if(!window.OpenPQTodayEngineV2) return;
    const host=document.querySelector("#liveHappening");
    if(!host) return;

    const view=window.OpenPQTodayEngineV2.build({
      live:state?.live_status||{},
      signals:state?.signals||{},
      rules:rules,
      now:new Date()
    });

    host.innerHTML=view.items.map((x,index)=>{
      const badge=x.status==="normal"?"BÌNH THƯỜNG":
        x.status==="watch"?"THEO DÕI":
        x.status==="advisory"?"LƯU Ý":
        x.status==="unknown"?"CHƯA RÕ":"GỢI Ý";
      const ok=x.status==="normal";
      const rowType=x.type==="WEATHER"?"weather":x.type==="AIRPORT"?"travel":x.type==="TRANSPORT"?"place":"show";
      return '<a href="'+esc(x.route||"#")+'" class="happening-row" data-today-id="'+esc(x.id)+'">'+
        '<time><strong>'+(index===0?"NOW":String(index+1).padStart(2,"0"))+'</strong><span>'+esc(labels[x.type]||x.type)+'</span></time>'+
        '<div><span class="row-type '+rowType+'">'+esc(labels[x.type]||x.type)+'</span>'+
        '<h3>'+esc(x.title)+'</h3><p>'+esc(x.summary)+'</p></div>'+
        '<em class="'+(ok?"ok":"")+'">'+esc(badge)+'</em>'+
      '</a>';
    }).join("");

    window.OPENPQ_TODAY=view;
  }

  window.addEventListener("openpq:live-ready",async event=>{
    if(!rules.length) await loadRules();
    render(event.detail);
  });

  loadRules().then(()=>{
    if(window.OPENPQ_HOME) render(window.OPENPQ_HOME);
  });
})();