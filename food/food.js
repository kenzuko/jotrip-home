const CONTENT_LOCALE=(document.documentElement.lang||"vi").split("-")[0]||"vi";
const DATA="../data/i18n/"+CONTENT_LOCALE+"/food.json";
const DATA_FALLBACK="../data/food.json";
const VISUALS="../data/visual-context.json";
const $=s=>document.querySelector(s);
const all=s=>[...document.querySelectorAll(s)];
const state={data:null,visuals:{},cat:"all",q:""};

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();

function filtered(){
  return (state.data?.dishes||[]).filter(x=>
    (state.cat==="all"||x.category===state.cat)&&
    (!state.q||fold([
      x.name,x.intro,x.origin,x.why_name,
      (x.ingredients||[]).join(" "),
      (x.tips||[]).join(" ")
    ].join(" ")).includes(fold(state.q)))
  );
}

function dishMedia(x){
  const visual=state.visuals?.food?.[x.id]?.images?.[0];
  if(visual){
    return '<div class="dish-media">'+
      '<img src="'+esc(visual.url)+'" alt="'+esc(visual.alt||x.name)+'" loading="lazy" decoding="async">'+
      '<small>'+esc(visual.caption||"")+'</small>'+
    '</div>';
  }
  return window.OpenPQVisual
    ? OpenPQVisual.placeholder(x.name,x.category==="seafood"?"Hải sản":"Món địa phương")
    : "";
}

function renderGrid(){
  const host=$("#foodGrid");
  if(!host)return;
  const rows=filtered();
  host.innerHTML=rows.length?rows.map(x=>
    '<a class="dish-card" href="article.html?id='+encodeURIComponent(x.id)+'">'+
      dishMedia(x)+
      '<div class="dish-card-copy">'+
        '<span>'+(x.category==="seafood"?"HẢI SẢN":"MÓN ĐỊA PHƯƠNG")+'</span>'+
        '<h2>'+esc(x.name)+'</h2>'+
        '<p>'+esc(x.intro)+'</p>'+
        '<div class="dish-foot"><small>'+esc((x.hashtags||[]).slice(0,2).join(" · "))+'</small><b>→</b></div>'+
      '</div>'+
    '</a>'
  ).join(""):'<div class="empty">Không có món phù hợp.</div>';
}

function allergenBlock(dish){
  const flags=Array.isArray(dish.allergen_flags)?dish.allergen_flags:[];
  if(!flags.length&&!dish.allergy_note)return "";
  return '<section class="food-safety">'+
    '<div class="food-section-label">DỊ ỨNG & THÀNH PHẦN CẦN HỎI</div>'+
    '<h2>Đọc phần này trước khi gọi món.</h2>'+
    (flags.length?'<div class="allergen-chips">'+flags.map(x=>
      '<span data-level="'+esc(x.level||"possible")+'">'+esc(x.label)+'</span>'
    ).join("")+'</div>':"")+
    (dish.allergy_note?'<p>'+esc(dish.allergy_note)+'</p>':"")+
    ((dish.ask_staff||[]).length?'<div class="ask-staff"><strong>Nếu cần hỏi quán</strong><ul>'+
      dish.ask_staff.map(x=>'<li>'+esc(x)+'</li>').join("")+
    '</ul></div>':"")+
  '</section>';
}

function ingredientsBlock(dish){
  const rows=Array.isArray(dish.ingredients)?dish.ingredients:[];
  if(!rows.length)return "";
  return '<section class="ingredient-panel">'+
    '<div class="food-section-label">TRONG MÓN CÓ GÌ?</div>'+
    '<h2>Nguyên liệu thường gặp.</h2>'+
    '<div class="ingredient-grid">'+rows.map((x,i)=>
      '<div><span>'+String(i+1).padStart(2,"0")+'</span><strong>'+esc(x)+'</strong></div>'
    ).join("")+'</div>'+
    '<small>Công thức có thể thay đổi theo quán. Nếu dị ứng hoặc kiêng ăn, hãy hỏi thành phần thực tế tại nơi bạn gọi món.</small>'+
  '</section>';
}

function sourcesBlock(dish){
  const rows=Array.isArray(dish.sources)?dish.sources:[];
  if(!rows.length)return "";
  return '<section class="food-sources"><div class="food-section-label">NGUỒN THAM KHẢO</div>'+
    rows.map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.label)+' ↗</a>').join("")+
  '</section>';
}

