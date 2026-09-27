(function(){
  "use strict";
  const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const number=x=>new Intl.NumberFormat("vi-VN").format(Number(x)||0);
  const prettyDay=x=>{const p=String(x||"").split("-");return p.length===3?p[2]+"/"+p[1]:"—"};
  const nowVN=()=>{
    const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const obj=Object.fromEntries(p.map(x=>[x.type,x.value]));
    return obj.year+"-"+obj.month+"-"+obj.day;
  };
  const minus=(day,n)=>new Date(Date.parse(day+"T12:00:00Z")-n*86400000).toISOString().slice(0,10);
  const CHANNEL={search:"Tìm kiếm",ai:"Trợ lý AI",social:"Mạng xã hội",direct:"Truy cập trực tiếp",referral:"Trang khác",internal:"Liên kết nội bộ"};
  const ACTION={go_open:"Mở GO",nearme_open:"Mở Near Me",weather_open:"Xem thời tiết",airport_open:"Xem chuyến bay",transit_open:"Xem tàu xe",feedback_open:"Mở góp ý"};
  const state={host:null,days:7,token:0,loading:false,data:null};
  const empty=label=>'<div class="traffic-empty">'+esc(label||"Chưa có dữ liệu trong khoảng thời gian này.")+"</div>";
  const panel=(title,sub,body)=>'<section class="traffic-panel"><div class="traffic-panel-head"><div><h3>'+esc(title)+'</h3>'+(sub?"<p>"+esc(sub)+"</p>":"")+'</div></div>'+body+"</section>";
  const metric=(label,value,note)=>'<article class="traffic-kpi"><span>'+esc(label)+'</span><strong>'+esc(number(value))+'</strong><small>'+esc(note)+'</small></article>';
  function rows(data,key,labels,emptyText){
    const list=data||[];
    if(!list.length)return empty(emptyText);
    const max=Math.max(1,...list.map(r=>Number(r.hits)||0));
    return '<div class="traffic-bars">'+list.map(r=>{
      const name=labels?.[r[key]]||r[key]||"Không rõ";
      const hits=Number(r.hits)||0;
      return '<div class="traffic-bar-row"><span title="'+esc(name)+'">'+esc(name)+'</span>'+
        '<div class="traffic-track"><i style="width:'+Math.max(1,100*hits/max).toFixed(1)+'%"></i></div>'+
        '<strong>'+esc(number(hits))+'</strong></div>';
    }).join("")+"</div>";
  }
  function trend(data){
    const n=state.days,to=nowVN(),byDay=new Map((data.trend||[]).map(r=>[r.day,Number(r.hits)||0]));
    const daily=Array.from({length:n},(_,i)=>{const day=minus(to,n-i-1);return{day,hits:byDay.get(day)||0}});
    const weekly=n===90;
    const groups=weekly?Array.from({length:Math.ceil(daily.length/7)},(_,i)=>{
      const slice=daily.slice(i*7,(i+1)*7);
      return{day:slice[0].day,hits:slice.reduce((s,x)=>s+x.hits,0)}
    }):daily;
    const max=Math.max(1,...groups.map(x=>x.hits));
    return '<div class="traffic-trend" role="img" aria-label="Lượt xem theo '+(weekly?"tuần":"ngày")+'">'+
      groups.map((r,i)=>'<div class="traffic-trend-cell" title="'+esc(prettyDay(r.day)+": "+number(r.hits)+" lượt xem")+'">'+
        '<span class="traffic-trend-value">'+(r.hits?esc(number(r.hits)):"")+'</span>'+
        '<i style="height:'+Math.max(2,r.hits/max*100).toFixed(1)+'%"></i>'+
        (n===7||weekly||n===30&&i%5===0?'<small>'+esc(prettyDay(r.day))+'</small>':"<small></small>")+
      '</div>').join("")+
    '</div><p class="traffic-panel-foot">Theo giờ Việt Nam · '+(weekly?"Gộp theo tuần":"Theo ngày")+' · Không tính dữ liệu trước ngày triển khai.</p>';
  }
  function countries(list){
    let display;
    try{display=new Intl.DisplayNames(["vi"],{type:"region"})}catch{}
    const named=(list||[]).map(r=>({...r,name:r.country==="XX"?"Không xác định":display?.of(r.country)||r.country}));
    return rows(named,"name",null,"Chưa đủ dữ liệu quốc gia.");
  }
  function pathLabel(path){
    if(path==="/")return "Trang chủ";
    if(path.startsWith("/go"))return "GO · "+path;
    if(path.startsWith("/nearme"))return "Near Me · "+path;
    if(path.startsWith("/weather"))return "Thời tiết · "+path;
    if(path.startsWith("/airport"))return "Sân bay · "+path;
    if(path.startsWith("/guide"))return "Cẩm nang · "+path;
    if(path.startsWith("/stories"))return "Câu chuyện · "+path;
    return path;
  }
  function popularPages(list){
    if(!list?.length)return empty("Chưa có lượt xem nào được ghi nhận.");
    return '<div class="traffic-page-list">'+list.map((r,i)=>{
      const name=pathLabel(r.path);
      return '<div class="traffic-page-row"><b>'+String(i+1).padStart(2,"0")+'</b>'+
        '<div><a href="'+esc(r.path)+'" target="_blank" rel="noopener noreferrer" title="'+esc(name)+'">'+esc(name)+'</a></div>'+
        '<strong>'+esc(number(r.hits))+'</strong></div>';
    }).join("")+"</div>";
  }
  function draw(data){
    state.data=data;
    const list=(key)=>data[key]||[];
    const sum=(key,label)=>list(key).filter(r=>r.channel===label).reduce((s,r)=>s+Number(r.hits||0),0);
    const events=list("actions").reduce((s,r)=>s+Number(r.hits||0),0);
    const from=data.from||minus(nowVN(),state.days-1),to=data.to||nowVN();
    const latest=data.updated_at?new Date(data.updated_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}):"—";
    state.host.querySelector("#trafficBody").innerHTML=
      '<div class="traffic-kpis">'+
        metric("Lượt xem trang",data.total_page_views,"Tổng lượt tải trang, không phải số người")+
        metric("Từ tìm kiếm",sum("channels","search"),"Các lượt xem có nguồn tìm kiếm")+
        metric("Từ trợ lý AI",sum("channels","ai"),"Chỉ tính truy cập gửi referrer")+
        metric("Tương tác",events,"GO, Near Me, thời tiết, góp ý…")+
      '</div>'+
      '<p class="traffic-description">Dữ liệu '+esc(prettyDay(from))+' - '+esc(prettyDay(to))+' · Cập nhật '+esc(latest)+'. '+esc(data.note||"")+'</p>'+
      '<div class="traffic-grid">'+
        panel("Nhịp truy cập","Số lượt xem trong kỳ",trend(data))+
        panel("Khách đến từ đâu?","Nguồn truy cập khi trình duyệt cung cấp referrer",rows(list("channels"),"channel",CHANNEL))+
        panel("Trang được xem nhiều","20 đường dẫn có lượt xem cao nhất",popularPages(list("pages")))+
        panel("Tương tác của khách","Các lần mở tính năng, không phải số người",rows(list("actions"),"event",ACTION))+
        panel("Nguồn giới thiệu","Tên miền nguồn đã được rút gọn để bảo vệ riêng tư",rows(list("referrers"),"ref_domain"))+
        panel("Quốc gia","Theo mã quốc gia Cloudflare khi có",countries(list("countries")))+
        panel("Thiết bị","Ước tính từ loại trình duyệt, có thể sai lệch",rows(list("devices"),"device",{desktop:"Máy tính",mobile:"Điện thoại",tablet:"Máy tính bảng",other:"Khác"}))+
      '</div>';
  }
  async function refresh(){
    if(!state.host)return;
    const token=++state.token,host=state.host;
    const today=nowVN(),from=minus(today,state.days-1);
    const body=host.querySelector("#trafficBody");
    if(body)body.innerHTML='<div class="traffic-loading" role="status">Đang đọc số liệu truy cập...</div>';
    host.querySelectorAll("[data-traffic-days]").forEach(btn=>{
      const selected=Number(btn.dataset.trafficDays)===state.days;
      btn.classList.toggle("active",selected);
      btn.setAttribute("aria-pressed",String(selected));
    });
    try{
      const response=await fetch("/api/cms/traffic?from="+from+"&to="+today,{credentials:"include",cache:"no-store"});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||"HTTP "+response.status);
      if(token===state.token&&state.host===host)draw(data);
    }catch(error){
      if(token===state.token&&state.host===host)
        host.querySelector("#trafficBody").innerHTML='<div class="traffic-failure" role="alert">'+esc(error.message||"Không tải được báo cáo")+
          '<p>Không có số liệu công khai. Hãy kiểm tra quyền chủ sở hữu và kết nối D1.</p></div>';
    }
  }
  window.OPQTrafficDashboard={
    mount({host}){
      if(!host)return;
      if(state.host&&state.host!==host)state.token++;
      state.host=host;
      host.classList.add("analytics-editor","traffic-editor");
      host.innerHTML='<section class="traffic-head"><div><span>OWNER ONLY · OPEN PHU QUOC</span><h2>Truy cập website</h2>'+
        '<p>Xem khách sử dụng trang như thế nào. Báo cáo này chỉ có trong CMS của chủ sở hữu.</p></div>'+
        '<div class="traffic-toolbar" aria-label="Khoảng thời gian">'+
        '<button type="button" data-traffic-days="7">7 ngày</button><button type="button" data-traffic-days="30">30 ngày</button>'+
        '<button type="button" data-traffic-days="90">90 ngày</button><button type="button" class="traffic-refresh" data-traffic-refresh>↻ Cập nhật</button></div></section>'+
        '<div id="trafficBody" aria-live="polite"></div>'+
        '<footer class="traffic-privacy">Chỉ tài khoản chủ sở hữu CMS được truy cập. Không lưu IP, GPS, cookie hay danh tính khách. Số liệu tổng hợp được giữ tối đa 180 ngày.</footer>';
      host.querySelectorAll("[data-traffic-days]").forEach(button=>{
        button.addEventListener("click",()=>{state.days=Number(button.dataset.trafficDays);refresh()});
      });
      host.querySelector("[data-traffic-refresh]").addEventListener("click",refresh);
      refresh();
    },
    unmount(){state.token++;state.host=null},
    refresh
  };
})();