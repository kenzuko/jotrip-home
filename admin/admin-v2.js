/* Open Phu Quoc CMS Admin V2 - role-aware global work switcher.
 * No API calls, no workflow changes, and never bypasses current-module dirty guard. */
(function(root){
  "use strict";
  const labels={home:"Trang chủ",stories:"Bài viết",guide:"Cẩm nang",
    venues:"Địa điểm",foods:"Món ăn",visuals:"Thư viện ảnh",
    utilities:"Tiện ích",users:"Người dùng",analytics:"Intelligence"};
  const hints={home:"Bố cục và câu chữ",stories:"Biên tập và bản nháp",
    guide:"Sổ tay và nguồn ảnh",venues:"Hồ sơ và tọa độ",foods:"Thực thể món",
    visuals:"Tác giả, ảnh và chú thích",utilities:"Thông tin thiết yếu",
    users:"Quyền truy cập",analytics:"Sức khỏe nguồn dữ liệu"};
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[đĐ]/g,"d").toLowerCase().trim();
  let ctx=null;
  function links(modules,role){
    const common=[
      {id:"dashboard",label:"Bàn làm việc",hint:"Tổng quan, nháp và hàng đợi",type:"module"},
      {id:"quality",label:"Cần kiểm chứng",hint:"Nguồn, hạn xử lý và công việc",type:"url",url:"quality.html"},
      {id:"reviews",label:"Hàng đợi duyệt",hint:"PR nội dung, diff và lịch sử",type:"url",url:"reviews.html"}
    ];
    const allowed=(modules||[]).filter(m=>m&&Array.isArray(m.read)&&m.read.includes(role))
      .map(m=>({id:m.id,label:labels[m.id]||m.label||m.id,
        hint:hints[m.id]||m.description||"",type:"module"}));
    return [...common,...allowed];
  }
  function render(){
    const host=document.getElementById("quickResults");
    if(!host||!ctx)return;
    const term=norm(document.getElementById("quickInput").value);
    const matching=ctx.links.filter(x=>!term||norm([x.label,x.hint].join(" ")).includes(term));
    document.getElementById("quickCount").textContent=matching.length+
      (matching.length===1?" mục phù hợp":" mục phù hợp");
    host.innerHTML=matching.map((item,i)=>
      '<button class="quick-result" type="button" data-quick-id="'+esc(item.id)+'"'+
      (i===0?' data-quick-first="true"':"")+'>'+
      '<span class="quick-symbol" aria-hidden="true">'+
      ({dashboard:"⌂",quality:"!",reviews:"✓",stories:"✎",guide:"▤",
        venues:"⌖",foods:"◈",analytics:"◷"}[item.id]||"•")+'</span>'+
      '<span><strong>'+esc(item.label)+'</strong><small>'+esc(item.hint)+'</small></span>'+
      '<span class="quick-arrow" aria-hidden="true">↗</span></button>'
    ).join("")||'<div class="quick-empty">Không có mục phù hợp. Thử từ khóa khác.</div>';
  }
  function open(){
    if(!ctx)return;
    const dialog=document.getElementById("quickDialog");
    if(!dialog)return;
    const input=document.getElementById("quickInput");
    input.value="";render();
    if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
    input.focus();
  }
  function close(){
    const dialog=document.getElementById("quickDialog");
    if(!dialog)return;
    if(typeof dialog.close==="function")dialog.close();else dialog.removeAttribute("open");
  }
  function go(id){
    if(!ctx)return;
    const target=ctx.links.find(x=>x.id===id);
    if(!target)return;
    close();
    if(target.type==="url"){
      // Only internal, static destinations are accepted.
      if(target.url==="quality.html"||target.url==="reviews.html")
        root.location.assign(target.url);
      return;
    }
    ctx.onModule(target.id);
  }
  function keydown(event){
    const ctrl=event.ctrlKey||event.metaKey;
    if(ctrl&&event.key.toLowerCase()==="k"){
      event.preventDefault();
      const dialog=document.getElementById("quickDialog");
      if(dialog?.open)close();else open();return;
    }
    if(event.key!=="/"||event.altKey||event.ctrlKey||event.metaKey)return;
    if(["INPUT","TEXTAREA","SELECT"].includes(event.target?.tagName)||
      event.target?.isContentEditable)return;
    const search=document.getElementById("cmsSearch");
    if(search&&!search.closest(".cms-filter")?.classList.contains("hidden")){
      event.preventDefault();search.focus();search.select?.();
    }else{event.preventDefault();open();}
  }
  function unmount(){
    if(!ctx)return;
    document.removeEventListener("keydown",keydown);
    document.getElementById("quickOpen")?.removeEventListener("click",open);
    document.getElementById("quickClose")?.removeEventListener("click",close);
    document.getElementById("quickInput")?.removeEventListener("input",render);
    document.getElementById("quickInput")?.removeEventListener("keydown",ctx.onInputKey);
    document.getElementById("quickResults")?.removeEventListener("click",ctx.onClick);
    ctx=null;
  }
  function mount({modules,role,onModule}){
    unmount();
    if(!["admin","editor","operator","viewer"].includes(role)||typeof onModule!=="function")return;
    const dialog=document.getElementById("quickDialog");
    if(!dialog||!document.getElementById("quickOpen"))return;
    ctx={links:links(modules,role),onModule};
    ctx.onClick=e=>{
      const target=e.target.closest("[data-quick-id]");
      if(target)go(target.dataset.quickId);
    };
    ctx.onInputKey=e=>{
      if(e.key==="Enter"){
        const first=document.querySelector("[data-quick-first]");
        if(first){e.preventDefault();go(first.dataset.quickId);}
      }
    };
    document.getElementById("quickOpen").classList.remove("hidden");
    document.getElementById("quickOpen").addEventListener("click",open);
    document.getElementById("quickClose").addEventListener("click",close);
    document.getElementById("quickInput").addEventListener("input",render);
    document.getElementById("quickInput").addEventListener("keydown",ctx.onInputKey);
    document.getElementById("quickResults").addEventListener("click",ctx.onClick);
    document.addEventListener("keydown",keydown);
    render();
  }
  root.OPQAdminV2={mount,unmount,open,close,links};
})(window);
