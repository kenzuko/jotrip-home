(()=> {
  const targets=[...document.querySelectorAll("[data-vn-clock]")];
  if(!targets.length)return;
  const fmtTime=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
  const fmtDate=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",day:"2-digit",month:"short"});
  function tick(){
    const now=new Date();
    const time=fmtTime.format(now);
    const date=fmtDate.format(now).toUpperCase();
    targets.forEach(el=>{
      el.innerHTML='<span>VIETNAM TIME</span><strong>'+time+'</strong><small>'+date+' · GMT+7</small>';
      el.setAttribute("title","Giờ hiện tại tại Việt Nam (Asia/Ho_Chi_Minh)");
    });
  }
  tick();setInterval(tick,1000);
})();