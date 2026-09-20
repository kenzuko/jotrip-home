const DATA=["../data/entities/places.json","../data/entities/activities.json"];
const PLANNING="../data/views/place-planning-levels.json";
const $=s=>document.querySelector(s);
const readableStyle=document.createElement("style");readableStyle.textContent='.planning-level{display:inline-flex;margin-top:7px;padding:5px 8px;border-radius:999px;background:#eef6f4;color:#315f5b;font-size:11px;font-weight:850}.level-1{background:#fff0e8!important;color:#9a452f!important}.level-2{background:#e8f5fb!important;color:#17638f!important}.level-3{background:#eef6f4!important;color:#315f5b!important}.place-card .region,.place-card dt,.place-tags span,.price-dynamic{font-size:11px}.place-card dd{font-size:14px;line-height:1.55}.place-card h3{font-size:19px}.place-detail-link{display:inline-flex;margin-top:14px;font-size:14px;font-weight:850;color:var(--ink)}@media(max-width:720px){.place-card{padding:18px 15px}.place-card dl{gap:13px}.place-card dl div{grid-template-columns:104px 1fr}.toolbar{grid-template-columns:1fr}.toolbar input,.toolbar select{grid-column:1;width:100%;min-height:44px;font-size:14px}}';document.head.appendChild(readableStyle);
const initialQ=new URLSearchParams(location.search).get("q")||"";
const state={entities:[],levels:[],planning:new Map(),q:initialQ,region:"all",level:"all",type:"all"};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();

const zoneLabel={
  zone_north:"Bắc đảo",
  zone_central_west:"Trung tâm & bờ Tây",
  zone_south:"Nam đảo"
};

function view(x){
  const planning=state.planning.get(x.id)||{};
  return {
    ...x,
    region:zoneLabel[x.zone_id]||x.area_code||"Toàn đảo",
    type:x.categories||x.intents||[],
    what:x.what_it_is||"",
    play:x.why_go?[x.why_go]:[],
    price_ref:x.price_reference||null,
    price_dynamic:!!x.live_check_required,
    hashtags:[...(x.categories||[]),...(x.intents||[])].slice(0,8).map(v=>"#"+String(v).replace(/\s+/g,"-")),
    planning_level:planning.level||null,
    planning_label:state.levels.find(l=>l.id===planning.level)?.label||"",
    strengths:planning.strengths||[],
    watch_outs:planning.watch_outs||[]
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
      (state.level==="all"||String(x.planning_level)===state.level)&&
      (state.type==="all"||(x.type||[]).includes(state.type));
  }).map(view);
}

function tableRow(x){
  return '<tr><td><a class="place-name-link" href="detail.html?id='+encodeURIComponent(x.slug||x.id)+'"><strong>'+esc(x.name)+'</strong></a><div class="place-tags">'+
    (x.planning_label?'<span class="level level-'+x.planning_level+'">CẤP '+x.planning_level+' · '+esc(x.planning_label)+'</span>':'')+
    (x.hashtags||[]).slice(0,4).map(t=>'<span>'+esc(t)+'</span>').join("")+
    '</div></td><td>'+esc(x.region)+'</td><td>'+esc(x.what)+'</td><td>'+
    esc((x.play||[]).join(" · "))+'</td><td><strong>'+esc(x.price_ref||"Cần kiểm tra")+'</strong>'+
    (x.price_dynamic?'<span class="price-dynamic">DỮ LIỆU ĐỘNG · KIỂM TRA LẠI</span>':'')+
    '</td><td><strong>'+esc(x.duration||"-")+'</strong><small>'+esc(x.best_time||"")+
    '</small></td><td><ul class="tips-list">'+(x.tips||[]).map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></td></tr>';
}

