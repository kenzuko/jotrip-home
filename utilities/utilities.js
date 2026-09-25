const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const phoneHref=p=>"tel:"+String(p||"").replace(/[^0-9+]/g,"");
const localCard=x=>'<article class="u-card">'+(x.verified===false?'<span class="badge watch">NÊN GỌI TRƯỚC</span>':'')+'<strong>'+esc(x.label)+'</strong><a class="phone" href="'+phoneHref(x.phone)+'">'+esc(x.phone)+'</a>'+(x.phone_alt?'<a class="phone" style="font-size:16px;margin-left:9px" href="'+phoneHref(x.phone_alt)+'">'+esc(x.phone_alt)+'</a>':'')+'<small>'+esc(x.note)+'</small><small class="source-note">Thông tin theo đơn vị vận hành; gọi để xác nhận trước khi đi.</small></article>';
const emergency=x=>'<a class="emergency-card" href="'+phoneHref(x.phone)+'"><strong>'+esc(x.phone)+'</strong><span>'+esc(x.label)+'</span><small>'+esc(x.note)+'</small></a>';
const dirCard=x=>'<article class="u-card">'+(x.verified===false?'<span class="badge watch">NÊN GỌI TRƯỚC</span>':'')+'<strong>'+esc(x.label)+'</strong>'+(x.phone?'<a class="phone" href="'+phoneHref(x.phone)+'">'+esc(x.phone)+'</a>':'')+(x.phone_alt?'<a class="phone phone-alt" href="'+phoneHref(x.phone_alt)+'">'+esc(x.phone_alt)+'</a>':'')+'<small>'+esc(x.note)+'</small>'+((x.app_url||x.whatsapp||x.zalo)?'<div class="dir-contact-actions">'+(x.app_url?'<a href="'+esc(x.app_url)+'" target="_blank" rel="noopener">Mở app / website ↗</a>':'')+(x.whatsapp?'<a href="'+esc(x.whatsapp)+'" target="_blank" rel="noopener">WhatsApp ↗</a>':'')+(x.zalo?'<a href="'+esc(x.zalo)+'" target="_blank" rel="noopener">Zalo ↗</a>':'')+'</div>':'')+'<small class="source-note">Thông tin theo đơn vị vận hành; kiểm tra lịch trước khi đi.</small></article>';
function renderDirectory(items){
  const groups={};
  (items||[]).forEach(x=>(groups[x.group]||(groups[x.group]=[])).push(x));
  $("#directoryGroups").innerHTML=Object.entries(groups).map(([g,rows])=>'<div class="dir-group"><h3>'+esc(g)+'</h3><div class="dir-grid">'+rows.map(dirCard).join("")+'</div></div>').join("");
}
function renderTravel(rows){
  $("#travelBars").innerHTML=(rows||[]).map(x=>
    '<article class="travel-line"><div><span>'+esc(x.from)+' → '+esc(x.to)+'</span><small>Đi thường mất khoảng</small></div><strong>'+x.min+'-'+x.max+' phút</strong></article>'
  ).join("");
}
function renderChoices(rows){$("#transportChoices").innerHTML=(rows||[]).map(x=>'<article class="choice"><span>'+esc(x.trip)+'</span><strong>'+esc(x.choice)+'</strong></article>').join("")}
function renderPrices(rows){$("#priceGrid").innerHTML=(rows||[]).map(x=>'<article class="price-card"><span>'+esc(x.place)+'</span><h3>'+esc(x.activity)+'</h3><strong>'+esc(x.price)+'</strong><small>'+esc(x.note)+'</small></article>').join("")}
function renderChecklist(rows){$("#checklistGrid").innerHTML=(rows||[]).map(x=>'<article class="check-card"><h3>'+esc(x.group)+'</h3><ul>'+x.items.map(i=>'<li>'+esc(i)+'</li>').join("")+'</ul></article>').join("")}
fetch("../data/utilities.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()).then(d=>{
  $("#national").innerHTML=(d.national_emergency||[]).map(emergency).join("");
  $("#local").innerHTML=(d.phu_quoc||[]).map(localCard).join("");
  renderDirectory(d.directory||[]);
  renderTravel(d.travel_times||[]);
  renderChoices(d.transport_choices||[]);
  renderPrices(d.ticket_reference||[]);
  renderChecklist(d.checklist||[]);
  const stamp=d.generated_at?new Date(d.generated_at).toLocaleString("vi-VN"):"chưa biết";
  $("#syncNote").textContent="Danh bạ được xem lại gần nhất lúc "+stamp+". Mục nào chưa chắc sẽ có ghi chú để bạn gọi hoặc xem lại trước.";
  const sections=[...document.querySelectorAll(".u-section")];
  const links=[...document.querySelectorAll(".u-menu a[href^='#']")];
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");links.forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+e.target.id));}}),{threshold:.16,rootMargin:"-95px 0px -45%"});
  sections.forEach(s=>obs.observe(s));
}).catch(()=>$("#syncNote").textContent="Chưa mở được danh bạ lúc này. Thử lại sau một chút nhé.");


