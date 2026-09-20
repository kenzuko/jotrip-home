(()=>{
const $=s=>document.querySelector(s);
const clean=()=>{
  const source=$('.source-label'); if(source) source.textContent='Nguồn chuyến bay chính thức';
  const u=$('#updatedAt'); if(u) u.textContent=u.textContent.replace(/Open AutoSync API|Open AutoSync/gi,'dữ liệu chuyến bay');
  const h=$('#healthDescription'); if(h) h.textContent=h.textContent.replace(/Open AutoSync/gi,'Hệ thống chuyến bay');
  const err=$('#errorBox'); if(err) err.textContent=err.textContent.replace(/nguồn chính thức/gi,'nguồn chuyến bay chính thức');
};
const mobileSearch=$('#mobileSearch');
if(mobileSearch) mobileSearch.onclick=()=>{document.querySelector('#flightBoard')?.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>$('#flightSearch')?.focus(),380)};
const observer=new MutationObserver(clean);observer.observe(document.body,{subtree:true,childList:true,characterData:true});clean();
})();
