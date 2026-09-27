(function(){
"use strict";
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=x=>new Intl.NumberFormat("vi-VN").format(Number(x)||0);
const displayDate=day=>{const p=String(day||"").split("-");return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:day||"—"};
const localDay=()=>{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+"-"+p.month+"-"+p.day;
};
const offset=(day,n)=>new Date(Date.parse(day+"T00:00:00Z")+n*86400000).toISOString().slice(0,10);
const channels={search:"Tìm kiếm",ai:"Trợ lý AI",social:"Mạng xã hội",direct:"Trực tiếp",referral:"Trang khác",internal:"Liên kết nội bộ"};
const actions={go_open:"Mở GO",nearme_open:"Mở Near Me",weather_open:"Mở thời tiết",airport_open:"Mở sân bay",transit_open:"Mở tàu xe",feedback_open:"Mở góp ý"};
const groups={home:"Trang chủ",guide:"Cẩm nang",stories:"Bài viết",go:"GO",nearme:"Near Me",weather:"Thời tiết",airport:"Sân bay",transit:"Đi lại",other:"Trang khác"};
const state={host:null,period:"7d",group:"auto",from:offset(localDay(),-6),to:localDay(),channel:"all",country:"ALL",device:"all",pageGroup:"all",action:"all",sort:"hits_desc",q:"",compare:true,token:0,data:null,controller:null};
const select=(id,label,values,current)=>'<label class="traffic-filter"><span>'+esc(label)+'</span><select id="'+id+'">'+values.map(([value,text])=>'<option value="'+value+'"'+(current===value?" selected":"")+'>'+esc(text)+'</option>').join("")+'</select></label>';
const errorHtml=msg=>'<div class="traffic-failure" role="alert"><strong>'+esc(msg)+'</strong><p>Dữ liệu đã ghi không bị thay đổi. Hãy thử lại hoặc chọn khoảng thời gian ngắn hơn.</p></div>';
const empty=text=>'<p class="traffic-empty">'+esc(text||"Chưa có số liệu phù hợp với bộ lọc này.")+'</p>';
const card=(heading,note,inner)=>'<section class="traffic-panel"><div class="traffic-panel-head"><h3>'+esc(heading)+'</h3><p>'+esc(note)+'</p></div>'+inner+'</section>';
function diffText(comparison,key){
  if(!comparison)return "Toàn bộ lịch sử";
  if(!comparison.available)return "Chưa đủ dữ liệu so sánh";
  const current=key==="page_views"?comparison.page_views_change_pct:comparison.actions_change_pct;
  const previous=key==="page_views"?comparison.page_views:comparison.actions;
  if(current===null)return "Kỳ trước: "+fmt(previous)+" · Chưa tính %";
  return (current>0?"+":"")+new Intl.NumberFormat("vi-VN",{maximumFractionDigits:1}).format(current)+"% so với kỳ trước";
}
const kpi=(label,value,note,change)=>'<article class="traffic-kpi"><span>'+esc(label)+'</span><strong>'+fmt(value)+'</strong><small>'+esc(note)+'</small>'+(change?'<em class="traffic-kpi-diff">'+esc(change)+'</em>':"")+'</article>';
function countryName(code){
  if(code==="XX")return "Không xác định";
  try{return new Intl.DisplayNames(["vi"],{type:"region"}).of(code)||code}catch{return code}
}
function bars(list,key,labels,emptyMessage){
  if(!list?.length)return empty(emptyMessage);
  const max=Math.max(1,...list.map(x=>Number(x.hits)||0));
  return '<div class="traffic-bars">'+list.map(row=>{
    const raw=row[key]||"Không rõ",name=typeof labels==="function"?labels(raw):labels?.[raw]||raw;
    const hits=Number(row.hits)||0;
    return '<div class="traffic-bar-row"><span title="'+esc(name)+'">'+esc(name)+'</span>'+
      '<div class="traffic-track"><i style="width:'+Math.max(1,hits/max*100).toFixed(1)+'%"></i></div>'+
      '<strong>'+fmt(hits)+'</strong></div>';
  }).join("")+"</div>";
}
function periodLabel(period){
  const p=String(period||"");
  if(/^\d{4}-\d{2}-\d{2}$/.test(p))return p.slice(8)+"/"+p.slice(5);
  if(/^\d{4}-\d{2}$/.test(p))return p.slice(5)+"/"+p.slice(0,4);
  return p;
}
function trend(data){
  const rows=data.trend||[];
  if(!rows.length)return empty("Chưa có lượt xem ở kỳ này.");
  const max=Math.max(1,...rows.map(x=>x.hits||0));
  return '<div class="traffic-trend traffic-longterm-trend" role="img" aria-label="Biểu đồ lượt xem theo '+esc(data.grain==='year'?"năm":data.grain==="month"?"tháng":"ngày")+'">'+
    rows.map(row=>{
      const hits=Number(row.hits)||0;
      return '<div class="traffic-trend-cell" title="'+esc(periodLabel(row.period)+": "+fmt(hits)+" lượt xem")+'">'+
        '<span class="traffic-trend-value">'+fmt(hits)+'</span>'+
        '<i style="height:'+Math.max(2,100*hits/max).toFixed(1)+'%"></i>'+
        '<small>'+esc(periodLabel(row.period))+'</small></div>';
    }).join("")+'</div><p class="traffic-panel-foot">Tổng hợp theo '+(data.grain==="year"?"năm":data.grain==="month"?"tháng":"ngày")+' · Múi giờ Việt Nam. Các mốc không có lượt xem không xuất hiện.</p>';
}
function linkLabel(path){
  if(path==="/")return "Trang chủ";
  for(const [p,label] of [["/guide","Cẩm nang"],["/stories","Bài viết"],["/go","GO"],["/nearme","Near Me"],["/airport","Sân bay"],["/weather","Thời tiết"],["/transit","Đi lại"]])
    if(path.startsWith(p))return label+" · "+path;
  return path;
}
function pages(rows){
  if(!rows?.length)return empty("Chưa có bài hoặc trang phù hợp.");
  return '<div class="traffic-page-list">'+rows.map((r,i)=>
    '<div class="traffic-page-row"><b>'+String(i+1).padStart(2,"0")+'</b><div><a target="_blank" rel="noopener noreferrer" href="'+esc(r.path)+'" title="'+esc(r.path)+'">'+esc(linkLabel(r.path))+'</a></div><strong>'+fmt(r.hits)+'</strong></div>'
  ).join("")+'</div><p class="traffic-panel-foot">Hiển thị tối đa 50 trang. Xuất CSV để lưu đầy đủ dữ liệu tổng hợp.</p>';
}
function render(data){
  if(!state.host)return;
  state.data=data;
  const list=k=>data[k]||[];
  const from=displayDate(data.from),to=displayDate(data.to);
  const search=list("channels").find(r=>r.channel==="search")?.hits||0;
  const ai=list("channels").find(r=>r.channel==="ai")?.hits||0;
  const updated=data.updated_at?new Date(data.updated_at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}):"—";
  state.host.querySelector("#trafficBody").innerHTML=
    '<div class="traffic-kpis">'+kpi("Lượt xem",data.total_page_views,"Lượt tải trang, không phải số người",diffText(data.comparison,"page_views"))+
    kpi("Từ tìm kiếm",search,"Google và các công cụ tìm kiếm",null)+
    kpi("Từ trợ lý AI",ai,"Chỉ tính khi có nguồn giới thiệu",null)+
    kpi("Tương tác",data.total_actions,"Số lần mở tính năng",diffText(data.comparison,"actions"))+'</div>'+
    '<p class="traffic-description">Từ '+esc(from)+' đến '+esc(to)+(data.first_day?' · Bắt đầu lưu: '+esc(displayDate(data.first_day)):" · Chưa có dữ liệu lưu")+' · Cập nhật: '+esc(updated)+'</p>'+
    (data.comparison?.available?'<div class="traffic-compare">So sánh với '+esc(displayDate(data.comparison.from))+' - '+esc(displayDate(data.comparison.to))+': <b>'+fmt(data.comparison.page_views)+' lượt xem</b> và <b>'+fmt(data.comparison.actions)+' tương tác</b> ở kỳ trước.</div>':
      data.comparison?'<div class="traffic-compare traffic-compare-muted">'+esc(data.comparison.reason||"Chưa đủ dữ liệu để so sánh.")+'</div>':"")+
    '<div class="traffic-grid">'+
      card("Nhịp truy cập","Xu hướng theo ngày, tháng hoặc năm",trend(data))+
      card("Khách đến từ đâu?","Kênh truy cập theo bộ lọc đã chọn",bars(list("channels"),"channel",channels))+
      card("Những trang được xem","Sắp xếp theo lựa chọn của cậu",pages(list("pages")))+
      card("Khách sử dụng gì?","Mở tính năng GO, Near Me và các tiện ích",bars(list("actions"),"event",actions))+
      card("Nguồn giới thiệu","Chỉ ghi tên miền đã rút gọn",bars(list("referrers"),"ref_domain"))+
      card("Khu vực truy cập","Quốc gia theo dữ liệu tổng hợp Cloudflare",bars(list("countries"),"country",countryName))+
      card("Thiết bị","Phân loại ước tính, không theo dõi thiết bị cụ thể",bars(list("devices"),"device",{desktop:"Máy tính",mobile:"Điện thoại",tablet:"Máy tính bảng",other:"Khác"}))+
      card("Nhóm nội dung","Các nhóm trang được khách mở",bars(list("pageGroups"),"label",groups))+
    '</div>';
}
function params(format){
  const qs=new URLSearchParams({period:state.period,group:state.group,channel:state.channel,
    country:state.country,device:state.device,page_group:state.pageGroup,action:state.action,sort:state.sort});
  if(state.q)qs.set("q",state.q);
  if(state.period==="custom"){qs.set("from",state.from);qs.set("to",state.to)}
  if(state.period==="custom"&&state.compare)qs.set("compare","1");
  if(format)qs.set("format",format);
  return qs;
}
function updateControls(){
  const host=state.host;if(!host)return;
  host.querySelectorAll("[data-traffic-period]").forEach(btn=>{
    const active=btn.dataset.trafficPeriod===state.period;
    btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active));
  });
  host.querySelector("#trafficCustom").hidden=state.period!=="custom";
  host.querySelector("#trafficFrom").value=state.from;
  host.querySelector("#trafficTo").value=state.to;
  host.querySelector("#trafficCompare").checked=state.compare&&state.period!=="all";
  host.querySelector("#trafficCompare").disabled=state.period==="all";
}
async function load(){
  const host=state.host;if(!host)return;
  state.controller?.abort();
  const controller=new AbortController();state.controller=controller;
  const version=++state.token;
  updateControls();
  host.querySelector("#trafficBody").innerHTML='<p class="traffic-loading" role="status">Đang tổng hợp lịch sử truy cập...</p>';
  host.querySelector("#trafficStatus").textContent="";
  try{
    const response=await fetch("/api/cms/traffic?"+params(),{credentials:"include",cache:"no-store",signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.error||"HTTP "+response.status);
    if(state.host===host&&state.token===version)render(data);
  }catch(e){
    if(e.name==="AbortError")return;
    if(state.host===host&&state.token===version)host.querySelector("#trafficBody").innerHTML=errorHtml(e.message||"Không tải được báo cáo.");
  }
}
async function download(){
  const host=state.host;if(!host)return;
  const button=host.querySelector("#trafficExport"),status=host.querySelector("#trafficStatus");
  button.disabled=true;status.textContent="Đang chuẩn bị CSV...";
  try{
    const response=await fetch("/api/cms/traffic?"+params("csv"),{credentials:"include",cache:"no-store"});
    if(!response.ok){const problem=await response.json().catch(()=>({}));throw Error(problem.error||"Không tải được CSV ("+response.status+")")}
    const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
    const match=/filename="([^"]+)"/.exec(response.headers.get("content-disposition")||"");
    a.href=url;a.download=match?.[1]||"openpq-analytics.csv";document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    status.textContent="Đã tạo bản CSV. Hãy lưu thêm một bản ngoài website.";
  }catch(e){status.textContent=e?.message||"Không xuất được báo cáo."}
  finally{button.disabled=false}
}
function change(event){
  const id=event.target.id,value=event.target.value;
  if(id==="trafficGroup"){state.group=value;load()}
  if(id==="trafficChannel"){state.channel=value;load()}
  if(id==="trafficCountry"){state.country=value.trim().toUpperCase()||"ALL";load()}
  if(id==="trafficDevice"){state.device=value;load()}
  if(id==="trafficPageGroup"){state.pageGroup=value;load()}
  if(id==="trafficAction"){state.action=value;load()}
  if(id==="trafficSort"){state.sort=value;load()}
  if(id==="trafficCompare"){state.compare=event.target.checked;load()}
}
function click(event){
  const btn=event.target.closest("button");if(!btn)return;
  if(btn.dataset.trafficPeriod){
    state.period=btn.dataset.trafficPeriod;
    if(state.period==="custom"&&state.to<state.from){state.to=localDay();state.from=offset(state.to,-29)}
    if(state.period==="all")state.compare=false;
    else if(state.period!=="custom")state.compare=true;
    load();return;
  }
  if(btn.id==="trafficApply"){
    const from=state.host.querySelector("#trafficFrom").value,to=state.host.querySelector("#trafficTo").value;
    if(!from||!to||from>to){state.host.querySelector("#trafficStatus").textContent="Chọn khoảng ngày hợp lệ.";return}
    state.period="custom";state.from=from;state.to=to;load();return;
  }
  if(btn.id==="trafficFilterPath"){state.q=state.host.querySelector("#trafficPath").value.trim();load();return}
  if(btn.id==="trafficClear"){
    state.channel="all";state.country="ALL";state.device="all";state.pageGroup="all";state.action="all";state.sort="hits_desc";state.q="";state.group="auto";
    state.host.querySelector("#trafficCountry").value="";state.host.querySelector("#trafficPath").value="";
    for(const [id,v] of [["trafficChannel","all"],["trafficDevice","all"],["trafficPageGroup","all"],["trafficAction","all"],["trafficSort","hits_desc"],["trafficGroup","auto"]])state.host.querySelector("#"+id).value=v;
    load();return;
  }
  if(btn.id==="trafficExport"){download();return}
  if(btn.id==="trafficRefresh")load();
}
function mount({host}){
  if(!host)return;
  unmount();
  state.host=host;
  host.classList.add("traffic-editor");
  const today=localDay();
  host.innerHTML='<div class="traffic-head"><div><span>OPEN PHU QUOC · CHỈ CHỦ SỞ HỮU</span><h2>Lịch sử truy cập</h2><p>Dữ liệu được lưu dài hạn để cậu theo dõi website lớn lên qua từng tháng, từng năm.</p></div>'+
    '<div class="traffic-toolbar" role="group" aria-label="Khoảng thời gian">'+
    [["7d","7 ngày"],["30d","30 ngày"],["90d","90 ngày"],["365d","1 năm"],["all","Tất cả"],["custom","Tùy chọn"]].map(([value,label])=>
      '<button type="button" data-traffic-period="'+value+'">'+label+'</button>').join("")+
    '</div></div>'+
    '<div class="traffic-filter-shell"><div class="traffic-custom" id="trafficCustom" hidden>'+
      '<label class="traffic-filter"><span>Từ ngày</span><input id="trafficFrom" type="date" max="'+today+'"></label>'+
      '<label class="traffic-filter"><span>Đến ngày</span><input id="trafficTo" type="date" max="'+today+'"></label>'+
      '<button type="button" id="trafficApply">Áp dụng ngày</button></div>'+
    '<div class="traffic-filter-grid">'+
      select("trafficChannel","Nguồn khách",[["all","Tất cả nguồn"],["search","Tìm kiếm"],["ai","Trợ lý AI"],["social","Mạng xã hội"],["direct","Trực tiếp"],["referral","Trang khác"],["internal","Nội bộ"]],state.channel)+
      select("trafficPageGroup","Nhóm trang",[["all","Mọi nhóm"],...Object.entries(groups)],state.pageGroup)+
      select("trafficDevice","Thiết bị",[["all","Mọi thiết bị"],["mobile","Điện thoại"],["desktop","Máy tính"],["tablet","Máy tính bảng"],["other","Khác"]],state.device)+
      select("trafficAction","Hành động",[["all","Mọi hành động"],...Object.entries(actions)],state.action)+
      select("trafficSort","Sắp xếp",[["hits_desc","Nhiều nhất"],["hits_asc","Ít nhất"],["name_asc","Tên A - Z"],["name_desc","Tên Z - A"]],state.sort)+
      select("trafficGroup","Biểu đồ",[["auto","Tự động"],["day","Theo ngày"],["month","Theo tháng"],["year","Theo năm"]],state.group)+
      '<label class="traffic-filter"><span>Quốc gia</span><input id="trafficCountry" placeholder="Tất cả hoặc VN, KR, RU..." maxlength="2" value="'+(state.country==="ALL"?"":esc(state.country))+'"></label>'+
      '<label class="traffic-filter traffic-path-filter"><span>Tìm đường dẫn</span><div><input id="trafficPath" type="search" maxlength="80" placeholder="/guide/, /go/..." value="'+esc(state.q)+'"><button type="button" id="trafficFilterPath">Lọc</button></div></label>'+
    '</div>'+
    '<div class="traffic-filter-footer"><label class="traffic-compare-toggle"><input type="checkbox" id="trafficCompare"> So sánh cùng độ dài kỳ trước</label>'+
      '<div class="traffic-filter-actions"><button type="button" id="trafficClear">Xóa bộ lọc</button><button type="button" id="trafficRefresh">↻ Cập nhật</button><button type="button" id="trafficExport" class="traffic-export">↓ Xuất CSV</button></div></div>'+
    '<p id="trafficStatus" aria-live="polite" class="traffic-status"></p></div>'+
    '<div id="trafficBody" aria-live="polite"></div>'+
    '<footer class="traffic-privacy">Chỉ tài khoản chủ sở hữu CMS được xem. Dữ liệu tổng hợp lưu dài hạn trong D1, không đặt lịch tự xóa. Không lưu IP, GPS, cookie hay danh tính khách. Nên xuất CSV định kỳ để có bản sao dự phòng của riêng cậu.</footer>';
  host.addEventListener("change",change);
  host.addEventListener("click",click);
  host.querySelector("#trafficPath").addEventListener("keydown",ev=>{if(ev.key==="Enter"){ev.preventDefault();state.q=ev.target.value.trim();load()}});
  updateControls();load();
}
function unmount(){
  if(!state.host)return;
  state.controller?.abort();state.token++;
  state.host.removeEventListener("change",change);
  state.host.removeEventListener("click",click);
  state.host=null;
}
window.OPQTrafficDashboard={mount,unmount,refresh:load};
})();