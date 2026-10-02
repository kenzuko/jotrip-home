const CONTENT_LOCALE=window.OpenPQI18n?.locale?.()||(document.documentElement.lang||"vi").split("-")[0]||"vi";
const DATA="/data/i18n/"+CONTENT_LOCALE+"/food.json";
const DATA_FALLBACK="/data/food.json";
const VISUALS="/data/visual-context.json";
const UI="/data/i18n/"+CONTENT_LOCALE+"/ui.json";
const UI_FALLBACK="/data/i18n/vi/ui.json";
const $=s=>document.querySelector(s);
const all=s=>[...document.querySelectorAll(s)];
const state={data:null,visuals:{},ui:{},cat:"all",meal:"all",q:"",randomDishes:[]};
const copy=(path,fallback)=>path.split(".").reduce((o,k)=>o?.[k],state.ui)||fallback;

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[m]));
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[đĐ]/g,"d").toLowerCase();

const DISH_IMAGE_FALLBACKS={
  "tom-tich-rang-muoi":[{
    url:"https://cdn.zsoft.solutions/poseidon-web/app/media/Nau-an/10.2022/241022-be-be-rang-muoi-buffet-poseidon-4.jpg",
    alt:"Tôm tích rang muối",
    scope:"exact_subject",
    source_label:"Internet · Buffet Poseidon",
    source_url:"https://buffetposeidon.com/default/huong-dan-lam-mon-be-be-rang-muoi-dam-da-hon-vi-bien",
    hero_priority:"preferred"
  }]
};

function dishImages(id){
  const images=state.visuals?.food?.[id]?.images||[];
  return images.length?images:(DISH_IMAGE_FALLBACKS[id]||[]);
}

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
  const images=dishImages(x.id);
  const visual=window.OpenPQVisual?.pickHero?.(images)||images[0]||null;
  if(visual){
    return '<div class="dish-media">'+
      '<img src="'+esc(visual.url)+'" alt="'+esc(visual.alt||x.name)+'" loading="lazy" decoding="async" data-fallback="'+esc(visual.fallback_url||"")+'" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;delete this.dataset.fallback}else{this.closest(\'div\').classList.add(\'is-error\')}">'+
    '</div>';
  }
  return window.OpenPQVisual
    ? OpenPQVisual.placeholder(x.name,copy("food.image_pending","Ảnh riêng của món đang được bổ sung"))
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
  ).join(""):'<div class="empty">'+esc(copy("food.no_match","Không có món phù hợp."))+'</div>';
}


