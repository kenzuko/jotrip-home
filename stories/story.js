const CONTENT="../data/content.json";
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
      '<span>OPEN PHU QUOC NOTE</span>'+
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

function renderArticle(data){
  const id=new URLSearchParams(location.search).get("id");
  const s=data.stories.find(x=>x.id===id)||data.stories[0];
  if(!s)return;

  document.title=s.title+" - Open Phu Quoc";

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
        (s.sections||[]).map(sectionBlock).join("")+
        '<div class="editorial-note">Thông tin vận hành như giờ mở cửa, giá, trạng thái show và điều kiện thời tiết nên được kiểm tra ở các lớp dữ liệu trực tiếp của Open Phu Quoc thay vì xem là dữ liệu cố định trong bài.</div>'+
        '<div class="sources">'+
          '<h3>Nguồn tham khảo</h3>'+
          (s.sources||[]).map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.label)+' →</a>').join("")+
        '</div>'+
      '</div>'+
    '</article>';

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

load().then(data=>{
  const grid=$("#storyGrid");
  if(grid)grid.innerHTML=data.stories.map(card).join("");
  if($("#articleRoot"))renderArticle(data);
}).catch(()=>{
  const root=$("#articleRoot")||$("#storyGrid");
  if(root)root.innerHTML='<div class="wrap"><p>Chưa tải được nội dung.</p></div>';
});
