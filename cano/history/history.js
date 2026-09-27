(function(){
  "use strict";
  const API=window.OpenPQCanoHistory;
  const ARCHIVE="https://raw.githubusercontent.com/kenzuko/Jotrip-Lab/data-marine-ops/data/marine_ops/cano-history.json";
  const FALLBACK="../../data/cano-history.json";
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const humanState=s=>s==="RUNNING"?"Hoạt động bình thường":"Tạm dừng";
  let events=[];
  async function fetchJson(url){
    const response=await fetch(url+"?t="+Date.now(),{cache:"no-store"});
    if(!response.ok)throw new Error("HTTP "+response.status);
    return response.json();
  }
  function populateMonths(){
    const el=$("#monthFilter"),months=[...new Set(events.map(x=>x.date.slice(0,7)))].sort().reverse();
    el.innerHTML='<option value="all">Tất cả các tháng</option>'+months.map(s=>{
      const [year,month]=s.split("-");
      return '<option value="'+esc(s)+'">Tháng '+esc(month)+"/"+esc(year)+"</option>";
    }).join("");
  }
  function render(){
    const status=$("#statusFilter").value,month=$("#monthFilter").value,day=$("#dateFilter").value;
    const oldest=$("#sortOrder").value==="oldest";
    const subset=events.filter(x=>(status==="all"||x.state===status)&&(month==="all"||x.date.startsWith(month))&&(!day||x.date===day))
      .sort((a,b)=>oldest?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
    $("#resultCount").textContent=subset.length+" ngày có xác nhận";
    if(!subset.length){
      $("#historyGroups").innerHTML='<p class="archive-empty">Không có ngày nào phù hợp với bộ lọc. Điều này không có nghĩa cano không hoạt động.</p>';
      return;
    }
    const groups=new Map();
    for(const item of subset){
      const key=item.date.slice(0,7);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(item);
    }
    $("#historyGroups").innerHTML=[...groups].map(([key,items],index)=>{
      const [year,month]=key.split("-");
      return '<details class="archive-month"'+(index===0?' open':'')+'>'+
        '<summary><span class="archive-month-title">Tháng '+esc(month)+'/'+esc(year)+'</span><span class="archive-month-count">'+items.length+' ngày</span><span class="archive-chevron" aria-hidden="true">⌄</span></summary>'+
        '<div class="archive-month-body">'+items.map(item=>{
          const running=item.state==="RUNNING";
          const source=item.source?.label||"Ghi nhận đã lưu";
          const time=item.time||item.recorded_at_vn?.slice(11,16)||"";
          return '<details class="archive-entry"><summary>'+
            '<span class="archive-date">'+esc(API.displayDate(item.date))+(time?'<small>'+esc(time)+'</small>':'')+'</span>'+
            '<span class="archive-status '+(running?"archive-running":"archive-suspended")+'">'+esc(humanState(item.state))+'</span>'+
            '<span class="archive-source">'+esc(source)+'</span><span class="archive-chevron" aria-hidden="true">⌄</span></summary>'+
            '<div class="archive-entry-body"><p><b>Phạm vi:</b> '+esc(item.scope||"Cano An Thới")+'</p>'+
            (item.note?'<p><b>Ghi chú:</b> '+esc(item.note.length>150?item.note.slice(0,147)+'…':item.note)+'</p>':'')+
            '<p><b>Nguồn xác nhận:</b> '+esc(source)+'</p></div></details>';
        }).join("")+'</div></details>';
    }).join("");
  }
  for(const id of ["statusFilter","monthFilter","dateFilter","sortOrder"])$("#"+id).addEventListener("change",render);
  $("#resetFilters").addEventListener("click",()=>{
    $("#statusFilter").value="all";$("#monthFilter").value="all";$("#dateFilter").value="";$("#sortOrder").value="newest";render();
  });
  Promise.allSettled([fetchJson(FALLBACK),fetchJson(ARCHIVE)]).then(([local,remote])=>{
    const base=local.status==="fulfilled"?local.value:null;
    const canonical=remote.status==="fulfilled"?remote.value:null;
    events=API.mergeHistory(base,canonical,API.todayVN()).events;
    const end=canonical?.archive_through_date||base?.archive_through_date||events.at(-1)?.date;
    $("#archiveFreshness").textContent=canonical?"Đồng bộ tới "+API.displayDate(end)+" · nguồn vận hành":
      base?"Bản lưu dự phòng tới "+API.displayDate(end)+" · có thể chưa có cập nhật mới":
      "Chưa truy cập được dữ liệu lịch sử";
    populateMonths();
    render();
  }).catch(()=>{
    $("#archiveFreshness").textContent="Không tải được lịch sử";
    $("#resultCount").textContent="0 ngày";
    $("#historyGroups").innerHTML='<p class="archive-empty">Tạm thời chưa xem được lịch sử. Vui lòng thử lại sau.</p>';
  });
})();