function renderRandomDish(){
  const host=$("#randomDishResult"),rows=state.randomDishes;
  if(!host)return;
  if(!rows.length){
    host.innerHTML='<p class="random-dish-empty">'+esc(copy("food.random_empty","Chọn bữa bạn muốn ăn, tớ gợi ý ba món để lựa."))+'</p>';
    return;
  }
  const meals={breakfast:copy("food.meal_breakfast","Ăn sáng"),lunch:copy("food.meal_lunch","Ăn trưa"),dinner:copy("food.meal_dinner","Ăn tối"),snack:copy("food.meal_snack","Ăn chơi"),dessert:copy("food.meal_dessert","Món ngọt")};
  host.innerHTML='<div class="random-dish-picks">'+rows.map(dish=>{
    const time=(dish.meal_times||[]).map(x=>meals[x]).filter(Boolean).slice(0,2).join(" · ");
    return '<div class="random-dish-pick"><span>'+esc(time||copy("food.suggestion_today","Gợi ý hôm nay"))+'</span><strong>'+esc(dish.name)+'</strong><p>'+esc(dish.intro)+'</p><a href="article.html?id='+encodeURIComponent(dish.id)+'">'+esc(copy("food.view_dish","Xem món này →"))+'</a></div>';
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
    (dish.allergy_note?'<p data-food-path="allergy_note">'+esc(dish.allergy_note)+'</p>':"")+
    ((dish.ask_staff||[]).length?'<div class="ask-staff"><strong>'+esc(copy("food.ask_staff","Nếu cần hỏi quán"))+'</strong><ul>'+
      dish.ask_staff.map((x,i)=>'<li><span data-food-path="ask_staff.'+i+'">'+esc(x)+'</span></li>').join("")+
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
      '<div><span>'+String(i+1).padStart(2,"0")+'</span><strong data-food-path="ingredients.'+i+'">'+esc(x)+'</strong></div>'
    ).join("")+'</div>'+
    '<small>'+esc(copy("food.recipe_note","Công thức có thể thay đổi theo quán. Nếu dị ứng hoặc kiêng ăn, hãy hỏi thành phần thực tế tại nơi bạn gọi món."))+'</small>'+
  '</section>';
}

function sourcesBlock(){
  return "";
}

function renderArticle(){
  const host=$("#foodArticle");
  if(!host)return;
  const id=new URLSearchParams(location.search).get("id");
  const resolvedId=id==="chao-ca"?"chao-cha":id;
  const dish=state.data.dishes.find(x=>x.id===resolvedId);
  if(!id||!dish){
    document.title=copy("food.not_found_document_title","Không tìm thấy món - Open Phu Quoc");
    host.removeAttribute("data-food-id");
    host.innerHTML='<div class="empty"><strong>'+esc(copy("food.not_found_title","Không tìm thấy món này."))+'</strong><p>'+esc(copy("food.not_found_description","Món có thể đã đổi địa chỉ hoặc chưa được công khai."))+'</p><p><a href="index.html">'+esc(copy("food.all_dishes","← Xem tất cả món"))+'</a></p></div>';
    const more=$("#moreDishes");if(more)more.innerHTML="";
    return;
  }

  document.title=dish.name+" - Open Phu Quoc";

  const images=dishImages(dish.id);
  const gallery=window.OpenPQVisual&&images.length
    ? OpenPQVisual.gallery(images,{eyebrow:copy("food.images_eyebrow","NHÌN MÓN"),title:copy("food.images_title","Nhìn món trước khi gọi")})
    : "";

  const cultural=new Set(['goi-ca-trich','bun-quay','bun-ken','ga-ray-nuong','banh-kheo','banh-tet-mat-cat']);
  const nameStories=new Set(['bun-quay','bun-ken','ga-ray-nuong','banh-kheo','banh-tet-mat-cat']);
  const origin=cultural.has(dish.id)&&dish.origin
    ? '<section><div class="food-section-label">'+esc(copy("food.origin","NGUỒN GỐC"))+'</div><h2>'+esc(copy("food.origin_value","Món đến từ đâu?"))+'</h2><p data-food-path="origin">'+esc(dish.origin)+'</p></section>'
    : "";
  const nameStory=nameStories.has(dish.id)&&dish.why_name
    ? '<section><div class="food-section-label">'+esc(copy("food.name","TÊN GỌI"))+'</div><h2>'+esc(copy("food.name_value","Vì sao gọi như vậy?"))+'</h2><p data-food-path="why_name">'+esc(dish.why_name)+'</p></section>'
    : "";

  host.dataset.foodId=dish.id;
  host.innerHTML=
    '<div class="crumb">'+esc(copy("food.crumb","ĂN PHÚ QUỐC"))+' · '+esc(dish.category==="seafood"?copy("food.seafood","HẢI SẢN"):copy("food.local","MÓN ĐỊA PHƯƠNG"))+'</div>'+
    '<h1 data-food-path="name">'+esc(dish.name)+'</h1>'+
    '<p class="lead" data-food-path="intro">'+esc(dish.intro)+'</p>'+
    origin+
    nameStory+
    ingredientsBlock(dish)+
    '<section><div class="food-section-label">'+esc(copy("food.how_to_eat","CÁCH ĂN"))+'</div><h2>'+esc(copy("food.how_to_eat_title","Ăn sao cho ngon?"))+'</h2><p data-food-path="how_to_eat">'+esc(dish.how_to_eat||copy("food.default_how_to_eat","Ăn lúc món còn nóng; nêm theo khẩu vị riêng."))+'</p></section>'+
    '<section><div class="food-section-label">'+esc(copy("food.practical","LƯU Ý THỰC TẾ"))+'</div><h2>'+esc(copy("food.practical_title","Nhớ mấy chuyện này."))+'</h2><ul>'+
      (dish.tips||[]).map((x,i)=>'<li><span data-food-path="tips.'+i+'">'+esc(x)+'</span></li>').join("")+
    '</ul></section>'+
    allergenBlock(dish)+
    gallery+
    sourcesBlock(dish)+
    '<div class="food-hashtags">'+(dish.hashtags||[]).map(x=>'<span>'+esc(x)+'</span>').join("")+'</div>';

  const others=state.data.dishes.filter(x=>x.id!==dish.id);
  $("#moreDishes").innerHTML='<h3>'+esc(copy("food.more","Ăn tiếp món gì?"))+'</h3><div class="more-dish-links">'+
    others.map(x=>'<a href="article.html?id='+encodeURIComponent(x.id)+'">'+esc(x.name)+' →</a>').join("")+
    '</div>';
}

async function load(){
  const [r,v,u]=await Promise.all([
    fetch(DATA,{cache:"default"}).then(async res=>{
      if(res.ok)return res;
      if(CONTENT_LOCALE!=="vi")throw Error("Locale food content is not published");
      return fetch(DATA_FALLBACK,{cache:"default"});
    }),
    fetch(VISUALS,{cache:"default"}).catch(()=>null),
    fetch(UI,{cache:"default"}).then(r=>r.ok?r.json():Promise.reject())
      .catch(()=>fetch(UI_FALLBACK,{cache:"default"}).then(r=>r.ok?r.json():{}).catch(()=>({})))
  ]);
  state.data=await r.json();
  state.visuals=v?.ok?await v.json():{};
  state.ui=u||{};
  if($("#dishCount"))$("#dishCount").textContent=state.data.dishes.length;
  const context=$("#foodVisualContext");
  if(context && window.OpenPQVisual){
    context.innerHTML=OpenPQVisual.gallery(state.visuals?.food_context?.seafood||[],{
      eyebrow:copy("food.visual_context_eyebrow","ẢNH TƯ LIỆU JOTRIP · BỐI CẢNH CHUNG"),
      title:copy("food.visual_context_title","Hải sản trong bếp - ảnh không gắn với món cụ thể")
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
  if(h)h.innerHTML='<div class="empty">'+esc(copy("food.load_error","Chưa mở được danh sách món ăn."))+'</div>';
});