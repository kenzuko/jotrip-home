(() => {
  "use strict";
  // Only the public CMS website is measured; never the admin area or preview.
  if(location.hostname!=="cms.openphuquoc.com")return;
  if(/^\/(?:admin|api|cms)(?:\/|$)/.test(location.pathname))return;
  if(navigator.globalPrivacyControl===true||navigator.doNotTrack==="1"||window.doNotTrack==="1")return;
  if(/bot|crawl|spider|headless|lighthouse/i.test(navigator.userAgent||""))return;
  const permitted=new Set(["page_view","go_open","nearme_open","weather_open","airport_open","transit_open","feedback_open"]);
  const article=/^\/(?:stories|guide)\/article\.html$|^\/places\/detail\.html$/;
  const path=()=>{
    let p=location.pathname;
    if(p==="/index.html")p="/";
    if(article.test(p)){
      const id=new URLSearchParams(location.search).get("id")||"";
      if(/^[a-z0-9_-]{1,80}$/i.test(id))p+="?id="+id;
    }
    return p;
  };
  const device=()=>{
    const ua=navigator.userAgent||"";
    if(/iPad|Tablet/i.test(ua))return "tablet";
    if(/Mobi|iPhone|Android/i.test(ua))return "mobile";
    return "desktop";
  };
  const referrer=()=>{
    try{return document.referrer?new URL(document.referrer).hostname.toLowerCase():""}catch{return ""}
  };
  const ref=referrer(),type=device();
  function send(event){
    if(!permitted.has(event))return;
    const payload={event,path:path(),referrer:ref,device:type};
    fetch("/api/traffic/collect",{
      method:"POST",credentials:"omit",keepalive:true,
      headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
    }).catch(()=>{}); // Measurement never interferes with the visitor.
  }
  if(document.visibilityState!=="prerender")send("page_view");
  else document.addEventListener("visibilitychange",function once(){
    if(document.visibilityState==="visible"){document.removeEventListener("visibilitychange",once);send("page_view")}
  });
  document.addEventListener("click",event=>{
    const trigger=event.target.closest("[data-openpq-feedback],a[href],button[data-openpq-feedback]");
    if(!trigger)return;
    if(trigger.matches("[data-openpq-feedback]")){send("feedback_open");return}
    let pathname="";
    try{
      const target=new URL(trigger.href,location.href);
      if(target.origin!==location.origin)return;
      pathname=target.pathname;
    }catch{return}
    const match=pathname.match(/^\/(go|nearme|weather|airport|transit)(?:\/|$)/);
    if(match)send(match[1]+"_open");
  },{capture:true,passive:true});
})();
