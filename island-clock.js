(()=> {
  const targets=[...document.querySelectorAll("[data-vn-clock]")];
  if(!targets.length)return;
  if(!document.querySelector("#openpq-clock-style")){
    const s=document.createElement("style");s.id="openpq-clock-style";
    s.textContent=`
      .vn-clock{display:grid;grid-template-columns:auto auto;column-gap:11px;align-items:center;min-height:46px;padding:7px 12px;border:1px solid rgba(18,61,59,.12);border-radius:15px;background:rgba(255,255,255,.82);box-shadow:0 8px 26px rgba(18,61,59,.06);line-height:1;white-space:nowrap}
      .vn-clock>span{grid-column:1;font-size:10px;letter-spacing:.13em;font-weight:850;color:#536f6b}
      .vn-clock>strong{grid-column:1;margin-top:4px;color:#123D3B;font-size:21px;font-weight:780;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
      .vn-clock>small{grid-column:2;grid-row:1/3;align-self:center;padding-left:11px;border-left:1px solid #DCE8E5;font-size:12px;line-height:1.45;color:#607773}
      @media(max-width:760px){.vn-clock{min-height:40px;padding:6px 9px;border-radius:12px}.vn-clock>small{display:none}.vn-clock>strong{font-size:18px}.vn-clock>span{font-size:9px}}
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
      el.innerHTML='<span>GIỜ TRÊN ĐẢO</span><strong>'+time+'</strong><small>'+date+'<br>UTC+7 · Việt Nam</small>';
      el.setAttribute("title","Giờ hiện tại tại Việt Nam (Asia/Ho_Chi_Minh)");
      el.setAttribute("aria-label","Giờ Phú Quốc "+time+", "+date);
    });
  }
  tick();setInterval(tick,1000);
})();
