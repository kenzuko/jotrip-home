const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
Promise.all([
  fetch("data.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()),
  fetch("../data/utilities.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json())
]).then(([d,u])=>{
  $("#sourceMeta").textContent=d.intro+" · Nguồn nền: "+d.version+".";
  $("#zoneRail").innerHTML=d.zones.map(z=>'<article class="zone-card reveal"><img src="'+esc(z.image)+'" alt="'+esc(z.name)+'"><div><span>'+esc(z.tag)+'</span><h3>'+esc(z.name)+'</h3><p>'+esc(z.summary)+'</p><small>'+esc(z.best_for)+'</small></div></article>').join("");
  const times=(u.travel_times||[]).filter(x=>!(x.from==="Bắc đảo"&&x.to==="Nam đảo"));
  const max=Math.max(...times.map(x=>x.max||0),1);
  $("#distanceBars").innerHTML=times.map(x=>'<div class="distance-row"><span>'+esc(x.from)+' → '+esc(x.to)+'</span><div class="distance-track"><div class="distance-fill" style="width:'+Math.max(8,(x.max/max*100))+'%"></div></div><b>'+x.min+'-'+x.max+''</b></div>').join("");
  $("#northRhythm").innerHTML=d.north_rhythm.map(x=>'<article class="rhythm-card reveal"><span>'+esc(x.type)+'</span><strong>'+esc(x.name)+'</strong><p>'+esc(x.note)+'</p></article>').join("");
  $("#hotelTiers").innerHTML=d.hotels.tiers.map(x=>'<article class="tier-card reveal"><strong>'+esc(x.name)+'</strong><p>'+esc(x.note)+'</p></article>').join("");
  $("#hotelAreas").innerHTML=d.hotels.areas.map(x=>'<article class="hotel-area reveal"><span>'+esc(x.name)+'</span><strong>'+esc(x.hotels)+'</strong><p>'+esc(x.note)+'</p></article>').join("");
  $("#foodGrid").innerHTML=d.food.map(x=>'<article class="food-card reveal"><span>'+esc(x.group)+'</span><strong>'+esc(x.items)+'</strong><p>'+esc(x.note)+'</p></article>').join("");
  $("#itineraryRail").innerHTML=d.itineraries.map(x=>'<article class="itinerary-card reveal"><h3>'+esc(x.name)+'</h3><ol>'+x.days.map(day=>'<li>'+esc(day)+'</li>').join("")+'</ol><p>'+esc(x.note)+'</p></article>').join("");
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");obs.unobserve(e.target)}}),{threshold:.12,rootMargin:"40px 0px -20px"});
  document.querySelectorAll(".reveal").forEach(el=>obs.observe(el));
}).catch(()=>{$("#sourceMeta").textContent="Chưa tải được cẩm nang lúc này.";});