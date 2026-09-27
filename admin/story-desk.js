/* OpenPQ CMS - focused article review. UI-only: never writes CMS data. */
(function(root){
  "use strict";
  const state={selected:0,mode:"read",query:""};
  const esc=value=>String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[đĐ]/g,"d").toLowerCase().trim();
  const words=value=>String(value||"").trim().split(/\s+/).filter(Boolean).length;
  const safeImage=value=>{
    const src=String(value||"").trim();
    return /^https:\/\//i.test(src)||/^\/(?:assets|media|images)\//i.test(src)||/^\.\.\/assets\//i.test(src)?src:"";
  };
  function reset(stories,requestedId){
    const list=Array.isArray(stories)?stories:[];
    const requested=requestedId?list.findIndex(item=>String(item?.id||"")===requestedId):-1;
    state.selected=requested>=0?requested:0;
    state.mode=requested>=0?"edit":"read";
    state.query="";
  }
  function selected(){return state.selected}
  function view(){return state.mode}
  function select(index,length){
    if(!Number.isInteger(index)||index<0||index>=length)return false;
    state.selected=index;state.mode="read";return true;
  }
  function setView(mode){
    if(!["read","outline","edit"].includes(mode))return false;
    state.mode=mode;return true;
  }
  function query(value){state.query=String(value||"")}
  function paragraph(value){
    return String(value||"").split(/\n\s*\n/).filter(Boolean).map(x=>"<p>"+esc(x)+"</p>").join("");
  }
  function readHtml(story){
    const s=story||{},sections=Array.isArray(s.sections)?s.sections:[],sources=Array.isArray(s.sources)?s.sources:[];
    const cover=safeImage(s.image),readTime=Math.max(1,Number(s.read_minutes)||Math.ceil(words([s.title,s.dek,s.intro,...sections.map(x=>x.body)].join(" "))/220));
    return '<article class="story-reading" data-story-reading>'+
      '<header class="story-reading-head"><span>'+esc(s.category||"BÀI VIẾT")+
      '</span><h1>'+esc(s.title||"Bài chưa có tiêu đề")+'</h1>'+
      (s.dek?'<p class="story-reading-dek">'+esc(s.dek)+'</p>':"")+
      '<small>'+readTime+' phút đọc · '+sections.length+' đoạn</small></header>'+
      (cover?'<figure class="story-reading-cover"><img src="'+esc(cover)+'" alt="'+esc(s.image_alt||s.title||"Ảnh bài viết")+'">'+
        (s.image_caption?'<figcaption>'+esc(s.image_caption)+'</figcaption>':"")+'</figure>':
        '<p class="story-reading-warning">Bài chưa có ảnh đại diện.</p>')+
      (s.intro?'<div class="story-reading-intro">'+paragraph(s.intro)+'</div>':"")+
      sections.map((part,i)=>'<section class="story-reading-section"><h2>'+esc(part.heading||"Đoạn "+(i+1))+'</h2>'+
        (paragraph(part.body)||'<p class="story-reading-empty">Đoạn này chưa có nội dung.</p>')+
        (safeImage(part.image)?'<figure><img src="'+esc(safeImage(part.image))+'" alt="'+esc(part.caption||part.heading||"Ảnh trong bài")+'">'+
        (part.caption?'<figcaption>'+esc(part.caption)+'</figcaption>':"")+'</figure>':"")+
      '</section>').join("")+
      '<footer class="story-reading-sources"><h2>Nguồn tham khảo</h2>'+
      (sources.length?'<ul>'+sources.map(x=>'<li>'+esc(x.label||"Chưa ghi tên nguồn")+'</li>').join("")+'</ul>':
        '<p>Chưa có nguồn được ghi trong bài.</p>')+'</footer></article>';
  }
  function outlineHtml(story,index){
    const s=story||{},parts=Array.isArray(s.sections)?s.sections:[],sources=Array.isArray(s.sources)?s.sources:[];
    const entry=(num,title,detail,control)=>'<article class="story-outline-card"><span>'+esc(num)+'</span><div><h3>'+esc(title)+'</h3><p>'+esc(detail)+'</p></div>'+control+'</article>';
    const edit=(part)=>'<button type="button" data-story-focus="'+part+'" data-editor-readonly-action>Sửa đoạn</button>';
    return '<section class="story-outline" data-story-outline>'+
      '<header><h2>Cấu trúc bài viết</h2><p>Đọc nhanh mạch bài và chuyển thẳng đến đoạn muốn sửa.</p></header>'+
      entry("01","Tiêu đề & mô tả",s.title||"Chưa có tiêu đề",'<button type="button" data-story-edit-intro data-editor-readonly-action>Sửa đầu bài</button>')+
      entry("02","Mở bài",s.intro||"Chưa có đoạn mở.",'<button type="button" data-story-edit-intro data-editor-readonly-action>Sửa mở bài</button>')+
      parts.map((part,i)=>entry(String(i+3).padStart(2,"0"),part.heading||"Đoạn "+(i+1),
        (String(part.body||"").slice(0,165)||"Chưa có nội dung")+(part.image?" · Có ảnh":" · Chưa gắn ảnh"),edit(i))).join("")+
      '<div class="story-outline-end"><strong>'+sources.length+' nguồn tham khảo</strong><span>'+
      (s.image?"Có ảnh đại diện":"Thiếu ảnh đại diện")+'</span></div></section>';
  }
  function render(stories,renderEditor,fileMetadata){
    const list=Array.isArray(stories)?stories:[];
    if(!list.length)return '<div class="story-empty"><h2>Chưa có bài viết</h2><p>Tạo bài mới để bắt đầu.</p><button type="button" id="addStoryBtn">+ Tạo bài viết</button></div>';
    const i=Math.max(0,Math.min(state.selected,list.length-1));
    state.selected=i;
    const item=list[i];
    const q=normalize(state.query);
    const links=list.map((story,j)=>{
      const txt=normalize([story.title,story.category,story.id,story.dek].join(" "));
      const hidden=q&&!txt.includes(q);
      return '<button type="button" class="story-library-item'+(i===j?" active":"")+'" data-story-select="'+j+
        '" data-story-search="'+esc(txt)+'" data-editor-readonly-action '+(i===j?'aria-current="true" ':"")+
        (hidden?'hidden ':"")+'><span class="story-library-number">'+(j+1)+'</span><span class="story-library-copy"><strong>'+
        esc(story.title||"Bài chưa có tiêu đề")+'</strong><small>'+esc(story.category||"Chưa phân loại")+
        ' · '+(Array.isArray(story.sections)?story.sections.length:0)+' đoạn</small></span></button>';
    }).join("");
    const visible=list.filter(s=>!q||normalize([s.title,s.category,s.id,s.dek].join(" ")).includes(q)).length;
    const tabs=[["read","Đọc bài"],["outline","Cấu trúc"],["edit","Biên tập"]].map(([id,label])=>
      '<button type="button" data-story-view="'+id+'" data-editor-readonly-action role="tab" aria-selected="'+
      String(state.mode===id)+'">'+label+'</button>').join("");
    const content=state.mode==="edit"?renderEditor(item,i):state.mode==="outline"?outlineHtml(item,i):readHtml(item);
    return '<div class="story-desk"><aside class="story-library"><div class="story-library-head"><div><span>BÀI VIẾT</span><h2>Chọn bài để xem</h2><p>'+list.length+' bài trong thư viện</p></div>'+
      '<button type="button" id="addStoryBtn">+ Bài mới</button></div>'+
      '<label class="story-library-label" for="storyDeskSearch">Tìm bài</label>'+
      '<input type="search" id="storyDeskSearch" value="'+esc(state.query)+'" placeholder="Nhập tiêu đề hoặc chuyên mục" autocomplete="off">'+
      '<p id="storyDeskCount" aria-live="polite">'+visible+' bài phù hợp</p>'+
      '<div class="story-catalog-list" role="group" aria-label="Danh sách bài viết">'+links+'</div>'+
      (fileMetadata?'<details class="story-file-meta"><summary>Thông tin tệp nội dung</summary>'+fileMetadata+'</details>':"")+
      '</aside><section class="story-focus" aria-label="Bài đang xem">'+
      '<header class="story-focus-bar"><div><span>ĐANG XEM BÀI '+(i+1)+' / '+list.length+'</span><h2>'+esc(item.title||"Bài chưa có tiêu đề")+
      '</h2></div><button type="button" class="ew-story-preview" data-story-preview="'+i+'" data-editor-readonly-action>Xem bản thảo ↗</button></header>'+
      '<nav class="story-mode-tabs" role="tablist" aria-label="Chế độ làm việc">'+tabs+'</nav>'+
      '<div class="story-focus-content" role="tabpanel">'+content+'</div></section></div>';
  }
  root.OPQStoryDesk={reset,selected,view,select,setView,query,render,readHtml,outlineHtml,normalize};
})(window);
