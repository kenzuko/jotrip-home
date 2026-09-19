(()=> {
  const targets=[...document.querySelectorAll("[data-vn-clock]")];
  if(!targets.length)return;
  if(!document.querySelector("#openpq-clock-style")){
    const s=document.createElement("style");s.id="openpq-clock-style";
    s.textContent=`
      .vn-clock{display:grid;grid-template-columns:auto auto;column-gap:8px;align-items:center;line-height:1;white-space:nowrap}
      .vn-clock>span{grid-column:1;font-size:7px;letter-spacing:.13em;font-weight:900;color:#6C7E7A}
      .vn-clock>strong{grid-column:1;font-size:17px;font-variant-numeric:tabular-nums;color:#123D3B;margin-top:3px}
      .vn-clock>small{grid-column:2;grid-row:1/3;align-self:center;font-size:7px;line-height:1.4;color:#83908D}
      @media(max-width:760px){.vn-clock>small{display:none}.vn-clock>strong{font-size:14px}.vn-clock>span{font-size:6px}}
    `;
    document.head.appendChild(s);
  }
  const fmtTime=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});
  const fmtDate=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",day:"2-digit",month:"short"});
  function tick(){
    const now=new Date();
    const time=fmtTime.format(now);
    const date=fmtDate.format(now).toUpperCase();
    targets.forEach(el=>{
      el.innerHTML='<span>VIETNAM TIME</span><strong>'+time+'</strong><small>'+date+'<br>GMT+7</small>';
      el.setAttribute("title","Giờ hiện tại tại Việt Nam (Asia/Ho_Chi_Minh)");
    });
  }
  tick();setInterval(tick,1000);
})();