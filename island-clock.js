(()=> {
  const targets=[...document.querySelectorAll("[data-vn-clock]")];
  if(!targets.length)return;
  if(!document.querySelector("#openpq-clock-style")){
    const s=document.createElement("style");s.id="openpq-clock-style";
    s.textContent=`
      .vn-clock{position:relative;display:grid;grid-template-columns:auto auto;column-gap:12px;align-items:center;min-height:48px;padding:7px 13px 7px 16px;border:1px solid rgba(18,61,59,.11);border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(242,235,221,.48));box-shadow:0 9px 28px rgba(18,61,59,.055);line-height:1;white-space:nowrap;overflow:hidden}
      .vn-clock::before{content:"";position:absolute;inset:9px auto 9px 0;width:3px;border-radius:0 3px 3px 0;background:#D85B3F}
      .vn-clock>span{grid-column:1;font-size:8px;letter-spacing:.16em;font-weight:900;color:#607773}
      .vn-clock>strong{grid-column:1;margin-top:4px;color:#123D3B;font-size:22px;font-weight:760;font-variant-numeric:tabular-nums;letter-spacing:-.035em}
      .vn-clock>small{grid-column:2;grid-row:1/3;align-self:center;padding-left:12px;border-left:1px solid #DCE8E5;font-size:10px;line-height:1.5;color:#607773}
      .vn-clock>small b{color:#123D3B;font-size:9px;letter-spacing:.08em;text-transform:uppercase}
      @media(max-width:760px){.vn-clock{min-height:40px;padding:6px 10px 6px 13px;border-radius:13px}.vn-clock::before{inset:8px auto 8px 0}.vn-clock>small{display:none}.vn-clock>strong{font-size:18px}.vn-clock>span{font-size:7px}}
    `;
    document.head.appendChild(s);
  }
  const fmtTime=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false});
  const fmtDate=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"long",day:"2-digit",month:"2-digit"});
  function tick(){
    const now=new Date();
    const time=fmtTime.format(now);
    const date=fmtDate.format(now).replace(",","");
    targets.forEach(el=>{
      el.innerHTML='<span>GIỜ PHÚ QUỐC</span><strong>'+time+'</strong><small>'+date+'<br><b>Việt Nam · UTC+7</b></small>';
      el.setAttribute("title","Giờ hiện tại tại Việt Nam (Asia/Ho_Chi_Minh)");
      el.setAttribute("aria-label","Giờ Phú Quốc "+time+", "+date);
    });
  }
  tick();setInterval(tick,1000);
})();
