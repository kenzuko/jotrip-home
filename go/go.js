(() => {
  "use strict";
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const zoneNames={zone_central_west:"Dương Đông & bờ Tây",zone_south:"An Thới & Nam đảo",zone_north:"Bắc đảo"};
  const state={config:null,entities:new Map(),notices:[],visuals:null,live:null,originZone:null,position:null,radiusKm:5,mapOverview:false,locationIndex:[],venueDirectory:[],runId:0};

  function clock(){
    const d=new Date();
    const fmt=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",minute:"2-digit",hour12:false});
    const date=new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",weekday:"long",day:"2-digit",month:"2-digit"}).format(d);
    $("#goClock").textContent=fmt.format(d);$("#goDate").textContent=date;
  }
  async function json(path){const r=await fetch(path,{cache:"default"});if(!r.ok)throw Error(path+" HTTP "+r.status);return r.json()}
  async function load(){
    const [config,places,activities,notices,visuals,locationIndex,venueDirectory]=await Promise.all([
      json("../data/go-config.json"),json("../data/entities/places.json"),json("../data/entities/activities.json"),json("../data/operational-notices.json"),json("../data/visual-context.json").catch(()=>null),json("../data/views/location-index.json").catch(()=>({documents:[]})),json("../data/entities/destination-venues.json").catch(()=>({entities:[]}))
    ]);
    state.config=config;state.notices=notices.notices||[];state.visuals=visuals;state.locationIndex=locationIndex.documents||[];state.venueDirectory=venueDirectory.entities||[];
    [...(places.entities||[]),...(activities.entities||[])].forEach(e=>state.entities.set(e.id,e));
    renderAreas();
    drawMap();
  }
  function renderAreas(){
    // The three manual choices are present in the HTML before any network response.
    // Update wording from the canonical config, but never replace or hide the controls.
    for(const area of state.config?.areas||[]){
      const input=[...document.querySelectorAll('#areaChoices input[name="origin"]')]
        .find(item=>item.value===area.id);
      if(input?.nextElementSibling)input.nextElementSibling.textContent=area.label;
    }
  }
  function applyDeepLink(){
    const params=new URLSearchParams(location.search);
    const context=window.OpenPQArea;
    if(!params.has("origin")){
      const remembered=context?.zone(context.get());
      if(remembered){const chosen=[...document.querySelectorAll('#goForm input[name="origin"]')].find(x=>x.value===remembered);
        if(chosen){chosen.checked=true;state.originZone=remembered;}}
    }
    for(const name of ["available","interest","origin"]){
      const value=params.get(name);
      if(!value)continue;
      const input=[...document.querySelectorAll('#goForm input[name="'+name+'"]')]
        .find(item=>item.value===value);
      if(input){
        input.checked=true;
        if(name==="origin"){state.originZone=value;window.OpenPQArea?.set(value,"go-link");}
      }
    }
  }
  function selection(){
    const fd=new FormData($("#goForm"));
    return{originZone:String(fd.get("origin")||""),available:String(fd.get("available")||"half"),interest:String(fd.get("interest")||"all"),position:state.position,radiusKm:state.position?state.radiusKm:null};
  }
  async function run(){
    const pick=selection();
    if(!pick.originZone){$("#goLocationStatus").textContent="Chọn khu vực bạn đang ở hoặc bấm dùng vị trí của tôi trước nhé.";$(".go-area-row").scrollIntoView({behavior:"smooth",block:"center"});return;}
    state.originZone=pick.originZone;
    if(!state.config){
      $("#goLocationStatus").textContent="Đang tải các điểm đến. Bạn có thể chọn khu vực và xem bản đồ trước nhé.";
      return;
    }
    const runId=++state.runId;
    $("#resultsSection").hidden=false;$("#goResults").innerHTML='<div class="go-empty"><strong>Để tụi mình xem nhé...</strong><span>Đang chọn những nơi còn đủ thời gian để ghé hôm nay.</span></div>';
    state.live=window.OpenPQGoLive?await window.OpenPQGoLive.load(pick.originZone).catch(()=>null):null;
    if(runId!==state.runId)return;
    const baseView=window.OpenPQGoEngine.plan({config:state.config,entities:state.entities,notices:state.notices,live:state.live||{},now:new Date(),...pick});
    const requests=window.OpenPQGoEngine.weatherWindowItems(baseView,state.config,state.entities);
    const initialView=window.OpenPQGoEngine.applyWeatherContext(baseView,null,{pending:requests.length>0});
    render(initialView,pick);
    $("#resultsSection").scrollIntoView({behavior:"smooth",block:"start"});
    if(requests.length){
      const client=window.OpenPQWeatherContext;
      if(!client?.requestWindows){
        render(window.OpenPQGoEngine.applyWeatherContext(baseView,{source_status:"UNAVAILABLE",items:[]}),pick);
      }else{
        client.requestWindows(requests,{timeoutMs:11500}).then(payload=>{
          if(runId!==state.runId)return;
          render(window.OpenPQGoEngine.applyWeatherContext(baseView,payload),pick);
        }).catch(()=>{
          if(runId!==state.runId)return;
          render(window.OpenPQGoEngine.applyWeatherContext(baseView,{source_status:"UNAVAILABLE",items:[]}),pick);
        });
      }
    }
  }
  function liveNote(){
    if(!state.live)return"Chưa có đủ thông tin mới về thời tiết và biển. Nếu ra ngoài, bạn nhớ xem tình hình trước khi đi nhé.";
    const w=state.live.weather||{},c=state.live.cano||{};
    const weather=w.freshness==="fresh"||w.freshness==="aging"?(w.status==="normal"?"Thời tiết khu vực chưa có tín hiệu nổi bật.":"Thời tiết khu vực cần xem lại trước khi đi."):"Thời tiết chưa có cập nhật đủ mới.";
    const cano=["DIRECT_CONFIRMED","RUNNING"].includes(c.state)?"  Cano hôm nay đã có thông tin hoạt động.":c.state==="SUSPENDED"?" Cano hôm nay đang tạm dừng.":" Muốn đi biển? Nhớ kiểm tra lịch cano hôm nay.";
    return weather+cano;
  }
  function render(view,pick){
    $("#resultEyebrow").textContent=(state.position?"QUANH VỊ TRÍ CỦA BẠN · "+state.radiusKm+" KM":zoneNames[pick.originZone].toUpperCase())+" · "+view.now;
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
        const drive=x.travel?x.travel.low+"-"+x.travel.high+" phút (ước lượng theo vùng)":"Chưa rõ";
        const km=x.distance_km!==null&&x.distance_km!==undefined?x.distance_km.toFixed(1)+" km đường chim bay":null;
        return '<article class="go-result" data-state="'+esc(x.badge)+'">'+photo+
          '<div class="go-result-top"><span>0'+(i+1)+' · '+esc(x.category)+'</span><b class="go-badge">'+(x.badge==="POSSIBLE"?"CÒN KỊP":"CẦN KIỂM TRA")+'</b></div>'+
          '<h3>'+esc(x.name)+'</h3><p class="go-note">'+esc(x.note||"Một lựa chọn còn phù hợp với thời gian hiện tại.")+'</p>'+
          '<div class="go-timing"><strong>'+esc(x.timing)+'</strong><span>Dự kiến xong khoảng '+esc(x.finish_at)+'</span></div>'+
          '<div class="go-meta">'+(km?'<div><span>Cách bạn</span><b>'+esc(km)+'</b></div>':'')+'<div><span>Đi từ khu hiện tại</span><b>'+esc(drive)+'</b></div><div><span>Dự kiến tới</span><b>'+esc(x.arrival)+'</b></div><div><span>Trước khi đi</span><b>Xem giờ & lưu ý mới nhất</b></div></div>'+
          (warnings?'<ul class="go-warnings">'+warnings+'</ul>':"")+
          '<a href="'+esc(x.route)+'"'+(x.id==="activity_big_game_fishing"?' target="_blank" rel="noopener noreferrer"':"")+'>'+(x.id==="activity_big_game_fishing"?"Xem tour câu cá JoTrip ↗":"Xem chi tiết trước khi đi →")+'</a>'+ 
          '<button type="button" class="opq-feedback-trigger" data-openpq-feedback data-feedback-id="'+esc(x.id)+'" data-feedback-name="'+esc(x.name)+'" data-feedback-type="'+esc(x.id.startsWith("activity_")?"activity":"place")+'">Góp ý thông tin</button></article>';
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
    renderFood(pick);
    const blocked=view.excluded||[];
    const box=$("#goExcluded");
    if(blocked.length){
      box.hidden=false;
      box.innerHTML='<strong>Một vài nơi chưa hợp lịch hôm nay</strong><p>'+esc(blocked.slice(0,5).map(x=>x.reason).filter((v,i,a)=>a.indexOf(v)===i).join(" · "))+'</p>';
    }else box.hidden=true;
  }

  function nearmeHandoffRoute(category){
    const params=new URLSearchParams({category,area:state.originZone||"all"});
    return "/nearme/?"+params.toString();
  }

  function mapRows(){
    const canonical=[...state.entities.values()].map(e=>({...e,route:"/places/detail.html?id="+encodeURIComponent(e.slug||e.legacy_id||e.id.replace(/^(place|activity)_/,""))}));
    const nearRows=state.locationIndex.filter(e=>["place","activity"].includes(e.entity_type)&&e.map);
    const venueRows=state.venueDirectory.filter(e=>e.status==="ACTIVE"&&["LOCAL_FOOD","RESTAURANT","CAFE"].includes(e.category))
      .map(e=>({...e,map:{lat:e.latitude,lon:e.longitude,precision:e.geo_precision||e.map?.precision,verified_at:e.verified_at},
        route:nearmeHandoffRoute(e.category)}));
    const seen=new Set();
    return [...canonical,...nearRows,...venueRows].filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true});
  }
  function syncRadiusControls(){
    $("#goRadiusValue").textContent=state.radiusKm+" km";
    $("#goRadiusRange").value=String(state.radiusKm);
    document.querySelectorAll("#goRadiusButtons button").forEach(btn=>{
      const on=Number(btn.dataset.km)===state.radiusKm;
      btn.classList.toggle("active",on);
      btn.setAttribute("aria-pressed",String(on));
    });
  }
  function drawMap(){
    const geo=window.OpenPQGoGeo;
    const selectedPoint=state.position||geo?.anchors?.[state.originZone];
    const hasOrigin=!!geo?.valid(selectedPoint);
    const controls=$("#goRadiusControls"),prompt=$("#goMapPrompt"),reset=$("#goMapReset");
    if(controls)controls.hidden=state.mapOverview||!hasOrigin;
    if(prompt)prompt.hidden=hasOrigin;
    if(reset)reset.hidden=!hasOrigin;
    if(state.mapOverview){
      $("#goMapReset").textContent="Về khu vực đã chọn";
      $("#goMapMode").textContent="Đang xem toàn đảo. Bạn có thể trở về khu vực đã chọn.";
      $("#goMapCount").textContent="Đang xem toàn đảo, chưa lọc theo khoảng cách.";
      try{
        if(window.OpenPQGoMap?.overview()===false)$("#goMapCount").textContent="Bản đồ chưa tải được; bạn vẫn có thể chọn khu vực.";
      }catch(error){
        console.warn("GO island overview map unavailable",error?.message||error);
        $("#goMapCount").textContent="Bản đồ chưa tải được; bạn vẫn có thể chọn khu vực.";
      }
      return;
    }
    $("#goMapReset").textContent="Xem toàn đảo";
    syncRadiusControls();
    const point=selectedPoint;
    if(!geo?.valid(point)){
      let available=false;
      try{available=window.OpenPQGoMap?.overview();}
      catch(error){console.warn("GO map fallback unavailable",error?.message||error);}
      $("#goMapReset").textContent="Xem toàn đảo";
      const areaName=zoneNames[state.originZone];
      if(state.position){
        $("#goMapMode").textContent="Đã nhận vị trí trong phiên này; bản đồ chưa sẵn sàng.";
        $("#goMapCount").textContent="Bạn vẫn có thể tiếp tục gợi ý theo khu vực thủ công.";
      }else if(areaName){
        $("#goMapMode").textContent="Đã chọn "+areaName+". Bản đồ chưa sẵn sàng; tâm khu vực không phải GPS.";
        $("#goMapCount").textContent="Bản đồ chưa tải được; bạn vẫn có thể tiếp tục với khu vực đã chọn.";
      }else{
        $("#goMapMode").textContent="Chọn một khu vực để xem những nơi gần đó.";
        $("#goMapCount").textContent=available===false?"Bản đồ chưa tải được. Bạn vẫn có thể chọn khu vực.":"Chọn khu vực để xem những nơi gần đó.";
      }
      return;
    }
    const gps=!!state.position;
    const areaName=zoneNames[state.originZone]||"khu vực đã chọn";
    const modeText=gps?
      "Những nơi trong "+state.radiusKm+" km quanh vị trí của bạn.":
      areaName+" · "+state.radiusKm+" km tính từ trung tâm khu vực.";
    // Update copy before drawing so a map failure never leaves stale island-wide instructions.
    $("#goMapMode").textContent=modeText;
    let result;
    try{
      result=window.OpenPQGoMap?.draw(point,state.radiusKm,mapRows(),{gps});
    }catch(error){
      console.warn("GO radius map drawing failed",error?.message||error);
      result={map:false,shown:0};
    }
    if(!result||result.map===false){
      $("#goMapCount").textContent="Bản đồ chưa tải được; bạn vẫn có thể chọn khu vực và nhận gợi ý.";
    }else{
      $("#goMapCount").textContent=(result.shown||0)+" địa điểm có vị trí trên bản đồ"+(gps?" quanh bạn.":" quanh "+areaName+".");
    }
  }
  function geoError(error){
    if(error?.code===1)return "Bạn chưa cho phép dùng vị trí. Vẫn có thể chọn khu vực bên trên nhé.";
    if(error?.code===2)return "Điện thoại chưa xác định được vị trí. Bạn thử lại hoặc chọn khu vực.";
    if(error?.code===3)return "Định vị mất hơi lâu. Thử lại khi GPS ổn định hoặc chọn khu vực.";
    return "Chưa lấy được vị trí, bạn cứ chọn khu vực bên trên.";
  }
  function bindGeo(){
    $("#goLocate").addEventListener("click",()=>{
      if(!navigator.geolocation){
        $("#goLocationStatus").textContent="Thiết bị này chưa hỗ trợ định vị. Bạn chọn khu vực bên trên nhé.";return;
      }
      const button=$("#goLocate");
      button.disabled=true;button.textContent="Đang tìm vị trí...";
      navigator.geolocation.getCurrentPosition(({coords})=>{
        button.disabled=false;button.innerHTML='<span aria-hidden="true">⌖</span> Cập nhật vị trí';
        const point={lat:coords.latitude,lon:coords.longitude};
        if(!window.OpenPQGoGeo?.valid(point)){
          $("#goLocationStatus").textContent="Bạn đang ở ngoài phạm vi Phú Quốc. Hãy chọn khu vực thủ công nhé.";return;
        }
        state.position=point;
        state.mapOverview=false;
        state.originZone=window.OpenPQGoGeo.nearestArea(point);
        if(state.originZone)window.OpenPQArea?.set(state.originZone,"go-gps-coarse");
        document.querySelectorAll('#areaChoices input[name="origin"]').forEach(input=>{
          input.checked=input.value===state.originZone;
        });
        $("#goLocationStatus").textContent="Đã tìm thấy vị trí. Đang dùng khoảng cách đường chim bay; thời gian đi đường chỉ là ước lượng.";
        drawMap();
        if(!$("#resultsSection").hidden)run();
      },error=>{
        button.disabled=false;button.innerHTML='<span aria-hidden="true">⌖</span> Dùng vị trí của tôi';
        $("#goLocationStatus").textContent=geoError(error);
      },{enableHighAccuracy:true,maximumAge:60000,timeout:12000});
    });
    $("#areaChoices").addEventListener("change",event=>{
      if(event.target.name!=="origin")return;
      state.originZone=event.target.value;
      window.OpenPQArea?.set(state.originZone,"go-manual");
      if(state.position){
        state.position=null;
        $("#goLocate").innerHTML='<span aria-hidden="true">⌖</span> Dùng vị trí của tôi';
      }
      state.mapOverview=false;
      $("#goLocationStatus").textContent="Đã chọn "+(zoneNames[state.originZone]||"khu vực")+". Khoảng cách tính từ trung tâm khu vực, không phải vị trí của bạn.";
      drawMap();
      if(!$("#resultsSection").hidden)run();
    });
    const mapPrompt=$("#goMapPrompt");
    if(mapPrompt)mapPrompt.addEventListener("click",event=>{
      const button=event.target.closest("button[data-go-map-area]");
      if(!button)return;
      const id=button.dataset.goMapArea;
      if(!["zone_central_west","zone_south","zone_north"].includes(id))return;
      const input=[...document.querySelectorAll('#areaChoices input[name="origin"]')]
        .find(x=>x.value===id);
      if(!input)return;
      input.checked=true;
      input.dispatchEvent(new Event("change",{bubbles:true}));
    });
    $("#goRadiusButtons").addEventListener("click",event=>{
      const button=event.target.closest("button[data-km]");if(!button)return;
      state.radiusKm=Number(button.dataset.km);state.mapOverview=false;drawMap();
      if(state.position&&!$("#resultsSection").hidden)run();
    });
    $("#goRadiusRange").addEventListener("input",event=>{
      state.radiusKm=Math.min(50,Math.max(1,Math.round(Number(event.target.value)||5)));
      state.mapOverview=false;drawMap();
    });
    $("#goRadiusRange").addEventListener("change",()=>{
      if(state.position&&!$("#resultsSection").hidden)run();
    });
    $("#goMapReset").addEventListener("click",()=>{
      state.mapOverview=!state.mapOverview;
      drawMap();
    });
  }
  function renderFood(pick){
    const section=$("#goFoodNear");
    section.hidden=!(pick.interest==="food"||pick.interest==="all");
    if(section.hidden)return;
    const area=pick.originZone;
    $("#goLocalFoodLink").href="../nearme/?category=LOCAL_FOOD&area="+encodeURIComponent(area);
    $("#goCafeLink").href="../nearme/?category=CAFE&area="+encodeURIComponent(area);
    const geo=window.OpenPQGoGeo;
    const actualFood=state.venueDirectory.filter(e=>e.status==="ACTIVE"&&["LOCAL_FOOD","RESTAURANT","CAFE"].includes(e.category))
      .map(e=>({name:e.name,category:e.category,zone_id:geo?.nearestArea({lat:e.latitude,lon:e.longitude}),
        km:state.position?geo?.distanceKm(state.position,{lat:e.latitude,lon:e.longitude}):null,
        verified:!!e.verified_at&&!!geo?.destinationPoint({...e,map:{lat:e.latitude,lon:e.longitude,precision:e.geo_precision||e.map?.precision}})}))
      .filter(e=>e.verified&&(state.position?e.km!==null&&e.km<=state.radiusKm:e.zone_id===area))
      .sort((a,b)=>(a.km??0)-(b.km??0)).slice(0,4);
    $("#goFoodNearNote").textContent=actualFood.length
      ?"Một vài địa chỉ có tọa độ trong danh bạ: "+actualFood.map(x=>x.name+(x.km!==null?" ("+x.km.toFixed(1)+" km)":"")).join(" · ")+". Kiểm tra giờ mở cửa trước khi ghé."
      :"Danh bạ Quanh đây có mục tìm quán ăn và cà phê theo khu vực. Chưa có danh sách quán xác minh tọa độ để tính khoảng cách chính xác.";
  }

  $("#goForm").addEventListener("submit",e=>{e.preventDefault();run()});
  $("#changeChoices").addEventListener("click",()=>$(".go-builder").scrollIntoView({behavior:"smooth",block:"start"}));
  clock();setInterval(clock,30000);
  applyDeepLink();
  // Bind manual controls and optional GPS immediately, even if feeds are delayed.
  bindGeo();
  drawMap();
  load().catch(()=>{
    // Never delete the manual controls when a feed fails.
    $("#goLocationStatus").textContent="Chưa tải được danh sách địa điểm. Bạn vẫn có thể chọn khu vực và xem bản đồ; thử tải lại để nhận gợi ý.";
  });
})();