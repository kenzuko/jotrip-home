(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const zoneNames={zone_central_west:"Dương Đông & bờ Tây",zone_south:"An Thới & Nam đảo",zone_north:"Bắc đảo"};
  const state={config:null,entities:new Map(),notices:[],visuals:null,live:null,originZone:"zone_central_west"};

  function clock(){
    const d=new Date();
    const fmt=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false});
    const date=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"long",day:"2-digit",month:"2-digit"}).format(d);
    $("#goClock").textContent=fmt.format(d);$("#goDate").textContent=date;
  }
  async function json(path){const r=await fetch(path+(path.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error(path+" HTTP "+r.status);return r.json()}
  async function load(){
    const [config,places,activities,notices,visuals]=await Promise.all([
      json("../data/go-config.json"),json("../data/entities/places.json"),json("../data/entities/activities.json"),json("../data/operational-notices.json"),json("../data/visual-context.json").catch(()=>null)
    ]);
    state.config=config;state.notices=notices.notices||[];state.visuals=visuals;
    [...(places.entities||[]),...(activities.entities||[])].forEach(e=>state.entities.set(e.id,e));
    renderAreas();
    const params=new URLSearchParams(location.search);
    const available=params.get('available');
    const interest=params.get('interest');
    const origin=params.get('origin');
    for(const [name,value] of [['available',available],['interest',interest],['origin',origin]]){
      if(!value)continue;
      const input=[...document.querySelectorAll('#goForm input[name="'+name+'"]')].find(el=>el.value===value);
      if(input)input.checked=true;
    }
  }
  function renderAreas(){
    $("#areaChoices").innerHTML=(state.config.areas||[]).map((a,i)=>'<label><input type="radio" name="origin" value="'+esc(a.id)+'" '+(i===0?"checked":"")+'><span>'+esc(a.label)+'</span></label>').join("");
  }
  function selection(){
    const fd=new FormData($("#goForm"));
    return{originZone:String(fd.get("origin")||"zone_central_west"),available:String(fd.get("available")||"half"),interest:String(fd.get("interest")||"all")};
  }
  async function run(){
    const pick=selection();state.originZone=pick.originZone;
    $("#resultsSection").hidden=false;$("#goResults").innerHTML='<div class="go-empty"><strong>Để tụi mình xem nhé...</strong><span>Đang chọn những nơi còn đủ thời gian để ghé hôm nay.</span></div>';
    state.live=window.OpenPQGoLive?await window.OpenPQGoLive.load(pick.originZone).catch(()=>null):null;
    const view=window.OpenPQGoEngine.plan({config:state.config,entities:state.entities,notices:state.notices,live:state.live||{},now:new Date(),...pick});
    render(view,pick);
    $("#resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function liveNote(){
    if(!state.live)return"Chưa có đủ thông tin mới về thời tiết và biển. Nếu ra ngoài, bạn nhớ xem tình hình trước khi đi nhé.";
    const w=state.live.weather||{},c=state.live.cano||{};
    const weather=w.freshness==="fresh"||w.freshness==="aging"?(w.status==="normal"?"Thời tiết khu vực chưa có tín hiệu nổi bật.":"Thời tiết khu vực cần xem lại trước khi đi."):"Thời tiết chưa có cập nhật đủ mới.";
    const cano=["DIRECT_CONFIRMED","RUNNING"].includes(c.state)?"  Cano hôm nay đã có thông tin hoạt động.":c.state==="SUSPENDED"?" Cano hôm nay đang tạm dừng.":" Muốn đi biển? Nhớ kiểm tra lịch cano hôm nay.";
    return weather+cano;
  }
  function render(view,pick){
    $("#resultEyebrow").textContent=zoneNames[pick.originZone].toUpperCase()+" · "+view.now;
    $("#resultTitle").textContent=view.results.length?"Những nơi bạn có thể ghé hôm nay.":"Thử một lịch nhẹ nhàng hơn nhé.";
    $("#liveNote").textContent=liveNote();
    if(!view.results.length){
      $("#goResults").innerHTML='<div class="go-empty"><strong>Đừng cố nhét thêm lịch.</strong><span>Thử chọn thêm thời gian, đổi khu vực hoặc chọn “Tất cả”. Đừng chạy quá xa chỉ để cố ghép cho đủ lịch.</span></div>';
    }else{
      $("#goResults").innerHTML=view.results.map((x,i)=>{
        const warnings=(x.warnings||[]).map(w=>"<li>"+esc(w)+"</li>").join("");
        const images=state.visuals?.places?.[x.id]?.images||[];
        const image=images.find(v=>v.scope==="exact_subject"&&v.url)||images.find(v=>v.scope==="field_evidence"&&v.url)||images.find(v=>v.scope==="context"&&v.url)||images.find(v=>v.scope==="archive"&&v.url)||images.find(v=>v.url);
        const photo=image?'<div class="go-result-photo"><img loading="lazy" src="'+esc(image.url)+'" alt="'+esc(image.alt||x.name)+'"></div>':'<div class="go-result-photo"><div class="no-image">Đang bổ sung ảnh cho '+esc(x.name)+'</div></div>';
        const drive=x.travel?x.travel.low+"-"+x.travel.high+" phút":"Chưa rõ";
        return '<article class="go-result" data-state="'+esc(x.badge)+'">'+photo+
          '<div class="go-result-top"><span>0'+(i+1)+' · '+esc(x.category)+'</span><b class="go-badge">'+(x.badge==="POSSIBLE"?"CÒN KỊP":"CẦN KIỂM TRA")+'</b></div>'+
          '<h3>'+esc(x.name)+'</h3><p class="go-note">'+esc(x.note||"Một lựa chọn còn phù hợp với thời gian hiện tại.")+'</p>'+
          '<div class="go-timing"><strong>'+esc(x.timing)+'</strong><span>Dự kiến xong khoảng '+esc(x.finish_at)+'</span></div>'+
          '<div class="go-meta"><div><span>Đi từ khu hiện tại</span><b>'+esc(drive)+'</b></div><div><span>Dự kiến tới</span><b>'+esc(x.arrival)+'</b></div><div><span>Trước khi đi</span><b>Xem giờ & lưu ý mới nhất</b></div></div>'+
          (warnings?'<ul class="go-warnings">'+warnings+'</ul>':"")+
          '<a href="'+esc(x.route)+'">Xem chi tiết trước khi đi →</a></article>';
      }).join("");
    }

    const more=(view.remaining||[]).slice(0,6);
    const moreSection=$("#goMore"),moreGrid=$("#goMoreGrid");
    if(more.length){
      moreSection.hidden=false;
      moreGrid.innerHTML=more.map(x=>{
        const images=state.visuals?.places?.[x.id]?.images||[];
        const image=images.find(v=>v.scope==="exact_subject"&&v.url)||images.find(v=>v.scope==="field_evidence"&&v.url)||images.find(v=>v.scope==="context"&&v.url)||images.find(v=>v.scope==="archive"&&v.url)||images.find(v=>v.url);
        const drive=x.travel?x.travel.low+"-"+x.travel.high+" phút":"Chưa rõ";
        return '<a class="go-more-card" href="'+esc(x.route)+'">'+
          (image?'<img loading="lazy" src="'+esc(image.url)+'" alt="'+esc(image.alt||x.name)+'">':'<div class="go-more-placeholder">Đang bổ sung ảnh</div>')+
          '<div><span>'+esc(x.category)+'</span><strong>'+esc(x.name)+'</strong><small>'+esc(x.timing)+' · đi khoảng '+esc(drive)+'</small></div></a>';
      }).join("");
    }else{moreSection.hidden=true;moreGrid.innerHTML="";}
    const blocked=view.excluded||[];
    const box=$("#goExcluded");
    if(blocked.length){
      box.hidden=false;
      box.innerHTML='<strong>Một vài nơi chưa hợp lịch hôm nay</strong><p>'+esc(blocked.slice(0,5).map(x=>x.reason).filter((v,i,a)=>a.indexOf(v)===i).join(" · "))+'</p>';
    }else box.hidden=true;
  }
  $("#goForm").addEventListener("submit",e=>{e.preventDefault();run()});
  $("#changeChoices").addEventListener("click",()=>$(".go-builder").scrollIntoView({behavior:"smooth",block:"start"}));
  clock();setInterval(clock,30000);
  load().catch(e=>{$("#areaChoices").innerHTML='<div class="go-empty"><strong>Chưa tải được dữ liệu nền.</strong><span>'+esc(e.message)+'</span></div>'});
})();