function renderArticle(){
  const host=$("#foodArticle");
  if(!host)return;
  const id=new URLSearchParams(location.search).get("id");
  const dish=state.data.dishes.find(x=>x.id===id)||state.data.dishes[0];
  if(!dish)return;

  document.title=dish.name+" - Open Phu Quoc";

  const visual=state.visuals?.food?.[dish.id]||{};
  const images=visual.images||[];
  const gallery=window.OpenPQVisual&&images.length
    ? OpenPQVisual.gallery(images,{eyebrow:"NHÌN MÓN",title:"Nhìn món trước khi gọi"})
    : "";

  const visualFacts=window.OpenPQVisual?OpenPQVisual.quickFacts([
    ["Nhóm",dish.category==="seafood"?"Hải sản":"Món địa phương"],
    ["Vị & kết cấu",dish.taste_texture||dish.intro],
    ["Khi gọi món",dish.allergen_flags?.length?"Nên xem thành phần & dị ứng":"Hỏi cách chế biến"]
  ],{label:"Hiểu nhanh món ăn"}):"";

  const infographic=window.OpenPQVisual?OpenPQVisual.infographic([
    {icon:"01",label:"NGUỒN GỐC",value:"Món đến từ đâu?",note:dish.origin||""},
    {icon:"02",label:"TÊN GỌI",value:"Vì sao gọi như vậy?",note:dish.why_name||""},
    {icon:"03",label:"CÁCH ĂN",value:"Ăn sao cho đúng nhịp?",note:dish.how_to_eat||""}
  ],{eyebrow:"HIỂU MÓN",title:"Ba chuyện đáng biết trước khi ăn"}):"";

  host.innerHTML=
    '<div class="crumb">ĂN PHÚ QUỐC · '+esc(dish.category==="seafood"?"HẢI SẢN":"MÓN ĐỊA PHƯƠNG")+'</div>'+
    '<h1>'+esc(dish.name)+'</h1>'+
    '<p class="lead">'+esc(dish.intro)+'</p>'+
    gallery+
    visualFacts+
    infographic+
    ingredientsBlock(dish)+
    (dish.taste_texture?'<section><div class="food-section-label">VỊ & KẾT CẤU</div><h2>Ăn vào sẽ cảm thấy gì?</h2><p>'+esc(dish.taste_texture)+'</p></section>':"")+
    allergenBlock(dish)+
    '<section><div class="food-section-label">CÁCH ĂN</div><h2>Ăn sao cho ngon?</h2><p>'+esc(dish.how_to_eat||"Ăn lúc món còn ngon nhất và nêm theo khẩu vị của mình.")+'</p></section>'+
    '<section><div class="food-section-label">LƯU Ý THỰC TẾ</div><h2>Nhớ mấy chuyện này.</h2><ul>'+
      (dish.tips||[]).map(x=>'<li>'+esc(x)+'</li>').join("")+
    '</ul></section>'+
    sourcesBlock(dish)+
    '<div class="food-hashtags">'+(dish.hashtags||[]).map(x=>'<span>'+esc(x)+'</span>').join("")+'</div>';

  const others=state.data.dishes.filter(x=>x.id!==dish.id);
  $("#moreDishes").innerHTML='<h3>Ăn tiếp món gì?</h3><div class="more-dish-links">'+
    others.map(x=>'<a href="article.html?id='+encodeURIComponent(x.id)+'">'+esc(x.name)+' →</a>').join("")+
    '</div>';
}

async function load(){
  const [r,v]=await Promise.all([
    fetch(DATA+"?t="+Date.now(),{cache:"no-store"}).then(async res=>{
      if(res.ok)return res;
      return fetch(DATA_FALLBACK+"?t="+Date.now(),{cache:"no-store"});
    }),
    fetch(VISUALS+"?t="+Date.now(),{cache:"no-store"}).catch(()=>null)
  ]);
  state.data=await r.json();
  state.visuals=v?.ok?await v.json():{};
  if($("#dishCount"))$("#dishCount").textContent=state.data.dishes.length;
  const context=$("#foodVisualContext");
  if(context && window.OpenPQVisual){
    context.innerHTML=OpenPQVisual.gallery(state.visuals?.food_context?.seafood||[],{
      eyebrow:"TỪ BẾP & BÀN ĂN",
      title:"Nhìn nguyên liệu thật trước khi chọn món"
    });
  }
  renderGrid();
  renderArticle();
}

if($("#foodSearch"))$("#foodSearch").oninput=e=>{state.q=e.target.value;renderGrid()};
all("[data-cat]").forEach(b=>b.onclick=()=>{
  state.cat=b.dataset.cat;
  all("[data-cat]").forEach(x=>x.classList.toggle("active",x===b));
  renderGrid();
});

load().catch(()=>{
  const h=$("#foodGrid")||$("#foodArticle");
  if(h)h.innerHTML='<div class="empty">Không tải được dữ liệu món ăn.</div>';
});
