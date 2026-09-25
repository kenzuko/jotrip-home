(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const zoneNames={zone_central_west:"Dương Đông & bờ Tây",zone_south:"An Thới & Nam đảo",zone_north:"Bắc đảo"};
  const state={config:null,entities:new Map(),notices:[],visuals:null,live:null,originZone:null,
    geo:null,radiusKm:10,mapRows:[],nearSupport:null,hasRun:false};

  const engine=()=>window.OpenPQGoEngine;
  function nearestZone(coords){
    const anchors={zone_central_west:{lat:10.2172,lon:103.9593},zone_south:{lat:10.0191,lon:104.015},zone_north:{lat:10.3759,lon:103.90}};
    return Object.entries(anchors).map(([id,p])=>({id,km:engine().distanceKm(coords,p)})).sort((a,b)=>a.km-b.km)[0].id;
  }
  function drawRadar(){
    if(!state.geo)return;
    $("#goRadar").hidden=false;
    $("#goRadarTitle").textContent="Quanh vị trí của bạn · "+state.radiusKm+" km";
    $("#goRadarAccuracy").textContent="Sai số GPS khoảng "+Math.ceil(state.geo.accuracy)+" m. Khoảng cách đường thẳng, không phải đường đi xe.";
    document.querySelectorAll("#goRadius [data-radius]").forEach(button=>{
      const active=Number(button.dataset.radius)===state.radiusKm;
      button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));
    });
    window.OpenPQGoRadar?.show({coords:state.geo,radiusKm:state.radiusKm,rows:state.mapRows});
  }
  function pickImage(id){
    const images=state.visuals?.places?.[id]?.images||[];
    return images.find(v=>v.scope==="exact_subject"&&v.url)||
      images.find(v=>v.scope==="field_evidence"&&v.url)||
      images.find(v=>v.scope==="context"&&v.url)||
      images.find(v=>v.scope==="archive"&&v.url)||images.find(v=>v.url);
  }
  function foodSection(pick){
    const food=$("#goFood");food.hidden=false;
    const support=state.nearSupport?.near_me||{};
    const labels={LOCAL_FOOD:"Quán ăn địa phương",RESTAURANT:"Nhà hàng",CAFE:"Cà phê"};
    const categories=(support.categories||[]).filter(x=>Object.hasOwn(labels,x.id));
    const current=state.mapRows.filter(p=>p.isFood&&(
      state.geo?engine().distanceKm(state.geo,p.map)<=state.radiusKm:
      (state.entities.get(p.id)?.zone_id===pick.originZone)
    )).map(p=>({...p,km:state.geo?engine().distanceKm(state.geo,p.map):null})).sort((a,b)=>(a.km??0)-(b.km??0)).slice(0,5);
    $("#goFoodNote").textContent=state.geo?
      "Những khu ăn uống đã có tọa độ trong "+state.radiusKm+" km. Giờ từng quán cần kiểm tra riêng.":
      "Các khu ăn uống đã có vị trí trong khu bạn chọn. Tìm thêm quán trên Near Me.";
    $("#goFoodGrid").innerHTML=current.length?current.map(p=>{
      const im=pickImage(p.id);
      return '<a class="go-food-card" href="'+esc(p.route)+'">'+(im?'<img loading="lazy" src="'+esc(im.url)+'" alt="'+esc(im.alt||p.name)+'">':'<div class="go-food-card-img">Phú Quốc</div>')+
        '<div><span>'+(p.id.startsWith("place_")?"KHU ĂN UỐNG":"ĐỊA ĐIỂM ĂN UỐNG")+'</span><strong>'+esc(p.name)+'</strong><small>'+(p.km!==null?p.km.toFixed(1)+" km đường thẳng":"Xem địa điểm")+'</small></div></a>';
    }).join(""):'<p class="go-food-empty">Trong phạm vi này chưa có quán ăn được xác minh tọa độ. Bạn có thể tìm trực tiếp qua Near Me bên dưới.</p>';
    const area=encodeURIComponent(pick.originZone);
    $("#goFoodActions").innerHTML=(categories.length?categories.map(c=>
      '<a href="../nearme/?area='+area+'&category='+encodeURIComponent(c.id)+'">'+esc(labels[c.id])+' ↗</a>').join(""):
      '<a href="../nearme/?area='+area+'&category=LOCAL_FOOD">Tìm quán ăn địa phương ↗</a>')+
      '<a href="../food/">Xem món ngon Phú Quốc ↗</a>';
  }
  function updatePlan(pick){
    const view=engine().plan({config:state.config,entities:state.entities,notices:state.notices,
      live:state.live||{},now:new Date(),...pick,originCoords:state.geo,radiusKm:state.geo?state.radiusKm:null});
    render(view,pick);foodSection(pick);
  }
  function locate(){
    const btn=$("#useLocation"),status=$("#goGeoStatus");
    if(!navigator.geolocation||!window.isSecureContext){
      status.textContent="Trình duyệt cần HTTPS và quyền vị trí. Bạn có thể chọn khu vực thủ công.";return;
    }
    btn.disabled=true;btn.textContent="Đang lấy vị trí...";status.textContent="Chỉ xin vị trí một lần khi bạn bấm nút này.";
    navigator.geolocation.getCurrentPosition(result=>{
      btn.disabled=false;btn.textContent="⌖ Cập nhật vị trí của tôi";
      const p={lat:result.coords.latitude,lon:result.coords.longitude,accuracy:result.coords.accuracy};
      if(!engine().islandLocation(p)){status.textContent="Vị trí đang ở ngoài khu vực Phú Quốc. Hãy chọn khu vực thủ công.";return}
      if(!Number.isFinite(p.accuracy)||p.accuracy>1000){status.textContent="Vị trí chưa đủ chính xác (sai số trên 1 km). Chọn khu vực hoặc thử lại.";return}
      state.geo=p;state.originZone=nearestZone(p);
      const input=[...document.querySelectorAll('#areaChoices input[name="origin"]')].find(el=>el.value===state.originZone);
      if(input)input.checked=true;
      status.textContent="Đã nhận vị trí (±"+Math.ceil(p.accuracy)+" m) · "+zoneNames[state.originZone]+". Bạn có thể đổi vùng bằng tay.";
      drawRadar();
      if(state.hasRun)updatePlan(selection());
    },err=>{
      btn.disabled=false;btn.textContent="⌖ Dùng vị trí của tôi";
      status.textContent=err.code===1?"Chưa được cấp quyền vị trí. Cứ chọn khu vực bên dưới nhé.":
        err.code===3?"Chưa lấy được vị trí kịp thời. Thử lại hoặc chọn khu vực.":
        "Chưa lấy được vị trí GPS. Bạn có thể chọn khu vực bên dưới.";
    },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  }
  function clock(){
    const d=new Date();
    const fmt=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false});
    const date=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"long",day:"2-digit",month:"2-digit"}).format(d);
    $("#goClock").textContent=fmt.format(d);$("#goDate").textContent=date;
  }
  async function json(path){const r=await fetch(path+(path.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});if(!r.ok)throw Error(path+" HTTP "+r.status);return r.json()}
  async function load(){
    const [config,places,activities,notices,visuals,index,nearSupport]=await Promise.all([
      json("../data/go-config.json"),json("../data/entities/places.json"),json("../data/entities/activities.json"),json("../data/operational-notices.json"),json("../data/visual-context.json").catch(()=>null),json("../data/views/location-index.json").catch(()=>null),json("../data/home-support.json").catch(()=>null)
    ]);
    state.config=config;state.notices=notices.notices||[];state.visuals=visuals;state.nearSupport=nearSupport;
    [...(places.entities||[]),...(activities.entities||[])].forEach(e=>state.entities.set(e.id,e));
    const indexed=new Map((index?.documents||[]).map(row=>[row.id,row]));
    for(const entity of state.entities.values()){
      const doc=indexed.get(entity.id);
      if(!entity.map&&doc?.map&&!((entity.id==="activity_hon_thom")||doc.inherited_from==="place_aquatopia")){
        entity.map={...doc.map,precision:doc.inherited_from?"area_anchor":doc.map.precision};
      }
    }
    const marketIds=new Set(["place_night_market","place_duong_dong_market"]);
    const foodGroups=new Set(["LOCAL_FOOD","RESTAURANT","CAFE"]);
    const points=[...state.entities.values()].filter(row=>row.map&&window.OpenPQGoEngine.islandLocation(row.map)&&row.map.verified_at)
      .map(row=>({id:row.id,name:row.name,route:"../places/detail.html?id="+encodeURIComponent(row.slug||row.legacy_id||row.id.replace(/^place_|^activity_/,"")),map:row.map,isFood:marketIds.has(row.id)}));
    for(const row of index?.documents||[]){
      if(row.entity_type!=="venue"||!row.map||!window.OpenPQGoEngine.islandLocation(row.map)||!row.map.verified_at)continue;
      if(![...(row.tags||[]),row.utility_type,row.group].some(tag=>foodGroups.has(tag)))continue;
      points.push({id:row.id,name:row.name,route:row.route||"../nearme/?category=LOCAL_FOOD",map:row.map,isFood:true});
    }
    state.mapRows=points;
    renderAreas();
    document.querySelector("#useLocation").disabled=false;
    if(state.geo)drawRadar();
    const params=new URLSearchParams(location.search);
    const available=params.get('available');
    const interest=params.get('interest');
    const origin=params.get('origin');
    for(const [name,value] of [['available',available],['interest',interest],['origin',origin]]){
      if(!value)continue;
      const input=[...document.querySelectorAll('#goForm input[name="'+name+'"]')].find(el=>el.value===value);
      if(input)input.checked=true;
    }
    if(origin&&document.querySelector("#areaChoices input:checked"))state.originZone=origin;
  }
  function renderAreas(){
    $("#areaChoices").innerHTML=(state.config.areas||[]).map((a,i)=>'<label><input type="radio" name="origin" value="'+esc(a.id)+'" '+(state.originZone===a.id?"checked":"")+'><span>'+esc(a.label)+'</span></label>').join("");
  }
  function selection(){
    const fd=new FormData($("#goForm"));
    return{originZone:String(fd.get("origin")||""),available:String(fd.get("available")||"half"),interest:String(fd.get("interest")||"all")};
  }
  async function run(){
    const pick=selection();
    if(!state.config){$("#goGeoStatus").textContent="Dữ liệu đang được tải. Bạn chờ một chút nhé.";return}
    if(!pick.originZone){$("#goGeoStatus").textContent="Chọn khu vực bạn đang ở hoặc bấm 'Dùng vị trí của tôi' nhé.";
      $("#areaChoices input")?.focus();return}
    state.originZone=pick.originZone;
    $("#resultsSection").hidden=false;$("#goResults").innerHTML='<div class="go-empty"><strong>Để tụi mình xem nhé...</strong><span>Đang chọn những nơi còn đủ thời gian để ghé hôm nay.</span></div>';
    state.live=window.OpenPQGoLive?await window.OpenPQGoLive.load(pick.originZone).catch(()=>null):null;
    state.hasRun=true;updatePlan(pick);
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
        const image=pickImage(x.id);
        const photo=image?'<div class="go-result-photo"><img loading="lazy" src="'+esc(image.url)+'" alt="'+esc(image.alt||x.name)+'"></div>':'<div class="go-result-photo"><div class="no-image">Đang bổ sung ảnh cho '+esc(x.name)+'</div></div>';
        const drive=x.travel?x.travel.low+"-"+x.travel.high+" phút (ước lượng)":"Chưa rõ";
        const distance=x.geoDistanceKm!==null&&x.geoDistanceKm!==undefined?x.geoDistanceKm.toFixed(1)+" km đường thẳng":null;
        return '<article class="go-result" data-state="'+esc(x.badge)+'">'+photo+
          '<div class="go-result-top"><span>0'+(i+1)+' · '+esc(x.category)+'</span><b class="go-badge">'+(x.badge==="POSSIBLE"?"CÒN KỊP":"CẦN KIỂM TRA")+'</b></div>'+
          '<h3>'+esc(x.name)+'</h3><p class="go-note">'+esc(x.note||"Một lựa chọn còn phù hợp với thời gian hiện tại.")+'</p>'+
          '<div class="go-timing"><strong>'+esc(x.timing)+'</strong><span>Dự kiến xong khoảng '+esc(x.finish_at)+'</span></div>'+
          '<div class="go-meta"><div><span>Thời gian đi dự kiến</span><b>'+esc(drive)+'</b></div>'+(distance?'<div><span>Đường thẳng từ bạn</span><b>'+esc(distance)+'</b></div>':'')+'<div><span>Dự kiến tới</span><b>'+esc(x.arrival)+'</b></div></div>'+
          (warnings?'<ul class="go-warnings">'+warnings+'</ul>':"")+
          '<a href="'+esc(x.route)+'">Xem chi tiết trước khi đi →</a></article>';
      }).join("");
    }

    const more=(view.remaining||[]).slice(0,6);
    const moreSection=$("#goMore"),moreGrid=$("#goMoreGrid");
    if(more.length){
      moreSection.hidden=false;
      moreGrid.innerHTML=more.map(x=>{
        const image=pickImage(x.id);
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
  $("#useLocation").addEventListener("click",locate);
  $("#areaChoices").addEventListener("change",e=>{
    if(e.target?.name!=="origin")return;
    if(state.geo){state.geo=null;$("#goRadar").hidden=true;window.OpenPQGoRadar?.clear();
      $("#useLocation").textContent="⌖ Dùng vị trí của tôi";}
    state.originZone=e.target.value;
    $("#goGeoStatus").textContent="Đang chọn "+zoneNames[state.originZone]+". Muốn xem km thực tế? Bấm dùng vị trí.";
    if(state.hasRun)updatePlan(selection());
  });
  $("#goRadius").addEventListener("click",e=>{
    const button=e.target.closest("button[data-radius]");if(!button||!state.geo)return;
    state.radiusKm=Number(button.dataset.radius);
    drawRadar();if(state.hasRun)updatePlan(selection());
  });
  clock();setInterval(clock,30000);
  load().catch(e=>{$("#areaChoices").innerHTML='<div class="go-empty"><strong>Chưa tải được dữ liệu nền.</strong><span>'+esc(e.message)+'</span></div>'});
})();