// Same Vietcombank source as /currency/, shown here as a lightweight summary.
async function renderCurrencyPreview(){
  const grid=$("#currencyPreview"),stamp=$("#currencyUpdated");
  if(!grid||!stamp)return;
  let data,fromSnapshot=false;
  try{
    const response=await fetch("../api/exchange-rates",{cache:"no-store",headers:{accept:"application/json"}});
    if(!response.ok)throw new Error("Currency API: "+response.status);
    data=await response.json();
    if(!Array.isArray(data?.rates)||!data.rates.length)throw new Error("No FX rates");
  }catch(error){
    try{
      const response=await fetch("../data/currency-snapshot.json",{cache:"no-store"});
      if(!response.ok)throw new Error("FX snapshot: "+response.status);
      data=await response.json();fromSnapshot=true;
      if(!Array.isArray(data?.rates)||!data.rates.length)throw new Error("No FX snapshot rates");
    }catch(fallbackError){
      grid.innerHTML='<div class="u-fx-loading">Chưa lấy được tỷ giá. Bạn có thể mở trang Tỷ giá để thử lại.</div>';
      stamp.textContent="Chưa có dữ liệu mới";
      return;
    }
  }
  const numbers=new Intl.NumberFormat("vi-VN",{minimumFractionDigits:0,maximumFractionDigits:2});
  const valid=n=>n!==null&&n!==undefined&&n!==""&&Number.isFinite(Number(n));
  const specs=[["USD","Đô la Mỹ"],["EUR","Euro"],["KRW","Won Hàn Quốc"]];
  const rows=specs.map(([code,label])=>({code,label,rate:data.rates.find(x=>x.currency===code)})).filter(x=>x.rate);
  if(!rows.length){
    grid.innerHTML='<div class="u-fx-loading">Chưa có dữ liệu cho các đồng tiền phổ biến.</div>';
    stamp.textContent="Chưa có tỷ giá tham khảo";
    return;
  }
  grid.innerHTML=rows.map(({code,label,rate})=>{
    const hasCash=valid(rate.cash_buy);
    const buy=hasCash?rate.cash_buy:(valid(rate.transfer_buy)?rate.transfer_buy:null);
    const sell=valid(rate.sell)?rate.sell:null;
    const format=n=>valid(n)?numbers.format(Number(n))+" ₫":"Chưa có";
    return '<article class="u-fx-card">'+
      '<div class="u-fx-name"><span>'+esc(code)+'</span><strong>'+esc(label)+'</strong></div>'+
      '<div class="u-fx-values"><div><small>'+(hasCash?"Mua tiền mặt":"Mua chuyển khoản")+'</small><strong>'+format(buy)+'</strong></div>'+
      '<div><small>Bán ra</small><strong>'+format(sell)+'</strong></div></div>'+
      '</article>';
  }).join("");
  const raw=data.source_updated_at||data.fetched_at;
  const d=raw?new Date(raw):null;
  const time=d&&!Number.isNaN(d.getTime())?d.toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):null;
  const fresh=d&&Math.abs(Date.now()-d.getTime())<2*60*60*1000;
  stamp.textContent=(fromSnapshot||!fresh?"Bản gần nhất":"Cập nhật trực tiếp")+(time?" · "+time:"");
}
void renderCurrencyPreview();