function card(x){
  return '<article class="place-card"><div class="place-card-head"><div><span class="region">'+esc(x.region)+
    '</span><h3>'+esc(x.name)+'</h3>'+(x.planning_label?'<span class="planning-level level-'+x.planning_level+'">Cấp '+x.planning_level+' · '+esc(x.planning_label)+'</span>':'')+'</div>'+(x.price_dynamic?'<span class="pill watch">Cần kiểm tra trước khi đi</span>':'')+
    '</div><dl><div><dt>LÀ GÌ</dt><dd>'+esc(x.what)+'</dd></div><div><dt>VÌ SAO ĐI</dt><dd>'+esc((x.play||[]).join(" · "))+ 
    '</dd></div><div><dt>GIÁ</dt><dd>'+esc(x.price_ref||"-")+'</dd></div><div><dt>THỜI LƯỢNG</dt><dd>'+
    esc(x.duration||"-")+' · '+esc(x.best_time||"")+'</dd></div><div><dt>TIPS</dt><dd>'+esc((x.tips||[]).join(" · "))+
    '</dd></div>'+(x.strengths.length?'<div><dt>ĐIỂM HAY</dt><dd>'+esc(x.strengths.join(" · "))+'</dd></div>':'')+(x.watch_outs.length?'<div><dt>CẦN CÂN NHẮC</dt><dd>'+esc(x.watch_outs.join(" · "))+'</dd></div>':'')+'</dl><div class="place-tags">'+(x.hashtags||[]).map(t=>'<span>'+esc(t)+'</span>').join("")+'</div><a class="place-detail-link" href="detail.html?id='+encodeURIComponent(x.slug||x.id)+'">Xem chi tiết →</a></article>';
}

function render(){
  const a=filtered();
  $("#resultMeta").textContent=a.length+" / "+state.entities.length+" địa điểm & trải nghiệm";
  $("#placeRows").innerHTML=a.length?a.map(tableRow).join(""):'<tr><td colspan="7" class="empty">Không có mục phù hợp.</td></tr>';
  $("#placeCards").innerHTML=a.length?a.map(card).join(""):'<div class="empty">Không có mục phù hợp.</div>';
}

async function load(){
  const [payloads,planning]=await Promise.all([Promise.all(DATA.map(url=>fetch(url+"?t="+Date.now(),{cache:"no-store"}).then(r=>{
    if(!r.ok)throw new Error(url+" "+r.status);
    return r.json();
  }))),fetch(PLANNING+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.json())]);
  state.levels=planning.levels||[];
  state.planning=new Map((planning.items||[]).map(x=>[x.entity_id,x]));
  state.entities=payloads.flatMap(d=>d.entities||[]);
  if($("#placeSearch"))$("#placeSearch").value=state.q;

  const views=state.entities.map(view);
  const regions=[...new Set(views.map(x=>x.region))].sort((a,b)=>a.localeCompare(b,"vi"));
  const types=[...new Set(views.flatMap(x=>x.type||[]))].sort();

  $("#regionFilter").innerHTML='<option value="all">Tất cả khu vực</option>'+regions.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
  $("#levelFilter").innerHTML='<option value="all">Tất cả vai trò chuyến đi</option>'+state.levels.map(x=>'<option value="'+x.id+'">Cấp '+x.id+' · '+esc(x.label)+'</option>').join("");
  $("#typeFilter").innerHTML='<option value="all">Tất cả loại trải nghiệm</option>'+types.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
  $("#placeCount").textContent=state.entities.length;
  $("#regionCount").textContent=regions.length;
  render();
}

$("#placeSearch").oninput=e=>{state.q=e.target.value;render()};
$("#regionFilter").onchange=e=>{state.region=e.target.value;render()};
$("#levelFilter").onchange=e=>{state.level=e.target.value;render()};
$("#typeFilter").onchange=e=>{state.type=e.target.value;render()};
load().catch(error=>{
  console.warn(error);
  $("#placeRows").innerHTML='<tr><td colspan="7" class="empty">Không tải được dữ liệu địa điểm & trải nghiệm.</td></tr>';
});
