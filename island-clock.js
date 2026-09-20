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
  const moduleFooter=document.querySelector(".module-footer");
  if(moduleFooter&&!moduleFooter.querySelector(".module-footer-inner")){
    const note=moduleFooter.textContent.trim();
    moduleFooter.innerHTML=`
      <div class="shell module-footer-inner">
        <div class="module-footer-brand">
          <img src="/assets/logo-master.png" alt="Open Phu Quoc">
          <div><strong>Hiểu đảo để đi nhẹ hơn.</strong><p>Thông tin đang diễn ra và kiến thức điểm đến trong cùng một hệ sinh thái dành cho người đang ở Phú Quốc.</p></div>
        </div>
        <nav class="module-footer-nav" aria-label="Mở phần khác">
          <a href="/">Hôm nay</a><a href="/explore/">Khám phá</a><a href="/guide/">Cẩm nang</a><a href="/about/">Về chúng tôi</a>
        </nav>
        <div class="module-footer-note">${note}</div>
      </div>`;
    const fs=document.createElement("style");fs.id="openpq-module-footer-style";
    fs.textContent=`
      .module-footer{padding:30px 0 90px!important;background:#fff;color:#6C7E7A!important;font-size:12px!important}
      .module-footer-inner{display:grid;grid-template-columns:minmax(260px,1.2fr) minmax(220px,.8fr);gap:24px;align-items:start}
      .module-footer-brand{display:grid;grid-template-columns:58px minmax(0,1fr);gap:14px;align-items:center}
      .module-footer-brand img{width:58px;height:58px;object-fit:contain}
      .module-footer-brand strong{display:block;color:#123D3B;font-size:17px;letter-spacing:-.02em}
      .module-footer-brand p{max-width:560px;margin:5px 0 0;font-size:12px;line-height:1.55}
      .module-footer-nav{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}
      .module-footer-nav a{padding:9px 11px;border:1px solid #DDE9E6;border-radius:999px;background:#F5F9F8;color:#123D3B;font-size:11px;font-weight:800;text-decoration:none}
      .module-footer-note{grid-column:1/-1;padding-top:14px;border-top:1px solid #DDE9E6;font-size:11px;line-height:1.55}
      @media(max-width:720px){.module-footer-inner{grid-template-columns:1fr}.module-footer-nav{justify-content:flex-start}.module-footer-note{grid-column:auto}.module-footer{padding-top:24px!important}}
    `;
    document.head.appendChild(fs);
  }
  tick();setInterval(tick,1000);
})();
