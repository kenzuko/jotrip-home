const CONTENT="../data/content.json";
const VISUALS="../data/visual-context.json";
const ZONES="../data/entities/zones.json";
const STORY_LOCATIONS="../data/views/story-locations.json";
const $=s=>document.querySelector(s);
const tr=(key,fallback,vars={})=>window.OpenPQI18n?.format?.("stories."+key,vars,fallback)||
  String(fallback).replace(/\{([A-Za-z0-9_]+)\}/g,(_,k)=>Object.prototype.hasOwnProperty.call(vars,k)?String(vars[k]):"{"+k+"}");

async function load(){
  if(window.OpenPQI18nContent?.stories)return window.OpenPQI18nContent.stories();
  const r=await fetch(CONTENT,{cache:"default"});
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
  const route="/stories/article.html?id="+encodeURIComponent(story.id);
  const url="https://openphuquoc.com"+(window.OpenPQI18n?.localize?.(route)||route);
  const image=new URL(story.image||"/assets/logo-master.png","https://openphuquoc.com/").href;
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
    '<img src="'+esc(s.image)+'" alt="'+esc(s.image_alt||s.title)+'" onerror="this.style.opacity=.18">'+
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

function imageCredit(story){
  if(!story?.image_credit)return "";
  const label=[story.image_caption,story.image_credit].filter(Boolean).join(" · ");
  return '<figcaption class="cover-credit">'+esc(label)+'</figcaption>';
}


function figure(section){
  if(!section?.image)return "";
  const layout=["body","wide","full"].includes(section.layout)?section.layout:"wide";
  const caption=section.caption
    ?'<figcaption>'+esc(section.caption)+'</figcaption>'
    :"";
  return '<figure class="article-figure '+layout+'">'+
    '<img src="'+esc(section.image)+'" alt="'+esc(section.caption||section.heading||tr("image_alt","Ảnh trong bài"))+'" loading="lazy" onerror="this.style.opacity=.18">'+
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
      '<span>'+esc(tr("note_label","MỘT LƯU Ý"))+'</span>'+
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

function renderArticle(data,visualData,zones,storyLocations){
  const id=new URLSearchParams(location.search).get("id");
  const s=data.stories.find(x=>x.id===id);
  const root=$("#articleRoot");
  if(!id||!s){
    document.title=tr("not_found_document_title","Không tìm thấy bài viết - Open Phu Quoc");
    setCanonical("https://openphuquoc.com"+(window.OpenPQI18n?.localize?.("/stories/")||"/stories/"));
    if(root)root.innerHTML='<section class="listing-hero"><div class="wrap"><p class="eyebrow">'+esc(tr("eyebrow","CÂU CHUYỆN PHÚ QUỐC"))+'</p><h1>'+esc(tr("not_found_title","Không tìm thấy bài viết này."))+'</h1><p>'+esc(tr("not_found_description","Bài có thể đã đổi địa chỉ hoặc chưa được công khai. Bạn quay lại mục Câu chuyện để chọn bài khác nhé."))+'</p><p><a class="back" href="index.html">'+esc(tr("back_all","← Xem tất cả câu chuyện"))+'</a></p></div></section>';
    const next=$("#nextStory");if(next)next.innerHTML="";
    return;
  }

  applyStoryMeta(s);
  root.innerHTML=
    '<article class="article">'+
      '<header class="article-masthead">'+
        '<div class="article-head-grid">'+
          '<div class="article-head-copy">'+
            '<p class="eyebrow">'+esc(s.category)+'</p>'+
            '<h1>'+esc(s.title)+'</h1>'+
            '<p class="dek">'+esc(s.dek)+'</p>'+
            '<div class="article-meta">'+esc(tr("read_minutes","ĐỌC KHOẢNG {minutes} PHÚT · OPEN PHU QUOC",{minutes:s.read_minutes}))+'</div>'+
          '</div>'+
          '<figure class="article-cover">'+
            '<img src="'+esc(s.image)+'" alt="'+esc(s.image_alt||s.title)+'" style="object-position:'+coverPosition(s.cover_position)+'" onerror="this.style.opacity=.18">'+
            imageCredit(s)+
          '</figure>'+
        '</div>'+
      '</header>'+
      '<div class="article-body">'+
        '<p class="intro">'+esc(s.intro)+'</p>'+
        (s.sections||[]).map(sectionBlock).join("")+
        (()=>{
          const meta=visualData?.stories?.[s.id]||{};
          const zone=(zones||[]).find(z=>z.id===meta.zone_id);
          const location=storyLocations?.stories?.[s.id];
          if(!window.OpenPQVisual)return "";
          const images=(meta.images||[]).filter(image=>image.url!==s.image);
          return [
            images.length?OpenPQVisual.gallery(images,{eyebrow:tr("images_eyebrow","HÌNH ẢNH"),title:tr("images_title","Nhìn câu chuyện này bằng hình")}):"",
            location?OpenPQVisual.locator(zone,{title:tr("map_title","Bài viết này nằm ở đâu?"),label:location.label,map:location.map}):""
          ].join("");
        })()+
      '</div>'+
    '</article>';

  window.OpenPQVisual?.bindLazyMaps(root);

  const i=data.stories.indexOf(s);
  const n=data.stories[(i+1)%data.stories.length];
  if(n){
    $("#nextStory").innerHTML=
      '<a href="article.html?id='+encodeURIComponent(n.id)+'">'+
        '<span><small>'+esc(tr("next","ĐỌC TIẾP"))+'</small>'+esc(n.title)+'</span>'+
        '<span>→</span>'+
      '</a>';
  }
}

Promise.all([load(),window.OpenPQI18n?.loadUi?.().catch(()=>null)]).then(async ([data])=>{
  const grid=$("#storyGrid");
  if(grid)grid.innerHTML=data.stories.map(card).join("");
  if($("#articleRoot")){
    try{
      const [visualData,zonesData,storyLocations]=await Promise.all([
        fetch(VISUALS,{cache:"default"}).then(r=>r.ok?r.json():{}),
        fetch(ZONES,{cache:"default"}).then(r=>r.ok?r.json():{entities:[]}),
        fetch(STORY_LOCATIONS,{cache:"default"}).then(r=>r.ok?r.json():{stories:{}})
      ]);
      renderArticle(data,visualData,zonesData.entities||[],storyLocations);
    }catch(e){
      console.warn(e);
      renderArticle(data,{},[],{stories:{}});
    }
  }
}).catch(()=>{
  const root=$("#articleRoot")||$("#storyGrid");
  if(root)root.innerHTML='<div class="wrap"><p>'+esc(tr("load_error","Chưa tải được nội dung."))+'</p></div>';
});
