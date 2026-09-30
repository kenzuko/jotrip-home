const DATA=["../data/entities/places.json","../data/entities/activities.json"];
const PLANNING="../data/views/place-planning-levels.json";
const VISUALS="../data/visual-context.json";
const $=s=>document.querySelector(s);
const initialQ=new URLSearchParams(location.search).get("q")||"";
const state={entities:[],levels:[],planning:new Map(),visuals:{},q:initialQ,region:"all",level:"all",type:"all"};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();

const zoneLabel={
  zone_north:"Bắc đảo",
  zone_central_west:"Trung tâm & bờ Tây",
  zone_south:"Nam đảo"
};

const areaLabels={
  north:"Bắc đảo",
  "north-west":"Tây Bắc đảo",
  "center-west":"Trung tâm & bờ Tây",
  west:"Bờ Tây",
  east:"Đông đảo",
  "forest-east":"Rừng phía Đông",
  south:"Nam đảo",
  "south-an-thoi":"An Thới",
  "south-east":"Đông Nam đảo",
  "south-hon-thom":"Hòn Thơm",
  "south-sea":"Vùng biển An Thới",
  sea:"Trên biển",
  "island-wide":"Toàn đảo"
};

const labels={
  agriculture:"Nông trại",architecture:"Kiến trúc",beach:"Bãi biển","cable-car":"Cáp treo",
  craft:"Nghề truyền thống",culture:"Văn hóa",diving:"Lặn biển",entertainment:"Vui chơi giải trí",
  evening:"Trải nghiệm buổi tối",family:"Dành cho gia đình",fishing:"Câu cá",food:"Ẩm thực",
  history:"Lịch sử",indoor:"Trong nhà","local-life":"Đời sống địa phương",lore:"Truyền thuyết",
  marine:"Biển đảo",market:"Chợ",multimedia:"Trình diễn đa phương tiện",museum:"Bảo tàng",
  nature:"Thiên nhiên",outdoor:"Ngoài trời",resort:"Khu nghỉ dưỡng",river:"Sông",seafood:"Hải sản",
  show:"Biểu diễn",snorkeling:"Lặn ngắm san hô",stream:"Suối",sunset:"Hoàng hôn",
  "theme-park":"Công viên chủ đề",thrill:"Trò chơi cảm giác mạnh",underwater:"Trải nghiệm dưới nước",
  viewpoint:"Điểm ngắm cảnh",village:"Làng quê",waterpark:"Công viên nước",wildlife:"Động vật hoang dã",
  couple:"Cặp đôi",fireworks:"Pháo hoa",practical:"Thông tin hữu ích","sunset-town":"Sunset Town",
  "first-time":"Lần đầu đến Phú Quốc"
};

function friendly(value){
  const raw=String(value??"");
  return labels[raw.toLowerCase()]||raw.replaceAll("-"," ");
}
function areaName(x){
  return zoneLabel[x.zone_id]||areaLabels[x.area_code]||"Toàn đảo";
}

function visualFor(x){
  const images=state.visuals?.places?.[x.id]?.images||[];
  return window.OpenPQVisual?.pickHero?.(images)||images.find(v=>v?.url&&v.hero_eligible!==false)||null;
}
function zoneInitial(x){
  const label=areaName(x);
  return '<div class="place-zone-visual" data-zone="'+esc(x.zone_id||"all")+'"><span>⌖</span><strong>'+esc(label)+'</strong><small>Bối cảnh khu vực</small></div>';
}
function mediaFor(x,compact=false){
  const v=visualFor(x);
  if(v){
    return '<figure class="place-thumb '+(compact?"compact":"")+'"><img src="'+esc(v.url)+'" alt="'+esc(v.alt||x.name)+'" loading="lazy" decoding="async"><figcaption>'+esc(v.caption||"")+'</figcaption></figure>';
  }
  return zoneInitial(x);
}

function view(x){
  const planning=state.planning.get(x.id)||{};
  return {
    ...x,
    region:areaName(x),
    type:x.categories||x.intents||[],
    what:x.what_it_is||"",
    play:x.why_go?[x.why_go]:[],
    price_ref:x.price_reference||null,
    price_dynamic:!!x.live_check_required,
    hashtags:[...(x.categories||[]),...(x.intents||[])].slice(0,8).map(friendly),
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
      (x.type||[]).join(" "),(x.type||[]).map(friendly).join(" "),(x.tips||[]).join(" "),
      (x.aliases||[]).join(" "),(x.intents||[]).join(" ")
    ].join(" "));
    return(!state.q||hay.includes(fold(state.q)))&&
      (state.region==="all"||x.region===state.region)&&
      (state.level==="all"||String(x.planning_level)===state.level)&&
      (state.type==="all"||(x.type||[]).includes(state.type));
  }).map(view);
}

