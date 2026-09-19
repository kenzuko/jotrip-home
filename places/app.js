const DATA=["../data/entities/places.json","../data/entities/activities.json"];
const $=s=>document.querySelector(s);
const initialQ=new URLSearchParams(location.search).get("q")||"";
const state={entities:[],q:initialQ,region:"all",type:"all"};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();

const zoneLabel={
  zone_north:"Bắc đảo",
  zone_central_west:"Trung tâm & bờ Tây",
  zone_south:"Nam đảo"
};

function view(x){
  return {
    ...x,
    region:zoneLabel[x.zone_id]||x.area_code||"Toàn đảo",
    type:x.categories||x.intents||[],
    what:x.what_it_is||"",
    play:x.why_go?[x.why_go]:[],
    price_ref:x.price_reference||null,
    price_dynamic:!!x.live_check_required,
    hashtags:[...(x.categories||[]),...(x.intents||[])].slice(0,8).map(v=>"#"+String(v).replace(/\s+/g,"-"))
  };
}

function filtered(){
  return state.entities.filter(raw=>{
    const x=view(raw);
    const hay=fold([
      x.name,x.region,x.what,x.why_go,
      (x.type||[]).join(" "),(x.tips||[]).join(" "),
      (x.aliases||[]).join(" "),(x.intents||[]).join(" ")
    ].join(" "));
    return(!state.q||hay.includes(fold(state.q)))&&
      (state.region==="all"||x.region===state.region)&&
      (state.type==="all"||(x.type||[]).includes(state.type));
  }).map(view);
}

function tableRow(x){
  return '<tr><td><a class="place-name-link" href="detail.html?id='+encodeURIComponent(x.slug||x.id)+'"><strong>'+esc(x.name)+'</strong></a><div class="place-tags">'+
    (x.hashtags||[]).slice(0,4).map(t=>'<span>'+esc(t)+'</span>').join("")+
    '</div></td><td>'+esc(x.region)+'</td><td>'+esc(x.what)+'</td><td>'+
    esc((x.play||[]).join(" · "))+'</td><td><strong>'+esc(x.price_ref||"Cần kiểm tra")+'</strong>'+
    (x.price_dynamic?'<span class="price-dynamic">DỮ LIỆU ĐỘNG · KIỂM TRA LẠI</span>':'')+
    '</td><td><strong>'+esc(x.duration||"-")+'</strong><small>'+esc(x.best_time||"")+
    '</small></td><td><ul class="tips-list">'+(x.tips||[]).map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></td></tr>';
}

function card(x){
  return '<article class="place-card"><div class="place-card-head"><div><span class="region">'+esc(x.region)+
    '</span><h3>'+esc(x.name)+'</h3></div>'+(x.price_dynamic?'<span class="pill watch">Cần kiểm tra live</span>':'')+
    '</div><dl><div><dt>LÀ GÌ</dt><dd>'+esc(x.what)+'</dd></div><div><dt>VÌ SAO ĐI</dt><dd>'+esc((x.play||[]).join(" · "))+ 
    '</dd></div><div><dt>GIÁ</dt><dd>'+esc(x.price_ref||"-")+'</dd></div><div><dt>THỜI LƯỢNG</dt><dd>'+
    esc(x.duration||"-")+' · '+esc(x.best_time||"")+'</dd></div><div><dt>TIPS</dt><dd>'+esc((x.tips||[]).join(" · "))+
    '</dd></div></dl><div class="place-tags">'+(x.hashtags||[]).map(t=>'<span>'+esc(t)+'</span>').join("")+'</div><a class="place-detail-link" href="detail.html?id='+encodeURIComponent(x.slug||x.id)+'">Xem chi tiết →</a></article>';
}

function render(){
  const a=filtered();
  $("#resultMeta").textContent=a.length+" / "+state.entities.length+" địa điểm & trải nghiệm";
  $("#placeRows").innerHTML=a.length?a.map(tableRow).join(""):'<tr><td colspan="7" class="empty">Không có mục phù hợp.</td></tr>';
  $("#placeCards").innerHTML=a.length?a.map(card).join(""):'<div class="empty">Không có mục phù hợp.</div>';
}

async function load(){
  const payloads=await Promise.all(DATA.map(url=>fetch(url+"?t="+Date.now(),{cache:"no-store"}).then(r=>{
    if(!r.ok)throw new Error(url+" "+r.status);
    return r.json();
  })));
  state.entities=payloads.flatMap(d=>d.entities||[]);
  if($("#placeSearch"))$("#placeSearch").value=state.q;

  const views=state.entities.map(view);
  const regions=[...new Set(views.map(x=>x.region))].sort((a,b)=>a.localeCompare(b,"vi"));
  const types=[...new Set(views.flatMap(x=>x.type||[]))].sort();

  $("#regionFilter").innerHTML='<option value="all">Tất cả khu vực</option>'+regions.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
  $("#typeFilter").innerHTML='<option value="all">Tất cả loại trải nghiệm</option>'+types.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
  $("#placeCount").textContent=state.entities.length;
  $("#regionCount").textContent=regions.length;
  render();
}

$("#placeSearch").oninput=e=>{state.q=e.target.value;render()};
$("#regionFilter").onchange=e=>{state.region=e.target.value;render()};
$("#typeFilter").onchange=e=>{state.type=e.target.value;render()};
load().catch(error=>{
  console.warn(error);
  $("#placeRows").innerHTML='<tr><td colspan="7" class="empty">Không tải được dữ liệu địa điểm & trải nghiệm.</td></tr>';
});
