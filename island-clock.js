(()=> {
  const targets=[...document.querySelectorAll("[data-vn-clock]")];
  if(!targets.length)return;
  if(!document.querySelector("#openpq-clock-style")){
    const s=document.createElement("style");s.id="openpq-clock-style";
    s.textContent=`
      .vn-clock{display:grid;grid-template-columns:auto auto;column-gap:8px;align-items:center;line-height:1;white-space:nowrap}
      .vn-clock>span{grid-column:1;font-size:10px;letter-spacing:.1em;font-weight:850;color:#6C7E7A}
      .vn-clock>strong{grid-column:1;font-size:19px;font-variant-numeric:tabular-nums;color:#123D3B;margin-top:4px}
      .vn-clock>small{grid-column:2;grid-row:1/3;align-self:center;padding-left:8px;border-left:1px solid #E3ECE9;font-size:11px;line-height:1.45;color:#71817E}
      @media(max-width:760px){.vn-clock>small{display:none}.vn-clock>strong{font-size:16px}.vn-clock>span{font-size:9px}}
    `;
    document.head.appendChild(s);
  }
  const fmtTime=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false});
  const fmtDate=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"short",day:"2-digit",month:"2-digit"});
  function tick(){
    const now=new Date();
    const time=fmtTime.format(now);
    const date=fmtDate.format(now).replace(",","");
    targets.forEach(el=>{
      el.innerHTML='<span>GIỜ PHÚ QUỐC</span><strong>'+time+'</strong><small>'+date+'<br>UTC+7</small>';
      el.setAttribute("title","Giờ hiện tại tại Việt Nam (Asia/Ho_Chi_Minh)");
      el.setAttribute("aria-label","Giờ Phú Quốc "+time+", "+date);
    });
  }
  tick();setInterval(tick,1000);
})();
