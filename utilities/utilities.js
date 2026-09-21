const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const phoneHref=p=>"tel:"+String(p||"").replace(/[^0-9+]/g,"");
const localCard=x=>'<article class="u-card"><span class="badge '+(x.verified===false?'watch':'')+'">'+(x.verified===false?'CẦN KIỂM TRA':'ĐÃ ĐỐI CHIẾU')+'</span><strong>'+esc(x.label)+'</strong><a class="phone" href="'+phoneHref(x.phone)+'">'+esc(x.phone)+'</a>'+(x.phone_alt?'<a class="phone" style="font-size:16px;margin-left:9px" href="'+phoneHref(x.phone_alt)+'">'+esc(x.phone_alt)+'</a>':'')+'<small>'+esc(x.note)+'</small><a class="source" href="'+esc(x.source)+'" target="_blank" rel="noopener">Nguồn chính thức →</a></article>';
const emergency=x=>'<a class="emergency-card" href="'+phoneHref(x.phone)+'"><strong>'+esc(x.phone)+'</strong><span>'+esc(x.label)+'</span><small>'+esc(x.note)+'</small></a>';
const dirCard=x=>'<article class="u-card"><span class="badge '+(x.verified===false?'watch':'')+'">'+(x.verified===false?'CẦN KIỂM TRA':'ĐÃ ĐỐI CHIẾU')+'</span><strong>'+esc(x.label)+'</strong>'+(x.phone?'<a class="phone" href="'+phoneHref(x.phone)+'">'+esc(x.phone)+'</a>':'')+(x.phone_alt?'<a class="phone phone-alt" href="'+phoneHref(x.phone_alt)+'">'+esc(x.phone_alt)+'</a>':'')+'<small>'+esc(x.note)+'</small>'+((x.app_url||x.whatsapp||x.zalo)?'<div class="dir-contact-actions">'+(x.app_url?'<a href="'+esc(x.app_url)+'" target="_blank" rel="noopener">Mở ứng dụng / website ↗</a>':'')+(x.whatsapp?'<a href="'+esc(x.whatsapp)+'" target="_blank" rel="noopener">WhatsApp ↗</a>':'')+(x.zalo?'<a href="'+esc(x.zalo)+'" target="_blank" rel="noopener">Zalo ↗</a>':'')+'</div>':'')+'<a class="source" href="'+esc(x.source)+'" target="_blank" rel="noopener">Xem nguồn →</a></article>';
function renderDirectory(items){
  const groups={};
  (items||[]).forEach(x=>(groups[x.group]||(groups[x.group]=[])).push(x));
  $("#directoryGroups").innerHTML=Object.entries(groups).map(([g,rows])=>'<div class="dir-group"><h3>'+esc(g)+'</h3><div class="dir-grid">'+rows.map(dirCard).join("")+'</div></div>').join("");
}
function renderTravel(rows){
  $("#travelBars").innerHTML=(rows||[]).map(x=>
    '<article class="travel-line"><div><span>'+esc(x.from)+' → '+esc(x.to)+'</span><small>Thời gian tham khảo</small></div><strong>'+x.min+'-'+x.max+' phút</strong></article>'
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
  const stamp=d.generated_at?new Date(d.generated_at).toLocaleString("vi-VN"):"chưa rõ";
  $("#syncNote").textContent="Thông tin được kiểm tra gần nhất: "+stamp+". Các mục chưa xác nhận được đánh dấu rõ để bạn kiểm tra lại trước khi sử dụng.";
  const sections=[...document.querySelectorAll(".u-section")];
  const links=[...document.querySelectorAll(".u-menu a[href^='#']")];
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");links.forEach(a=>a.classList.toggle("active",a.getAttribute("href")==="#"+e.target.id));}}),{threshold:.16,rootMargin:"-95px 0px -45%"});
  sections.forEach(s=>obs.observe(s));
}).catch(()=>$("#syncNote").textContent="Chưa tải được dữ liệu tiện ích.");
