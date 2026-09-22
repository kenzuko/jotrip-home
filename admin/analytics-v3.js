(function(){
  const $=s=>document.querySelector(s);
  const $$=s=>Array.from(document.querySelectorAll(s));
  const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const S={period:"last7",view:"overview",loading:false,error:null,deps:null};

  function data(){return S.deps&&S.deps.getData?S.deps.getData():{}}
  function int(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("vi-VN").format(n):"—"}
  function pct(v,d=0){const n=Number(v);return Number.isFinite(n)?n.toFixed(d)+"%":"—"}
  function money(v){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat("vi-VN").format(n)+"đ":"—"}
  function day(v){if(!v)return"—";const p=String(v).split("-");return p.length===3?p[2]+"/"+p[1]:String(v)}
  function clock(v){
    if(!v)return"—";
    const d=new Date(v);
    if(!Number.isNaN(d.getTime()))return d.toLocaleTimeString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit"});
    const m=String(v).match(/(\d{1,2}:\d{2})/);return m?m[1]:String(v)
  }
  function localToday(){
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return m.year+"-"+m.month+"-"+m.day
  }
  function addDays(dayStr,n){
    const d=new Date(dayStr+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)
  }
  function rangeFor(period){
    const t=localToday();
    if(period==="yesterday")return{from:addDays(t,-1),to:addDays(t,-1)};
    if(period==="today")return{from:t,to:t};
    if(period==="last30")return{from:addDays(t,-29),to:t};
    return{from:addDays(t,-6),to:t}
  }
  function delta(cur,prev,noun){
    const a=Number(cur)||0,b=Number(prev)||0;
    if(!b)return a?noun+" có dữ liệu mới, chưa đủ kỳ trước để so.":"Chưa đủ dữ liệu "+noun.toLowerCase()+" để so kỳ trước.";
    const p=(a-b)/b*100;
    if(Math.abs(p)<1)return noun+" gần như đi ngang so với kỳ trước.";
    return noun+" "+(p>0?"tăng ":"giảm ")+Math.abs(p).toFixed(0)+"% so với kỳ trước."
  }
  function card(label,value,note,tone){
    return '<article class="a3-kpi '+(tone||"")+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note||"")+'</small></article>'
  }
  function shortInsights(d){
    const c=d.comparison||{},routeLoads=(d.sea&&d.sea.route_loads)||[],seaRoutes=(d.sea&&d.sea.route_volume)||[],airlines=(d.aviation&&d.aviation.airlines)||[],st=(d.aviation&&d.aviation.status_summary)||{};
    const bestLoad=routeLoads.filter(x=>Number.isFinite(Number(x.load_factor))).sort((a,b)=>Number(b.load_factor)-Number(a.load_factor))[0];
    const busiestSea=seaRoutes.slice().sort((a,b)=>Number(b.trips)-Number(a.trips))[0];
    const topAir=airlines[0];
    const arr=[
      delta(c.cur_sea_in,c.prev_sea_in,"Chuyến biển vào đảo"),
      delta(c.cur_air_in,c.prev_air_in,"Chuyến bay đến đảo")
    ];
    if(bestLoad)arr.push("Tuyến có % phủ cao nhất hiện thấy là "+bestLoad.origin+" → "+bestLoad.destination+" của "+bestLoad.operator+", khoảng "+pct(bestLoad.load_factor)+".");
    else if(busiestSea)arr.push("Tuyến biển có nhịp chạy nhiều nhất là "+busiestSea.origin+" → "+busiestSea.destination+" với "+int(busiestSea.trips)+" chuyến trong kỳ.");
    if(topAir)arr.push(topAir.airline+" đang có nhiều chuyến nhất trong dữ liệu kỳ này: "+int(topAir.flights)+" chuyến.");
    if(Number(st.cancelled)||Number(st.delayed))arr.push("Hàng không ghi nhận "+int(st.delayed)+" chuyến có tín hiệu trễ và "+int(st.cancelled)+" chuyến hủy trong kỳ.");
    return '<div class="a3-insights">'+arr.slice(0,5).map((x,i)=>'<article><b>'+(i+1)+'</b><p>'+esc(x)+'</p></article>').join("")+'</div>'
  }
  function path(vals,w,h,p,max){
    const step=vals.length>1?(w-p*2)/(vals.length-1):0;
    return vals.map((v,i)=>{const x=p+i*step,y=h-p-(Math.max(0,Number(v)||0)/Math.max(1,max))*(h-p*2);return(i?"L":"M")+x.toFixed(1)+" "+y.toFixed(1)}).join(" ")
  }
  function lineChart(rows,series){
    if(!rows||!rows.length)return'<div class="analytics-empty">Chưa đủ dữ liệu trong khoảng đã chọn.</div>';
    const w=760,h=220,p=30,max=Math.max(1,...series.flatMap(s=>rows.map(r=>Number(r[s.key])||0))),step=rows.length>1?(w-p*2)/(rows.length-1):0;
    const paths=series.map(s=>'<path class="'+esc(s.cls)+'" d="'+path(rows.map(r=>r[s.key]),w,h,p,max)+'"></path>').join("");
    const labels=rows.map((r,i)=>{if(rows.length>12&&i%Math.ceil(rows.length/8)!==0&&i!==rows.length-1)return"";return'<text x="'+(p+i*step).toFixed(1)+'" y="'+(h-5)+'" text-anchor="middle">'+esc(day(r.day))+'</text>'}).join("");
    return'<div class="a3-chart"><div class="a3-legend">'+series.map(s=>'<span><i class="'+esc(s.cls)+'"></i>'+esc(s.label)+'</span>').join("")+'</div><svg viewBox="0 0 '+w+' '+h+'"><line class="grid" x1="'+p+'" x2="'+(w-p)+'" y1="'+(h-p)+'" y2="'+(h-p)+'"></line>'+paths+labels+'</svg></div>'
  }
  function bars(rows,labelFn,valueKey,subFn){
    const list=(rows||[]).filter(x=>Number(x[valueKey])>0).slice(0,16);
    if(!list.length)return'<div class="analytics-empty">Chưa có dữ liệu phù hợp.</div>';
    const max=Math.max(1,...list.map(x=>Number(x[valueKey])||0));
    return'<div class="a3-bars">'+list.map(r=>{const v=Number(r[valueKey])||0;return'<div class="a3-bar-row"><div><strong>'+esc(labelFn(r))+'</strong><small>'+esc(subFn?subFn(r):"")+'</small></div><div class="a3-bar-track"><i style="width:'+Math.max(2,v/max*100)+'%"></i></div><b>'+esc(valueKey==="load_factor"?pct(v):int(v))+'</b></div>'}).join("")+'</div>'
  }
  function loadBars(rows,labelFn){
    const list=(rows||[]).filter(x=>Number.isFinite(Number(x.load_factor))).slice(0,16);
    if(!list.length)return'<div class="analytics-empty">Chưa có đủ capacity + remaining để tính % phủ.</div>';
    return'<div class="a3-bars">'+list.map(r=>{const v=Math.max(0,Math.min(100,Number(r.load_factor)||0));return'<div class="a3-bar-row"><div><strong>'+esc(labelFn(r))+'</strong><small>'+esc(int(r.load_trips)+" / "+int(r.trips)+" chuyến có %")+'</small></div><div class="a3-bar-track"><i style="width:'+v+'%"></i></div><b>'+esc(pct(v))+'</b></div>'}).join("")+'</div>'
  }
  function panel(kicker,title,body,note){
    return'<section class="analytics-panel a3-panel"><div class="analytics-panel-head"><div><span>'+esc(kicker)+'</span><h3>'+esc(title)+'</h3></div>'+(note?'<small>'+esc(note)+'</small>':"")+'</div>'+body+'</section>'
  }
  function tripTable(rows){
    const list=(rows||[]).slice(0,160);
    if(!list.length)return'<div class="analytics-empty">Chưa có lịch sử % phủ theo chuyến.</div>';
    return'<div class="analytics-table-wrap"><table class="analytics-table"><thead><tr><th>Ngày</th><th>Hãng</th><th>Tuyến</th><th>Giờ</th><th>Tàu</th><th>% phủ</th><th>Loại số</th></tr></thead><tbody>'+list.map(r=>'<tr><td>'+esc(day(r.service_date))+'</td><td><strong>'+esc(r.operator||"—")+'</strong></td><td>'+esc((r.origin||"—")+" → "+(r.destination||"—"))+'</td><td>'+esc(clock(r.departure_time))+'</td><td>'+esc(r.vessel||"—")+'</td><td><span class="analytics-load '+((Number(r.load_factor)>=85)?"hot":(Number(r.load_factor)>=65)?"warm":"calm")+'">'+esc(pct(r.load_factor))+'</span></td><td><small>'+esc(r.evidence_class==="observed"?"Observed":r.evidence_class==="estimated"?"Estimated":"Proxy")+'</small></td></tr>').join("")+'</tbody></table></div>'
  }
  function overview(d){
    const c=d.comparison||{},sea=d.sea||{},air=d.aviation||{},st=air.status_summary||{},best=(sea.route_loads||[]).filter(x=>Number.isFinite(Number(x.load_factor))).sort((a,b)=>Number(b.load_factor)-Number(a.load_factor))[0];
    const kpis='<div class="a3-kpis">'+
      card("Biển vào đảo",int(c.cur_sea_in)+" chuyến",delta(c.cur_sea_in,c.prev_sea_in,"So kỳ trước").replace("So kỳ trước ",""))+
      card("Bay đến đảo",int(c.cur_air_in)+" chuyến",delta(c.cur_air_in,c.prev_air_in,"So kỳ trước").replace("So kỳ trước ",""))+
      card("Phủ tuyến cao",best?pct(best.load_factor):"—",best?(best.origin+" → "+best.destination+" · "+best.operator):"Chưa đủ load data","accent")+
      card("Bất thường bay",int((Number(st.delayed)||0)+(Number(st.cancelled)||0)),int(st.delayed)+" trễ · "+int(st.cancelled)+" hủy",(Number(st.cancelled)||0)?"watch":"")+
      card("Khoảng phân tích",int((d.period||{}).days)+" ngày",day((d.period||{}).from)+" → "+day((d.period||{}).to))+
      '</div>';
    return shortInsights(d)+kpis+
      '<div class="analytics-grid-2 a3-grid">'+
        panel("SEA","Nhịp tàu/phà vào - ra",lineChart(d.trends||[],[{key:"sea_in",label:"Vào đảo",cls:"sea-in"},{key:"sea_out",label:"Rời đảo",cls:"sea-out"}]))+
        panel("AVIATION","Nhịp chuyến bay đến - đi",lineChart(d.trends||[],[{key:"air_in",label:"Bay đến",cls:"air-in"},{key:"air_out",label:"Bay đi",cls:"air-out"}]))+
      '</div>'+
      '<div class="analytics-grid-2 a3-grid">'+
        panel("ROUTES","Tuyến biển chạy nhiều",bars(sea.route_volume||[],r=>r.origin+" → "+r.destination,"trips",r=>r.operator))+
        panel("AIRLINES","Hãng bay nhiều chuyến",bars(air.airlines||[],r=>r.airline||"Chưa rõ hãng","flights",r=>int(r.arrivals)+" đến · "+int(r.departures)+" đi"))+
      '</div>'
  }
  function seaView(d){
    const sea=d.sea||{};
    return'<div class="analytics-grid-2 a3-grid">'+
      panel("LOAD FACTOR","% phủ theo tuyến",loadBars(sea.route_loads||[],r=>r.origin+" → "+r.destination), "Capacity-weighted")+
      panel("OPERATORS","% phủ theo hãng",loadBars(sea.operator_loads||[],r=>r.operator), "Chỉ hãng đủ dữ liệu")+
      '</div>'+
      panel("LOAD TREND","% phủ biển theo ngày",lineChart(sea.load_trends||[],[{key:"load_factor",label:"% phủ",cls:"sea-in"}]),"Aggregate proxy")+
      panel("VOLUME","Số chuyến theo tuyến",bars(sea.route_volume||[],r=>r.origin+" → "+r.destination,"trips",r=>r.operator))+
      panel("TRIP LOAD","% phủ từng chuyến",tripTable(sea.trip_loads||[]),"Observed / Estimated / Proxy")
  }
  function aviationView(d){
    const air=d.aviation||{},st=air.status_summary||{};
    const k='<div class="a3-kpis">'+
      card("Tổng chuyến",int(st.flights),"Trong khoảng đã chọn")+
      card("Tín hiệu trễ",int(st.delayed),"Theo trạng thái hiện có")+
      card("Hủy",int(st.cancelled),"Theo trạng thái hiện có",(Number(st.cancelled)||0)?"watch":"")+
      card("Trễ TB",Number.isFinite(Number(st.avg_delay_minutes))?Math.round(Number(st.avg_delay_minutes))+" phút":"—","Chỉ chuyến có delay_minutes")+
      '</div>';
    return k+
      panel("TREND","Chuyến bay đến - đi theo ngày",lineChart(d.trends||[],[{key:"air_in",label:"Bay đến",cls:"air-in"},{key:"air_out",label:"Bay đi",cls:"air-out"}]))+
      '<div class="analytics-grid-2 a3-grid">'+
        panel("AIRLINES","Số chuyến theo hãng",bars(air.airlines||[],r=>r.airline||"Chưa rõ hãng","flights",r=>int(r.arrivals)+" đến · "+int(r.departures)+" đi"))+
        panel("MARKETS","Điểm đi / đến",bars(air.stations||[],r=>r.station||"Chưa rõ","flights",r=>int(r.arrivals)+" đến · "+int(r.departures)+" đi"))+
      '</div>'+
      panel("LATEST","Snapshot hàng không mới nhất",S.deps.helpers.renderAviationTable(air.rows||[]))
  }
  function routesView(d){
    const sea=d.sea||{},air=d.aviation||{};
    return'<div class="analytics-grid-2 a3-grid">'+
      panel("SEA ROUTES","Tần suất tuyến biển",bars(sea.route_volume||[],r=>r.origin+" → "+r.destination,"trips",r=>r.operator))+
      panel("SEA LOAD","% phủ tuyến biển",loadBars(sea.route_loads||[],r=>r.origin+" → "+r.destination))+
      '</div>'+
      panel("AIR MARKETS","Điểm đi / đến hàng không",bars(air.stations||[],r=>r.station||"Chưa rõ","flights",r=>int(r.arrivals)+" đến · "+int(r.departures)+" đi"))
  }
  function operatorsView(d){
    const sea=d.sea||{},air=d.aviation||{};
    return'<div class="analytics-grid-2 a3-grid">'+
      panel("SEA OPERATORS","% phủ theo hãng tàu/phà",loadBars(sea.operator_loads||[],r=>r.operator))+
      panel("AIRLINES","Số chuyến theo hãng bay",bars(air.airlines||[],r=>r.airline||"Chưa rõ hãng","flights",r=>int(r.arrivals)+" đến · "+int(r.departures)+" đi"))+
      '</div>'
  }
  function dataView(d){
    return panel("DATA HEALTH","Nguồn & lưu trữ",S.deps.helpers.renderSync(d.sync||[],d.storage||{}), "Cập nhật "+S.deps.helpers.fmtDateTime(d.generated_at))+
      '<p class="analytics-note">'+esc(d.evidence_note||"")+'</p>'
  }
  function bodyForView(d){
    if(S.view==="sea")return seaView(d);
    if(S.view==="aviation")return aviationView(d);
    if(S.view==="routes")return routesView(d);
    if(S.view==="operators")return operatorsView(d);
    if(S.view==="data")return dataView(d);
    return overview(d)
  }
  function toolbar(d){
    const p=d.period||{},periods=[["yesterday","Hôm qua"],["today","Hôm nay"],["last7","7 ngày"],["last30","30 ngày"],["custom","Tùy chọn"]];
    return'<section class="a3-toolbar">'+
      '<div class="a3-periods">'+periods.map(x=>'<button type="button" data-a3period="'+x[0]+'" class="'+(S.period===x[0]?"active":"")+'">'+x[1]+'</button>').join("")+'</div>'+
      '<div class="a3-custom '+(S.period==="custom"?"":"hidden")+'"><label><span>Từ ngày</span><input id="a3From" type="date" value="'+esc(p.from||"")+'"></label><label><span>Đến ngày</span><input id="a3To" type="date" value="'+esc(p.to||"")+'"></label><button id="a3Apply" type="button">Áp dụng</button></div>'+
      '<div class="a3-view"><label><span>Phân tích</span><select id="a3View"><option value="overview">Tổng quan</option><option value="sea">Tàu & phà</option><option value="aviation">Hàng không</option><option value="routes">Tuyến</option><option value="operators">Hãng vận chuyển</option><option value="data">Data health</option></select></label><button id="a3Refresh" type="button">↻ Làm mới dữ liệu</button></div>'+
      '<small>'+esc(day(p.from)+" → "+day(p.to)+" · "+int(p.days)+" ngày")+'</small>'+
      '</section>'
  }
  function render(){
    if(!S.deps)return;
    const d=data(),host=document.querySelector("#editor");
    if(!host)return;
    host.classList.add("analytics-editor");
    host.innerHTML='<section class="analytics-head a3-head"><div><span>OPEN PHU QUOC INTELLIGENCE</span><h2>Demand & Operations</h2><p>Đọc nhanh xu hướng khách vào - ra đảo, rồi đi sâu theo tàu/phà, hàng không, tuyến và hãng.</p></div></section>'+
      toolbar(d)+
      (S.loading?'<div class="a3-loading">Đang tải và phân tích dữ liệu...</div>':S.error?'<div class="status-bar error">'+esc(S.error)+'</div>':bodyForView(d));
    bind();
    const view=document.querySelector("#a3View");if(view)view.value=S.view
  }
  function requestUrl(from,to,refresh){
    const q=new URLSearchParams();if(from)q.set("from",from);if(to)q.set("to",to);if(refresh)q.set("refresh","1");return S.deps.endpoint+"?"+q.toString()
  }
  async function load(from,to,refresh){
    S.loading=true;S.error=null;render();
    try{
      const next=await S.deps.api(requestUrl(from,to,refresh));
      S.deps.setData(next)
    }catch(e){S.error=e&&e.message?e.message:String(e)}
    finally{S.loading=false;render()}
  }
  function setPeriod(p){
    S.period=p;
    if(p==="custom"){render();return}
    const r=rangeFor(p);load(r.from,r.to,false)
  }
  function bind(){
    $$("#editor [data-a3period]").forEach(b=>b.onclick=()=>setPeriod(b.dataset.a3period));
    const apply=$("#a3Apply");if(apply)apply.onclick=()=>{const f=$("#a3From").value,t=$("#a3To").value;if(f&&t)load(f,t,false)};
    const view=$("#a3View");if(view)view.onchange=e=>{S.view=e.target.value;render()};
    const refresh=$("#a3Refresh");if(refresh)refresh.onclick=()=>{const d=data(),p=d.period||{};load(p.from,p.to,true)}
  }
  window.OPQAnalyticsV3={
    mount(deps){S.deps=deps;if(!S.period)S.period="last7";render()},
    refresh(){const d=data(),p=d.period||{};return load(p.from,p.to,true)},
    state:S
  }
})();