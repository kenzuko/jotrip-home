(()=> {
  const targets=[...document.querySelectorAll("[data-vn-clock]")];
  if(!targets.length)return;
  if(!document.querySelector("#openpq-clock-style")){
    const s=document.createElement("style");s.id="openpq-clock-style";
    s.textContent=`
      .vn-clock{display:grid;grid-template-columns:auto auto;column-gap:10px;align-items:center;min-height:44px;padding:7px 11px;border:1px solid rgba(18,61,59,.12);border-radius:14px;background:rgba(255,255,255,.76);box-shadow:0 7px 24px rgba(18,61,59,.05);line-height:1;white-space:nowrap}
      .vn-clock>span{grid-column:1;font-size:9px;letter-spacing:.14em;font-weight:850;color:#6C7E7A}
      .vn-clock>strong{grid-column:1;margin-top:4px;color:#123D3B;font-size:20px;font-weight:760;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
      .vn-clock>small{grid-column:2;grid-row:1/3;align-self:center;padding-left:10px;border-left:1px solid #DCE8E5;font-size:11px;line-height:1.45;color:#71817E}
      @media(max-width:760px){.vn-clock{min-height:38px;padding:5px 8px;border-radius:11px}.vn-clock>small{display:none}.vn-clock>strong{font-size:17px}.vn-clock>span{font-size:8px}}
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
      el.innerHTML='<span>PHÚ QUỐC BÂY GIỜ</span><strong>'+time+'</strong><small>'+date+'<br>Giờ Việt Nam</small>';
      el.setAttribute("title","Giờ hiện tại tại Việt Nam (Asia/Ho_Chi_Minh)");
      el.setAttribute("aria-label","Giờ Phú Quốc "+time+", "+date);
    });
  }
  tick();setInterval(tick,1000);
})();
