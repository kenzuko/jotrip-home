const CONTENT_LOCALE=(document.documentElement.lang||"vi").split("-")[0]||"vi";
const DATA="../data/i18n/"+CONTENT_LOCALE+"/food.json";
const DATA_FALLBACK="../data/food.json";
const VISUALS="../data/visual-context.json";
const UI="../data/i18n/"+CONTENT_LOCALE+"/ui.json";
const UI_FALLBACK="../data/i18n/vi/ui.json";
const $=s=>document.querySelector(s);
const all=s=>[...document.querySelectorAll(s)];
const state={data:null,visuals:{},ui:{},cat:"all",meal:"all",q:"",randomDishes:[]};
const copy=(path,fallback)=>path.split(".").reduce((o,k)=>o?.[k],state.ui)||fallback;

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();

function filtered(){
  return (state.data?.dishes||[]).filter(x=>
    (state.cat==="all"||x.category===state.cat)&&
    (state.meal==="all"||(x.meal_times||[]).includes(state.meal))&&
    (!state.q||fold([
      x.name,x.intro,x.origin,x.why_name,
      (x.ingredients||[]).join(" "),
      (x.tips||[]).join(" ")
    ].join(" ")).includes(fold(state.q)))
  );
}

function dishMedia(x){
  const images=state.visuals?.food?.[x.id]?.images||[];
  const visual=window.OpenPQVisual?.pickHero?.(images)||images[0]||null;
  if(visual){
    return '<div class="dish-media">'+
      '<img src="'+esc(visual.url)+'" alt="'+esc(visual.alt||x.name)+'" loading="lazy" decoding="async" data-fallback="'+esc(visual.fallback_url||"")+'" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;delete this.dataset.fallback}else{this.closest(\'div\').classList.add(\'is-error\')}">'+
    '</div>';
  }
  return window.OpenPQVisual
    ? OpenPQVisual.placeholder(x.name,"Ảnh riêng của món đang được bổ sung")
    : "";
}

function renderGrid(){
  const host=$("#foodGrid");
  if(!host)return;
  const rows=filtered();
  renderRandomDish();
  host.innerHTML=rows.length?rows.map(x=>
    '<a class="dish-card" href="article.html?id='+encodeURIComponent(x.id)+'">'+
      dishMedia(x)+
      '<div class="dish-card-copy">'+
        '<span>'+(x.category==="seafood"?copy("food.seafood","HẢI SẢN"):copy("food.local","MÓN ĐỊA PHƯƠNG"))+'</span>'+
        '<h2>'+esc(x.name)+'</h2>'+
        '<p>'+esc(x.intro)+'</p>'+
        '<div class="dish-foot"><small>'+esc((x.hashtags||[]).slice(0,2).join(" · "))+'</small><b>→</b></div>'+
      '</div>'+
    '</a>'
  ).join(""):'<div class="empty">Không có món phù hợp.</div>';
}


function renderRandomDish(){
  const host=$("#randomDishResult"),rows=state.randomDishes;
  if(!host)return;
  if(!rows.length){
    host.innerHTML='<p class="random-dish-empty">Chọn bữa bạn muốn ăn, tớ gợi ý ba món để lựa.</p>';
    return;
  }
  const meals={breakfast:"Ăn sáng",lunch:"Ăn trưa",dinner:"Ăn tối",snack:"Ăn chơi",dessert:"Món ngọt"};
  host.innerHTML='<div class="random-dish-picks">'+rows.map(dish=>{
    const time=(dish.meal_times||[]).map(x=>meals[x]).filter(Boolean).slice(0,2).join(" · ");
    return '<div class="random-dish-pick"><span>'+esc(time||"Gợi ý hôm nay")+'</span><strong>'+esc(dish.name)+'</strong><p>'+esc(dish.intro)+'</p><a href="article.html?id='+encodeURIComponent(dish.id)+'">Xem món này →</a></div>';
  }).join("")+'</div>';
}

