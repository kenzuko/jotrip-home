/* OpenPQ CMS - focused article review. UI-only: never writes CMS data. */
(function(root){
  "use strict";
  const state={selected:0,mode:"read",query:"",writing:false,undo:null};
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
    state.query="";state.writing=false;state.undo=null;
  }
  function selected(){return state.selected}
  function view(){return state.mode}
  function select(index,length){
    if(!Number.isInteger(index)||index<0||index>=length)return false;
    state.selected=index;state.mode="read";state.writing=false;state.undo=null;return true;
  }
  function setView(mode){
    if(!["read","outline","edit"].includes(mode))return false;
    state.mode=mode;if(mode!=="edit")state.writing=false;return true;
  }
  function writing(){return state.writing;}
  function toggleWriting(){
    if(state.mode!=="edit")return false;
    state.writing=!state.writing;return state.writing;
  }
  function rememberSections(index,sections){
    if(index!==state.selected||!Array.isArray(sections))return false;
    state.undo={index,sections:JSON.parse(JSON.stringify(sections))};return true;
  }
  function canUndo(index){return Boolean(state.undo&&state.undo.index===index);}
  function clearUndo(){state.undo=null;}
  function undoSections(index){
    if(!canUndo(index))return null;
    const result=JSON.parse(JSON.stringify(state.undo.sections));state.undo=null;return result;
  }
  function issues(story,index){
    const s=story||{},p="stories."+index+".",out=[];
    const add=(title,field,kind="suggested")=>out.push({title,path:p+field,kind});
    if(!String(s.title||"").trim())add("Chưa có tiêu đề","title","required");
    if(!String(s.id||"").trim())add("Chưa tạo mã bài","id","required");
    if(!String(s.dek||"").trim())add("Chưa có mô tả ngắn","dek","required");
    if(!String(s.intro||"").trim())add("Chưa viết mở bài","intro","suggested");
    if(!String(s.image||"").trim())add("Chưa chọn ảnh bìa","image","suggested");
    else{
      if(!String(s.image_caption||"").trim())add("Ảnh bìa thiếu chú thích","image_caption");
      if(!String(s.image_credit||"").trim()&&!String(s.image_source_url||"").trim())
        add("Ảnh bìa chưa ghi tác giả hoặc nguồn","image_credit");
    }
    const sections=Array.isArray(s.sections)?s.sections:[];
    if(!sections.length)add("Chưa có đoạn nội dung","sections","required");
    sections.forEach((part,j)=>{
      if(!String(part?.body||"").trim()&&!String(part?.image||"").trim())
        add("Đoạn "+(j+1)+" chưa có nội dung hoặc ảnh","sections."+j+".body","required");
      else if(part?.image&&!String(part.caption||"").trim())
        add("Ảnh đoạn "+(j+1)+" thiếu chú thích","sections."+j+".caption");
    });
    const sources=Array.isArray(s.sources)?s.sources:[];
    if(!sources.some(x=>String(x?.label||"").trim()))
      add("Chưa ghi nguồn tham khảo","sources","suggested");
    return out;
  }
  function checksHtml(story,index){
    const items=issues(story,index),required=items.filter(x=>x.kind==="required").length;
    const count=items.length;
    return '<section class="story-editor-checks" data-story-editor-checks aria-label="Nhắc việc khi biên tập">'+
      '<div class="story-check-head"><div><strong>'+(count?count+" điều cần xem lại":"Đã điền các mục cơ bản")+
      '</strong><small>'+(required?required+" mục cần hoàn thiện · ":"")+'Chỉ nhắc nội dung còn thiếu, không xác minh thông tin hay quyền ảnh.</small></div>'+
      '<span class="story-check-number">'+count+'</span></div>'+
      (count?'<div class="story-check-list">'+items.map(x=>
        '<button type="button" data-story-fix="'+esc(x.path)+'" aria-label="Đến ô: '+esc(x.title)+'">'+
        '<span class="story-check-dot '+esc(x.kind)+'"></span>'+esc(x.title)+' <span aria-hidden="true">↗</span></button>'
      ).join("")+'</div>':'<p class="story-check-empty">Có thể tiếp tục đọc lại bài trước khi gửi duyệt.</p>')+
      '</section>';
  }
  function refreshChecks(story,index){
    if(typeof document==="undefined")return false;
    const host=document.querySelector("[data-story-editor-checks]");
    if(!host)return false;host.outerHTML=checksHtml(story,index);return true;
  }
  function query(value){state.query=String(value||"")}
  function paragraph(value){
    return String(value||"").split(/\n\s*\n/).filter(Boolean).map(x=>"<p>"+esc(x)+"</p>").join("");
  }
  function readHtml(story){
    const s=story||{},sections=Array.isArray(s.sections)?s.sections:[],sources=Array.isArray(s.sources)?s.sources:[];
    const cover=safeImage(s.image),coverPos={center:"50% 50%",top:"50% 18%",bottom:"50% 82%",left:"18% 50%",right:"82% 50%"}[s.cover_position]||"50% 50%",readTime=Math.max(1,Number(s.read_minutes)||Math.ceil(words([s.title,s.dek,s.intro,...sections.map(x=>x.body)].join(" "))/220));
    return '<article class="story-reading" data-story-reading>'+
      '<header class="story-reading-head"><div class="story-draft-note">BẢN ĐANG SOẠN · CHƯA XUẤT BẢN</div><span>'+esc(s.category||"BÀI VIẾT")+
      '</span><h1>'+esc(s.title||"Bài chưa có tiêu đề")+'</h1>'+
      (s.dek?'<p class="story-reading-dek">'+esc(s.dek)+'</p>':"")+
      '<small>'+readTime+' phút đọc · '+sections.length+' đoạn</small></header>'+
      (cover?'<figure class="story-reading-cover"><img src="'+esc(cover)+'" alt="'+esc(s.image_alt||s.title||"Ảnh bài viết")+'" style="object-position:'+coverPos+'">'+
        (s.image_caption||s.image_credit?'<figcaption>'+esc([s.image_caption,s.image_credit].filter(Boolean).join(" · "))+'</figcaption>':"")+'</figure>':
        '<p class="story-reading-warning">Bài chưa có ảnh đại diện.</p>')+
      (s.intro?'<div class="story-reading-intro">'+paragraph(s.intro)+'</div>':"")+
      sections.map((part,i)=>'<section class="story-reading-section" data-reading-section="'+i+'">'+
        (part.heading?'<h2>'+esc(part.heading)+'</h2>':"")+
        (safeImage(part.image)?'<figure class="story-reading-figure '+(["body","wide","full"].includes(part.layout)?part.layout:"wide")+
          '"><img src="'+esc(safeImage(part.image))+'" alt="'+esc(part.caption||part.heading||"Ảnh trong bài")+'">'+
          (part.caption?'<figcaption>'+esc(part.caption)+'</figcaption>':"")+'</figure>':
          (!String(part.heading||part.body||"").trim()?'<p class="story-reading-pending">Chưa chọn ảnh cho khối này.</p>':""))+
        (paragraph(part.body)||(!part.image&&part.heading?'<p class="story-reading-empty">Đoạn này chưa có nội dung.</p>':""))+
      '</section>').join("")+
      '<footer class="story-reading-sources"><h2>Nguồn tham khảo</h2>'+
      (sources.length?'<ul>'+sources.map(x=>'<li>'+esc(x.label||"Chưa ghi tên nguồn")+'</li>').join("")+'</ul>':
        '<p>Chưa có nguồn được ghi trong bài.</p>')+'</footer></article>';
  }
  function refreshLive(story,index){
    if(typeof document==="undefined")return false;
    const host=document.querySelector('[data-story-live-reading="'+index+'"]');
    if(!host)return false;
    const y=host.scrollTop;host.innerHTML=readHtml(story);host.scrollTop=y;return true;
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
    const controls=state.mode==="edit"?'<div class="story-editor-controls">'+
      '<div class="story-editor-command"><button type="button" data-story-writing data-editor-readonly-action aria-pressed="'+
      String(state.writing)+'">'+(state.writing?"Thoát tập trung":"Tập trung viết")+'</button>'+
      '<button type="button" data-story-undo '+(canUndo(i)?"":"hidden ")+' aria-label="Hoàn tác thao tác thêm, xóa hoặc di chuyển đoạn">↶ Hoàn tác đoạn</button></div>'+
      '<span id="storyLocalSave" role="status" aria-live="polite">Bản nháp chỉ lưu trên trình duyệt này · Ctrl/Cmd+S để lưu nháp</span>'+
      '</div>'+checksHtml(item,i):"";
    return '<div class="story-desk'+(state.writing?" writing":"")+'> <aside class="story-library"><div class="story-library-head"><div><span>BÀI VIẾT</span><h2>Chọn bài để xem</h2><p>'+list.length+' bài trong thư viện</p></div>'+
      '<button type="button" id="addStoryBtn">+ Bài mới</button></div>'+
      '<label class="story-library-label" for="storyDeskSearch">Tìm bài</label>'+
      '<input type="search" id="storyDeskSearch" data-editor-readonly-action value="'+esc(state.query)+'" placeholder="Nhập tiêu đề hoặc chuyên mục" autocomplete="off">'+
      '<p id="storyDeskCount" aria-live="polite">'+visible+' bài phù hợp</p>'+
      '<div class="story-catalog-list" role="group" aria-label="Danh sách bài viết">'+links+'</div>'+
      (fileMetadata?'<details class="story-file-meta"><summary>Thông tin tệp nội dung</summary>'+fileMetadata+'</details>':"")+
      '</aside><section class="story-focus" aria-label="Bài đang xem">'+
      '<header class="story-focus-bar"><div><span>BẢN ĐANG SOẠN · BÀI '+(i+1)+' / '+list.length+'</span><h2>'+esc(item.title||"Bài chưa có tiêu đề")+
      '</h2></div><button type="button" class="ew-story-preview" data-story-preview="'+i+'" data-editor-readonly-action>Xem bản thảo ↗</button></header>'+
      '<nav class="story-mode-tabs" role="tablist" aria-label="Chế độ làm việc">'+tabs+'</nav>'+controls+
      '<div class="story-focus-content" role="tabpanel">'+content+'</div></section></div>';
  }
  root.OPQStoryDesk={reset,selected,view,select,setView,writing,toggleWriting,rememberSections,canUndo,clearUndo,undoSections,issues,checksHtml,refreshChecks,query,render,readHtml,outlineHtml,normalize,refreshLive};
})(window);
