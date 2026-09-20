(()=>{
  "use strict";
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const fold=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").toLowerCase();
  const params=new URLSearchParams(location.search);
  const state={hotels:[],query:params.get("q")||"",area:params.get("area")||"all",star:params.get("star")||"all",status:params.get("status")||"active",hotel:params.get("hotel")||""};

  function publicStatus(x){return x.operational_status==="active"?"Đang hoạt động":"Sắp mở hoặc đã công bố"}
  function starText(x){return x.star_rating!=null&&Number.isFinite(Number(x.star_rating))?Number(x.star_rating)+" sao":"Chưa xác định hạng"}
  function phoneHref(phone){return "tel:"+String(phone||"").split(";")[0].replace(/[^0-9+]/g,"")}
  function filtered(){
    const q=fold(state.query);
    return state.hotels.filter(x=>{
      if(state.hotel && x.slug!==state.hotel) return false;
      if(state.status!=="all" && x.operational_status!==state.status) return false;
      if(state.area!=="all" && x.area_label!==state.area) return false;
      if(state.star==="unknown" && x.star_rating!=null) return false;
      if(!["all","unknown"].includes(state.star) && Number(x.star_rating)!==Number(state.star)) return false;
      if(q && !fold([x.name,x.area_label,x.address,...(x.aliases||[])].join(" ")).includes(q)) return false;
      return true;
    });
  }
  function syncUrl(){
    const q=new URLSearchParams();
    if(state.query) q.set("q",state.query);
    if(state.area!=="all") q.set("area",state.area);
    if(state.star!=="all") q.set("star",state.star);
    if(state.status!=="active") q.set("status",state.status);
    if(state.hotel) q.set("hotel",state.hotel);
    history.replaceState(null,"",location.pathname+(q.toString()?"?"+q.toString():""));
  }
  function card(x){
    const upcoming=x.operational_status!=="active";
    const rooms=x.room_count?Number(x.room_count).toLocaleString("vi-VN"):"Chưa công bố";
    return '<article class="hotel-card" data-hotel="'+esc(x.slug)+'">'+
      '<div class="hotel-card-top"><span class="hotel-star">'+esc(starText(x))+'</span><span class="hotel-status '+(upcoming?'upcoming':'')+'">'+esc(publicStatus(x))+'</span></div>'+
      '<h3>'+esc(x.name)+'</h3><p class="hotel-area">'+esc(x.area_label||"Khu vực đang cập nhật")+'</p>'+
      '<p class="hotel-desc">'+esc(x.what_it_is||"Nơi lưu trú tại Phú Quốc.")+'</p>'+
      '<div class="hotel-facts"><div><span>Loại hình</span><strong>'+esc(x.accommodation_type||"Cơ sở lưu trú")+'</strong></div><div><span>Quy mô</span><strong>'+esc(rooms)+(x.room_count?' phòng':'')+'</strong></div></div>'+
      '<div class="hotel-actions">'+(x.website?'<a class="primary" href="'+esc(x.website)+'" target="_blank" rel="noopener">Website chính thức ↗</a>':'')+(x.phone?'<a href="'+phoneHref(x.phone)+'">Gọi cơ sở</a>':'')+'</div></article>';
  }
  function render(){
    const rows=filtered();
    $("#resultTitle").textContent=rows.length+" cơ sở phù hợp";
    $("#resultEyebrow").textContent=state.hotel?"KẾT QUẢ ĐƯỢC CHỌN":state.status==="active"?"ĐANG HOẠT ĐỘNG":state.status==="upcoming"?"SẮP MỞ HOẶC ĐÃ CÔNG BỐ":"TẤT CẢ TRẠNG THÁI";
    $("#hotelGrid").innerHTML=rows.length?rows.map(card).join(""):'<div class="loading">Chưa có cơ sở phù hợp. Hãy thử bỏ bớt một điều kiện lọc.</div>';
  }
  function bind(){
    $("#hotelSearch").value=state.query;
    $("#areaFilter").value=state.area;
    $("#starFilter").value=state.star;
    $("#statusFilter").value=state.status;
    $("#hotelSearch").addEventListener("input",e=>{state.query=e.target.value;state.hotel="";syncUrl();render()});
    $("#areaFilter").addEventListener("change",e=>{state.area=e.target.value;state.hotel="";syncUrl();render()});
    $("#starFilter").addEventListener("change",e=>{state.star=e.target.value;state.hotel="";syncUrl();render()});
    $("#statusFilter").addEventListener("change",e=>{state.status=e.target.value;state.hotel="";syncUrl();render()});
    $("#clearFilters").addEventListener("click",()=>{Object.assign(state,{query:"",area:"all",star:"all",status:"active",hotel:""});bindValues();syncUrl();render()});
  }
  function bindValues(){$("#hotelSearch").value=state.query;$("#areaFilter").value=state.area;$("#starFilter").value=state.star;$("#statusFilter").value=state.status}

  fetch("../data/entities/hotels.json?t="+Date.now(),{cache:"no-store"}).then(r=>r.json()).then(data=>{
    state.hotels=data.entities||[];
    const areas=[...new Set(state.hotels.map(x=>x.area_label).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"vi"));
    $("#areaFilter").innerHTML='<option value="all">Tất cả khu vực</option>'+areas.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");
    if(state.hotel){const selected=state.hotels.find(x=>x.slug===state.hotel);if(selected)state.status=selected.operational_status||"all";else state.hotel=""}
    bind();render();
  }).catch(()=>{$("#resultTitle").textContent="Chưa tải được danh sách";$("#hotelGrid").innerHTML='<div class="loading">Thông tin khách sạn đang tạm thời chưa tải được. Vui lòng thử lại sau.</div>'});
})();
