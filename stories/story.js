const CONTENT="../data/content.json";
const VISUALS="../data/visual-context.json";
const ZONES="../data/entities/zones.json";
const $=s=>document.querySelector(s);
const LANGUAGES={vi:"Tiếng Việt",en:"English",ko:"한국어",ru:"Русский",lo:"ລາວ",zh:"简体中文","zh-TW":"繁體中文",fr:"Français"};
const fallbackNotice={en:"A reviewed translation is not available yet. This article is shown in Vietnamese.",ko:"검토된 번역이 아직 없어 베트남어로 표시합니다.",ru:"Проверенный перевод пока недоступен. Статья показана на вьетнамском языке.",lo:"ຍັງບໍ່ມີຄໍາແປທີ່ກວດສອບແລ້ວ. ບົດຄວາມນີ້ສະແດງເປັນພາສາຫວຽດ.",zh:"尚无经过审核的译文。本文显示越南语。","zh-TW":"尚無經過審核的譯文。本文顯示越南語。",fr:"La traduction vérifiée est en préparation. Cet article est affiché en vietnamien."};
const preferred=()=>{
  const explicit=new URLSearchParams(location.search).get("lang");
  const saved=localStorage.getItem("openpq-language");
  const raw=explicit||saved||navigator.languages?.[0]||navigator.language||"vi";
  const normalized=raw.toLowerCase();
  const locale=normalized.startsWith("zh")?(normalized.includes("tw")||normalized.includes("hk")||normalized.includes("hant")?"zh-TW":"zh"):normalized.split("-")[0];
  return LANGUAGES[locale]?locale:"vi";
};
let activeLanguage=preferred();
const sourceFields=s=>({title:s.title,category:s.category,dek:s.dek,intro:s.intro,sections:s.sections,image_alt:s.image_alt,image_caption:s.image_caption});
async function sourceHash(story){
  const bytes=new TextEncoder().encode(JSON.stringify(sourceFields(story)));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
async function attachTranslations(data){
  if(activeLanguage==="vi")return data;
  try{
    const response=await fetch("../data/i18n/"+encodeURIComponent(activeLanguage)+"/stories.json",{cache:"no-store"});
    if(!response.ok)return data;
    const catalog=await response.json();
    if(catalog.locale!==activeLanguage)return data;
    await Promise.all(data.stories.map(async story=>{
      const variant=catalog.stories?.[story.id];
      if(variant?.status!=="published"||variant.source_hash!==await sourceHash(story))return;
      if(!variant.title||!variant.intro||!Array.isArray(variant.sections)||variant.sections.length!==story.sections.length)return;
      story.translations={...story.translations,[activeLanguage]:variant};
    }));
  }catch(error){console.warn("Translation catalog unavailable",error)}
  return data;
}
const translated=(story)=>{
  const variant=story.translations?.[activeLanguage];
  return variant?.status==="published"?{
    ...story,...variant,
    sections:story.sections.map((section,i)=>({...section,heading:variant.sections[i].heading,body:variant.sections[i].body}))
  }:story;
};


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
  const url="https://cms.openphuquoc.com/stories/article.html?id="+encodeURIComponent(story.id)+(document.documentElement.lang!=="vi"?"&lang="+encodeURIComponent(activeLanguage):"");
  const image=story.image||"https://cms.openphuquoc.com/assets/logo-master.png";
  document.title=title;
  setCanonical(url);
  setMeta('meta[name="description"]',"content",description);
  setMeta('meta[property="og:type"]',"content","article");
  setMeta('meta[property="og:title"]',"content",title);
  setMeta('meta[property="og:description"]',"content",description);
  setMeta('meta[property="og:url"]',"content",url);
  setMeta('meta[property="og:image"]',"content",image);
  setMeta('meta[property="og:image:alt"]',"content",story.title);
  setMeta('meta[property="og:locale"]',"content",({en:"en_US",ko:"ko_KR",ru:"ru_RU",lo:"lo_LA",zh:"zh_CN","zh-TW":"zh_TW",fr:"fr_FR"})[document.documentElement.lang]||"vi_VN");
  setMeta('meta[name="twitter:card"]',"content","summary_large_image");
  setMeta('meta[name="twitter:title"]',"content",title);
  setMeta('meta[name="twitter:description"]',"content",description);
  setMeta('meta[name="twitter:image"]',"content",image);
}

function card(s){
  s=translated(s);
  return '<a class="story-card" lang="'+(s.translations?.[activeLanguage]?.status==="published"?esc(activeLanguage):"vi")+'" href="article.html?id='+encodeURIComponent(s.id)+'&lang='+encodeURIComponent(activeLanguage)+'">'+
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
  const license=String(story.image_license_url||"");
  const terms=/^https:\/\/creativecommons\.org\/licenses\//.test(license)?' · <a href="'+esc(license)+'" rel="noopener noreferrer license" target="_blank">Điều kiện sử dụng ảnh</a>':"";
  return '<figcaption class="cover-credit">'+esc(label)+terms+'</figcaption>';
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
  const original=data.stories.find(x=>x.id===id);
  if(!original){
    $("#articleRoot").innerHTML='<div class="wrap"><h1>Không tìm thấy bài viết</h1><p><a href="index.html">Xem các câu chuyện khác</a></p></div>';
    return;
  }
  const s=translated(original);
  document.documentElement.lang=s===original?"vi":activeLanguage;
  if(activeLanguage!=="vi"&&s===original){
    const notice=document.createElement("p");
    notice.className="translation-notice";
    notice.textContent=fallbackNotice[activeLanguage];
    $("#articleRoot").before(notice);
  }

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
          if(!window.OpenPQVisual)return "";
          const images=(meta.images||[]).filter(image=>image.url!==s.image);
          return [
            images.length?OpenPQVisual.gallery(images,{eyebrow:"HÌNH ẢNH",title:"Nhìn câu chuyện này bằng hình"}):"",
            OpenPQVisual.locator(zone,{title:"Bài viết này nằm ở đâu?",label:meta.location_label||zone?.name})
          ].join("");
        })()+
      '</div>'+
    '</article>';

  window.OpenPQVisual?.bindLazyMaps(root);

  const i=data.stories.indexOf(original);
  const n=data.stories[(i+1)%data.stories.length];
  if(n){
    $("#nextStory").innerHTML=
      '<a href="article.html?id='+encodeURIComponent(n.id)+'&lang='+encodeURIComponent(activeLanguage)+'">'+
        '<span><small>ĐỌC TIẾP</small>'+esc(translated(n).title)+'</span>'+
        '<span>→</span>'+
      '</a>';
  }
}

load().then(attachTranslations).then(async data=>{
  const grid=$("#storyGrid");
  if(grid){
    grid.innerHTML=data.stories.map(card).join("");
    document.documentElement.lang=data.stories.every(s=>s.translations?.[activeLanguage]?.status==="published")?activeLanguage:"vi";
    if(activeLanguage!=="vi"&&document.documentElement.lang==="vi"){
      const notice=document.createElement("p");
      notice.className="translation-notice";
      notice.textContent=fallbackNotice[activeLanguage];
      grid.before(notice);
    }
  }
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
