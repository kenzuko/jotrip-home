(()=>{
const $=s=>document.querySelector(s);
const clean=()=>{
  const source=$('.source-label'); if(source) source.textContent='Open AutoSync · Nguồn chính thức';
  const u=$('#updatedAt'); if(u) u.textContent=u.textContent.replace(/Open AutoSync API/g,'Open AutoSync').replace(/nguồn chính thức · Open AutoSync/g,'Open AutoSync · Nguồn chính thức');
  const h=$('#healthDescription'); if(h) h.textContent=h.textContent.replace(/Open AutoSync đang đọc trực tiếp API chính thức nguồn chính thức/gi,'Open AutoSync đang đọc nguồn chính thức và giữ cache ngắn để ổn định hiển thị').replace(/Open AutoSync snapshot/gi,'bản lưu Open AutoSync');
  const err=$('#errorBox'); if(err) err.textContent=err.textContent.replace(/nguồn chính thức/gi,'nguồn chuyến bay chính thức');
};
const mobileSearch=$('#mobileSearch');
if(mobileSearch) mobileSearch.onclick=()=>{document.querySelector('#flightBoard')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('#flightSearch')?.focus(),380)};
const observer=new MutationObserver(clean);observer.observe(document.body,{subtree:true,childList:true,characterData:true});clean();
})();