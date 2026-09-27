(function(){
 "use strict";
 const rows=document.getElementById("historyRows");
 const preview=document.getElementById("historyPreview");
 const total=document.getElementById("historyTotal");
 if(!rows||!preview||!total)return;
 const escapeText=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
 function render(){
   const items=[...rows.querySelectorAll("tr")].filter(r=>r.cells.length===5);
   total.textContent=items.length+" ngày có xác nhận";
   preview.innerHTML=items.slice(0,3).map(row=>{
     const dateCell=row.cells[0];
     const date=dateCell.querySelector("strong")?.firstChild?.textContent?.trim()||"";
     const time=dateCell.querySelector("small")?.textContent?.trim()||"";
     const pill=row.cells[1].querySelector(".pill");
     const running=pill?.classList.contains("good");
     const state=running?"Hoạt động bình thường":"Tạm dừng";
     const friendly=window.OpenPQCanoHistory?.displayDate(date)||date;
     return '<div class="history-peek-row"><span class="history-peek-day">'+escapeText(friendly)+(time?'<small>'+escapeText(time)+'</small>':'')+
       '</span><span class="history-peek-status '+(running?"history-peek-running":"history-peek-suspended")+'">'+state+"</span></div>";
   }).join("")||'<p class="history-peek-empty">Chưa có ngày nào được xác nhận.</p>';
 }
 new MutationObserver(render).observe(rows,{childList:true});
 render();
})();
