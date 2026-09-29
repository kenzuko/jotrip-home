(()=>{
const $=s=>document.querySelector(s);
const setText=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text};
const replaceText=(el,replacements)=>{if(!el||!el.textContent)return;let next=el.textContent;for(const [a,b] of replacements)next=next.replace(a,b);if(next!==el.textContent)el.textContent=next};
const replaceHtml=(el,replacements)=>{if(!el||!el.textContent)return;let next=el.innerHTML;for(const [a,b] of replacements)next=next.replace(a,b);if(next!==el.innerHTML)el.innerHTML=next};
const cleanPublicCopy=()=>{if(window.JT_I18N_ACTIVE)return;
  setText($('.source-label'),'Chuyến bay · tự cập nhật');
  replaceText($('#updatedAt'),[[/JoTrip Live API/g,'Cập nhật tự động']]);
  replaceText($('#errorBox'),[
    [/Không đọc được dữ liệu Sun Airport lúc này\./g,'Chưa lấy được thông tin chuyến bay lúc này.'],
    [/JoTrip Live API tạm gián đoạn - đang dùng snapshot JoTrip AutoSync gần nhất\./g,'Cập nhật trực tiếp đang tạm gián đoạn - trang đang hiển thị bản gần nhất đã lưu.']
  ]);
  replaceHtml($('#drawerContent'),[
    [/Actual time lấy từ API chính thức Sun Airport\./g,'Giờ thực tế đã được ghi nhận.'],
    [/Nguồn sân bay:/g,'Nguồn ghi:'],
    [/Trạng thái lấy trực tiếp từ dữ liệu Sun Airport\./g,'Tình trạng theo thông tin hiện có.'],
    [/Giờ cập nhật lấy từ dữ liệu sân bay\./g,'Giờ cập nhật theo thông tin chuyến bay.'],
    [/JoTrip Live API \/ Sun Airport/g,'Nguồn chuyến bay'],
    [/JoTrip AutoSync \/ Sun Airport/g,'Bản gần nhất đã lưu']
  ]);
};
if(typeof renderSummary==='function'){
  const base=renderSummary;
  renderSummary=function(){base();setText($('.source-label'),'Chuyến bay · tự cập nhật');replaceText($('#updatedAt'),[[/JoTrip Live API/g,'Cập nhật tự động']]);const ops=$('#opsState');if(ops&&ops.textContent.startsWith('WATCH ·'))setText(ops,ops.textContent.replace('WATCH ·','THEO DÕI ·').replace('BẤT THƯỜNG','CẦN CHÚ Ý'));cleanPublicCopy();};
}
if(typeof renderHealth==='function'){
  const base=renderHealth;
  renderHealth=function(){base();const title=$('#healthTitle'),desc=$('#healthDescription'),l=state?.latest,h=state?.health,age=l?.collected_at_vn?ageInfo(l.collected_at_vn):null,qa=!!(h?.collector_completed&&h?.parser_passed&&h?.normalization_passed&&h?.qa_passed&&l?.quality?.usable);if(title&&desc){if(!qa){setText(title,'CHƯA ĐẠT KIỂM TRA');setText(desc,'Nguồn cập nhật hiện chưa đạt kiểm tra chất lượng. Không nên dùng thông tin này để quyết định chuyến đi.');}else if(state?.dataSource==='fallback'){setText(title,'BẢN GẦN NHẤT');setText(desc,'Cập nhật trực tiếp tạm không phản hồi. Trang đang hiển thị bản gần nhất đã lưu.');}else if(age?.level==='good'){setText(title,'CẬP NHẬT TỐT');setText(desc,'Chuyến bay được cập nhật tự động.');}else if(age?.level==='watch'){setText(title,'CẬP NHẬT CHẬM');setText(desc,'Thông tin đang chậm hơn bình thường. Trang sẽ tự kiểm tra lại mỗi phút.');}else if(age?.level==='stale'){setText(title,'THÔNG TIN ĐÃ CŨ');setText(desc,'Thông tin này đã cũ, không nên xem như tình trạng ngay lúc này.');}}cleanPublicCopy();};
}
if(typeof openDrawer==='function'){
  const base=openDrawer;
  openDrawer=function(...args){base(...args);cleanPublicCopy();};
}
const observer=new MutationObserver(cleanPublicCopy);observer.observe(document.body,{subtree:true,childList:true,characterData:true});
cleanPublicCopy();
})();