function card(x){
  const url="detail.html?id="+encodeURIComponent(x.slug||x.id);
  const extra=[
    (x.play||[]).length?'<section><b>Trải nghiệm</b><p>'+esc(x.play.join(" · "))+'</p></section>':"",
    (x.tips||[]).length?'<section><b>Nhớ trước khi đi</b><ul>'+x.tips.map(t=>'<li>'+esc(t)+'</li>').join("")+'</ul></section>':"",
    (x.strengths||[]).length?'<section><b>Phù hợp khi</b><p>'+esc(x.strengths.join(" · "))+'</p></section>':"",
    (x.watch_outs||[]).length?'<section><b>Cần cân nhắc</b><p>'+esc(x.watch_outs.join(" · "))+'</p></section>':""
  ].filter(Boolean).join("");
  return '<article class="place-card">'+
    '<div class="place-card-top"><a class="place-card-media" href="'+url+'" aria-label="Xem chi tiết '+esc(x.name)+'">'+mediaFor(x,true)+'</a>'+
    '<div class="place-card-main"><div class="place-card-kicker"><span>'+esc(x.region)+'</span>'+
    (x.planning_label?'<span class="planning-level level-'+esc(x.planning_level)+'">'+esc(x.planning_label)+'</span>':'')+
    '</div><h3><a class="place-name-link" href="'+url+'">'+esc(x.name)+'</a></h3>'+
    '<p class="place-card-description">'+esc(x.what||((x.play||[])[0])||"Xem thông tin chi tiết")+'</p></div></div>'+
    '<div class="place-quick-facts"><div class="place-fact"><span>Thời lượng</span><strong>'+esc(x.duration||"Chưa rõ")+'</strong>'+
    (x.best_time?'<small>'+esc(x.best_time)+'</small>':'')+'</div>'+
    '<div class="place-fact place-fact-price"><span>Giá tham khảo</span><strong>'+esc(x.price_ref||"Cần kiểm tra")+'</strong>'+
    (x.price_dynamic?'<small class="place-price-dynamic">Giá có thể thay đổi</small>':'')+'</div></div>'+
    (extra?'<details class="place-more"><summary>Trải nghiệm & lưu ý</summary><div class="place-more-content">'+extra+'</div></details>':'')+
    '<div class="place-card-footer"><div class="place-tags">'+(x.hashtags||[]).slice(0,3).map(t=>'<span>'+esc(t)+'</span>').join("")+
    '</div><a class="place-detail-link" href="'+url+'">Xem chi tiết →</a></div></article>';
}

function render(){
  const a=filtered();
  $("#resultMeta").textContent=a.length+" / "+state.entities.length+" địa điểm & trải nghiệm";
  $("#placeCards").innerHTML=a.length?a.map(card).join(""):'<div class="empty">Không có mục phù hợp.</div>';
}

async function load(){
  const [payloads,planning,visuals]=await Promise.all([Promise.all(DATA.map(url=>fetch(url,{cache:"default"}).then(r=>{
    if(!r.ok)throw new Error(url+" "+r.status);
    return r.json();
  }))),fetch(PLANNING,{cache:"default"}).then(r=>r.json()),fetch(VISUALS,{cache:"default"}).then(r=>r.ok?r.json():{}).catch(()=>({}))]);
  state.levels=planning.levels||[];
  state.visuals=visuals||{};
  state.planning=new Map((planning.items||[]).map(x=>[x.entity_id,x]));
  state.entities=payloads.flatMap(d=>d.entities||[]);
  if($("#placeSearch"))$("#placeSearch").value=state.q;

  const views=state.entities.map(view);
  const regions=[...new Set(views.map(x=>x.region))].sort((a,b)=>a.localeCompare(b,"vi"));
  const types=[...new Set(views.flatMap(x=>x.type||[]))].sort((a,b)=>friendly(a).localeCompare(friendly(b),"vi"));

  $("#regionFilter").innerHTML='<option value="all">Tất cả khu vực</option>'+regions.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
  $("#levelFilter").innerHTML='<option value="all">Tất cả kiểu ghé</option>'+state.levels.map(x=>'<option value="'+x.id+'">'+esc(x.label)+'</option>').join("");
  $("#typeFilter").innerHTML='<option value="all">Tất cả loại trải nghiệm</option>'+types.map(x=>'<option value="'+esc(x)+'">'+esc(friendly(x))+'</option>').join("");
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
  $("#placeCards").innerHTML='<div class="empty">Chưa mở được danh sách địa điểm & trải nghiệm.</div>';
});
