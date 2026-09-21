const CONTENT="../data/content.json";
const VISUALS="../data/visual-context.json";
const ZONES="../data/entities/zones.json";
const $=s=>document.querySelector(s);

async function load(){
  const r=await fetch(CONTENT+"?t="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw new Error(r.status);
  return r.json();
}

function esc(s){
  return String(s??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function setMeta(selector,attr,value){
  let el=document.querySelector(selector);
  if(!el){
    el=document.createElement("meta");
    const m=selector.match(/^meta\[(name|property)="([^"]+)"\]$/);
    if(!m)return;
    el.setAttribute(m[1],m[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr,value);
}
function setCanonical(url){
  let el=document.querySelector('link[rel="canonical"]');
  if(!el){el=document.createElement("link");el.rel="canonical";document.head.appendChild(el)}
  el.href=url;
}
function applyStoryMeta(story){
  const title=story.title+" - Open Phu Quoc";
  const description=story.dek||story.intro||"Câu chuyện về Phú Quốc.";
  const url="https://openphuquoc.com/stories/article.html?id="+encodeURIComponent(story.id);
  const image=story.image||"https://openphuquoc.com/assets/logo-master.png";
  document.title=title;
  setCanonical(url);
  setMeta('meta[name="description"]',"content",description);
  setMeta('meta[property="og:type"]',"content","article");
  setMeta('meta[property="og:title"]',"content",title);
  setMeta('meta[property="og:description"]',"content",description);
  setMeta('meta[property="og:url"]',"content",url);
  setMeta('meta[property="og:image"]',"content",image);
  setMeta('meta[property="og:image:alt"]',"content",story.title);
  setMeta('meta[name="twitter:card"]',"content","summary_large_image");
  setMeta('meta[name="twitter:title"]',"content",title);
  setMeta('meta[name="twitter:description"]',"content",description);
  setMeta('meta[name="twitter:image"]',"content",image);
}

function card(s){
  return '<a class="story-card" href="article.html?id='+encodeURIComponent(s.id)+'">'+
    '<img src="'+esc(s.image)+'" alt="'+esc(s.title)+'" onerror="this.style.opacity=.18">'+
    '<div class="story-copy">'+
      '<span>'+esc(s.category)+'</span>'+
      '<h2>'+esc(s.title)+'</h2>'+
      '<p>'+esc(s.dek)+'</p>'+
    '</div>'+
  '</a>';
}

function paragraphs(text){
  const clean=String(text||"").trim();
  if(!clean)return "";
  return clean.split(/\n{2,}/).map(block=>'<p>'+esc(block).replace(/\n/g,"<br>")+'</p>').join("");
}

function coverPosition(value){
  return {top:"50% 18%",bottom:"50% 82%",left:"18% 50%",right:"82% 50%",center:"50% 50%"}[value]||"50% 50%";
}

function figure(section){
  if(!section?.image)return "";
  const layout=["body","wide","full"].includes(section.layout)?section.layout:"wide";
  const caption=section.caption
    ?'<figcaption>'+esc(section.caption)+'</figcaption>'
    :"";
  return '<figure class="article-figure '+layout+'">'+
    '<img src="'+esc(section.image)+'" alt="'+esc(section.caption||section.heading||"Ảnh trong bài")+'" loading="lazy" onerror="this.style.opacity=.18">'+
    caption+
  '</figure>';
}

function sectionBlock(section,i){
  const heading=String(section?.heading||"").trim();
  const body=String(section?.body||"").trim();
  const bodyHtml=paragraphs(body);
  const isNote=/^open phu quoc note$/i.test(heading)||/^ghi chú open phu quoc$/i.test(heading);

  if(isNote){
    return '<aside class="article-note">'+
      '<span>MỘT LƯU Ý</span>'+
      (bodyHtml?'<div class="note-text">'+bodyHtml+'</div>':"")+
      figure(section)+
    '</aside>';
  }

  return '<section class="article-section">'+
    '<div class="section-marker">'+String(i+1).padStart(2,"0")+'</div>'+
    (heading?'<h2>'+esc(heading)+'</h2>':"")+
    figure(section)+
    (bodyHtml?'<div class="section-text">'+bodyHtml+'</div>':"")+
  '</section>';
}

function renderArticle(data,visualData,zones){
  const id=new URLSearchParams(location.search).get("id");
  const s=data.stories.find(x=>x.id===id)||data.stories[0];
  if(!s)return;

  applyStoryMeta(s);

  const root=$("#articleRoot");
  root.innerHTML=
    '<article class="article">'+
      '<header class="article-masthead">'+
        '<div class="article-head-grid">'+
          '<div class="article-head-copy">'+
            '<p class="eyebrow">'+esc(s.category)+'</p>'+
            '<h1>'+esc(s.title)+'</h1>'+
            '<p class="dek">'+esc(s.dek)+'</p>'+
            '<div class="article-meta">'+esc(s.read_minutes)+' PHÚT ĐỌC · OPEN PHU QUOC</div>'+
          '</div>'+
          '<figure class="article-cover">'+
            '<img src="'+esc(s.image)+'" alt="'+esc(s.title)+'" style="object-position:'+coverPosition(s.cover_position)+'" onerror="this.style.opacity=.18">'+
          '</figure>'+
        '</div>'+
      '</header>'+
      '<div class="article-body">'+
        '<p class="intro">'+esc(s.intro)+'</p>'+
        (()=>{
          const meta=visualData?.stories?.[s.id]||{};
          const zone=(zones||[]).find(z=>z.id===meta.zone_id);
          if(!window.OpenPQVisual)return "";
          return [
            OpenPQVisual.quickFacts(meta.quick_facts||[],{label:"Nắm nhanh"}),
            OpenPQVisual.gallery(meta.images||[],{eyebrow:"HÌNH ẢNH",title:"Nhìn câu chuyện này bằng hình"}),
            OpenPQVisual.infographic(meta.infographic||[],{eyebrow:"NHÌN NHANH",title:"Ba ý để nhớ"}),
            OpenPQVisual.locator(zone,{title:"Bài viết này nằm ở đâu?",label:meta.location_label||zone?.name})
          ].join("");
        })()+
        (s.sections||[]).map(sectionBlock).join("")+
        '<aside class="jotrip-service-card" aria-label="Gợi ý từ JoTrip"><span>GỢI Ý TỪ JOTRIP</span><strong>Cần xe riêng, tour, vé hoặc một lịch trình gọn hơn?</strong><p>JoTrip hỗ trợ trực tiếp tại Phú Quốc nếu bạn muốn gom mọi thứ vào một đầu mối.</p><div class="jotrip-service-actions"><a href="tel:+84817060067">Gọi +84 817 060 067</a><a href="https://wa.me/84817060067" target="_blank" rel="noopener">WhatsApp</a><a href="https://zalo.me/0817060067" target="_blank" rel="noopener">Zalo</a></div></aside>'+
        '<div class="editorial-note">Giờ mở cửa, giá vé, lịch biểu diễn và điều kiện thời tiết có thể thay đổi. Trước khi đi, bạn nên mở mục Trực tiếp hoặc Tiện ích để kiểm tra thông tin mới nhất.</div>'+
        '<details class="sources"><summary>Nguồn tham khảo</summary><div>'+
          (s.sources||[]).map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.label)+' →</a>').join("")+
        '</div></details>'+
      '</div>'+
    '</article>';

  window.OpenPQVisual?.bindLazyMaps(root);

  const i=data.stories.indexOf(s);
  const n=data.stories[(i+1)%data.stories.length];
  if(n){
    $("#nextStory").innerHTML=
      '<a href="article.html?id='+encodeURIComponent(n.id)+'">'+
        '<span><small>ĐỌC TIẾP</small>'+esc(n.title)+'</span>'+
        '<span>→</span>'+
      '</a>';
  }
}

load().then(async data=>{
  const grid=$("#storyGrid");
  if(grid)grid.innerHTML=data.stories.map(card).join("");
  if($("#articleRoot")){
    try{
      const [visualData,zonesData]=await Promise.all([
        fetch(VISUALS+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{}),
        fetch(ZONES+"?t="+Date.now(),{cache:"no-store"}).then(r=>r.ok?r.json():{entities:[]})
      ]);
      renderArticle(data,visualData,zonesData.entities||[]);
    }catch(e){
      console.warn(e);
      renderArticle(data,{},[]);
    }
  }
}).catch(()=>{
  const root=$("#articleRoot")||$("#storyGrid");
  if(root)root.innerHTML='<div class="wrap"><p>Chưa tải được nội dung.</p></div>';
});