function pickRandomDish(){
  const rows=filtered();
  if(!rows.length){state.randomDishes=[];renderRandomDish();return;}
  const prior=new Set(state.randomDishes.map(x=>x.id));
  let pool=rows.filter(x=>!prior.has(x.id));
  const count=Math.min(3,rows.length);
  if(pool.length<count)pool=[...rows];
  pool=[...pool];
  for(let i=pool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  state.randomDishes=pool.slice(0,count);
  renderRandomDish();
}

function allergenBlock(dish){
  const flags=Array.isArray(dish.allergen_flags)?dish.allergen_flags:[];
  if(!flags.length&&!dish.allergy_note)return "";
  return '<section class="food-safety">'+
    '<div class="food-section-label">'+esc(copy("food.allergy","DỊ ỨNG & THÀNH PHẦN CẦN HỎI"))+'</div>'+
    '<h2>'+esc(copy("food.allergy_title","Đọc phần này trước khi gọi món."))+'</h2>'+
    (flags.length?'<div class="allergen-chips">'+flags.map(x=>
      '<span data-level="'+esc(x.level||"possible")+'">'+esc(x.label)+'</span>'
    ).join("")+'</div>':"")+
    (dish.allergy_note?'<p>'+esc(dish.allergy_note)+'</p>':"")+
    ((dish.ask_staff||[]).length?'<div class="ask-staff"><strong>'+esc(copy("food.ask_staff","Nếu cần hỏi quán"))+'</strong><ul>'+
      dish.ask_staff.map(x=>'<li>'+esc(x)+'</li>').join("")+
    '</ul></div>':"")+
  '</section>';
}

function ingredientsBlock(dish){
  const rows=Array.isArray(dish.ingredients)?dish.ingredients:[];
  if(!rows.length)return "";
  return '<section class="ingredient-panel">'+
    '<div class="food-section-label">'+esc(copy("food.ingredients","TRONG MÓN CÓ GÌ?"))+'</div>'+
    '<h2>'+esc(copy("food.ingredients_title","Nguyên liệu thường gặp."))+'</h2>'+
    '<div class="ingredient-grid">'+rows.map((x,i)=>
      '<div><span>'+String(i+1).padStart(2,"0")+'</span><strong>'+esc(x)+'</strong></div>'
    ).join("")+'</div>'+
    '<small>Công thức có thể thay đổi theo quán. Nếu dị ứng hoặc kiêng ăn, hãy hỏi thành phần thực tế tại nơi bạn gọi món.</small>'+
  '</section>';
}

function sourcesBlock(){
  return "";
}

function renderArticle(){
  const host=$("#foodArticle");
  if(!host)return;
  const id=new URLSearchParams(location.search).get("id");
  const dish=state.data.dishes.find(x=>x.id===(id==="chao-ca"?"chao-cha":id))||state.data.dishes[0];
  if(!dish)return;

  document.title=dish.name+" - Open Phu Quoc";

  const visual=state.visuals?.food?.[dish.id]||{};
  const images=visual.images||[];
  const gallery=window.OpenPQVisual&&images.length
    ? OpenPQVisual.gallery(images,{eyebrow:copy("food.images_eyebrow","NHÌN MÓN"),title:copy("food.images_title","Nhìn món trước khi gọi")})
    : "";

  const visualFacts=window.OpenPQVisual?OpenPQVisual.quickFacts([
    [copy("food.quick_group","Nhóm"),dish.category==="seafood"?copy("food.seafood","HẢI SẢN"):copy("food.local","MÓN ĐỊA PHƯƠNG")],
    [copy("food.quick_taste","Vị & kết cấu"),dish.taste_texture||dish.intro],
    [copy("food.quick_order","Khi gọi món"),dish.allergen_flags?.length?copy("food.allergy_check","Nên xem thành phần & dị ứng"):copy("food.ask_preparation","Hỏi cách chế biến")]
  ],{label:"Hiểu nhanh món ăn"}):"";

  const infographic=window.OpenPQVisual?OpenPQVisual.infographic([
    {icon:"01",label:copy("food.origin","NGUỒN GỐC"),value:copy("food.origin_value","Món đến từ đâu?"),note:dish.origin||""},
    {icon:"02",label:copy("food.name","TÊN GỌI"),value:copy("food.name_value","Vì sao gọi như vậy?"),note:dish.why_name||""},
    {icon:"03",label:copy("food.eat","CÁCH ĂN"),value:copy("food.eat_value","Ăn sao cho đúng nhịp?"),note:dish.how_to_eat||""}
  ],{eyebrow:copy("food.explainer_eyebrow","HIỂU MÓN"),title:copy("food.explainer_title","Ba chuyện đáng biết trước khi ăn")}):"";

  host.innerHTML=
    '<div class="crumb">ĂN PHÚ QUỐC · '+esc(dish.category==="seafood"?copy("food.seafood","HẢI SẢN"):copy("food.local","MÓN ĐỊA PHƯƠNG"))+'</div>'+
    '<h1>'+esc(dish.name)+'</h1>'+
    '<p class="lead">'+esc(dish.intro)+'</p>'+
    gallery+
    visualFacts+
    infographic+
    ingredientsBlock(dish)+
    (dish.taste_texture?'<section><div class="food-section-label">'+esc(copy("food.taste","VỊ & KẾT CẤU"))+'</div><h2>'+esc(copy("food.taste_title","Ăn vào sẽ cảm thấy gì?"))+'</h2><p>'+esc(dish.taste_texture)+'</p></section>':"")+
    allergenBlock(dish)+
    '<section><div class="food-section-label">'+esc(copy("food.how_to_eat","CÁCH ĂN"))+'</div><h2>'+esc(copy("food.how_to_eat_title","Ăn sao cho ngon?"))+'</h2><p>'+esc(dish.how_to_eat||"Ăn lúc món còn ngon nhất và nêm theo khẩu vị của mình.")+'</p></section>'+
    '<section><div class="food-section-label">'+esc(copy("food.practical","LƯU Ý THỰC TẾ"))+'</div><h2>'+esc(copy("food.practical_title","Nhớ mấy chuyện này."))+'</h2><ul>'+
      (dish.tips||[]).map(x=>'<li>'+esc(x)+'</li>').join("")+
    '</ul></section>'+
    sourcesBlock(dish)+
    '<div class="food-hashtags">'+(dish.hashtags||[]).map(x=>'<span>'+esc(x)+'</span>').join("")+'</div>';

  const others=state.data.dishes.filter(x=>x.id!==dish.id);
  $("#moreDishes").innerHTML='<h3>'+esc(copy("food.more","Ăn tiếp món gì?"))+'</h3><div class="more-dish-links">'+
    others.map(x=>'<a href="article.html?id='+encodeURIComponent(x.id)+'">'+esc(x.name)+' →</a>').join("")+
    '</div>';
}

async function load(){
  const [r,v,u]=await Promise.all([
    fetch(DATA+"?t="+Date.now(),{cache:"no-store"}).then(async res=>{
      if(res.ok)return res;
      return fetch(DATA_FALLBACK+"?t="+Date.now(),{cache:"no-store"});
    }),
    fetch(VISUALS+"?t="+Date.now(),{cache:"no-store"}).catch(()=>null),
    fetch(UI+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():Promise.reject())
      .catch(()=>fetch(UI_FALLBACK+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{}).catch(()=>({})))
  ]);
  state.data=await r.json();
  state.visuals=v?.ok?await v.json():{};
  state.ui=u||{};
  if($("#dishCount"))$("#dishCount").textContent=state.data.dishes.length;
  const context=$("#foodVisualContext");
  if(context && window.OpenPQVisual){
    context.innerHTML=OpenPQVisual.gallery(state.visuals?.food_context?.seafood||[],{
      eyebrow:"ẢNH TƯ LIỆU JOTRIP · BỐI CẢNH CHUNG",
      title:"Hải sản trong bếp - ảnh không gắn với món cụ thể"
    });
  }
  renderGrid();
  pickRandomDish();
  renderArticle();
}

if($("#foodSearch"))$("#foodSearch").oninput=e=>{state.q=e.target.value;renderGrid()};
all("[data-cat]").forEach(b=>b.onclick=()=>{
  state.cat=b.dataset.cat;
  all("[data-cat]").forEach(x=>x.classList.toggle("active",x===b));
  renderGrid();
});
all("[data-meal]").forEach(b=>b.onclick=()=>{
  state.meal=b.dataset.meal;
  all("[data-meal]").forEach(x=>x.classList.toggle("active",x===b));
  state.randomDishes=[];
  renderGrid();
  pickRandomDish();
});
$("#randomDishButton")?.addEventListener("click",pickRandomDish);

load().catch(()=>{
  const h=$("#foodGrid")||$("#foodArticle");
  if(h)h.innerHTML='<div class="empty">Không tải được dữ liệu món ăn.</div>';
});
