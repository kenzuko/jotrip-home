/* Open Phu Quoc Today Engine v2 - pure composition layer. */
(function(global){
  function item(id,type,title,summary,status,route,meta){
    return {id:id,type:type,title:title,summary:summary,status:status||"info",route:route||null,meta:meta||{}};
  }

  function localHour(now){
    try{
      const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Ho_Chi_Minh",hour:"2-digit",hour12:false}).formatToParts(now||new Date());
      const part=parts.find(function(p){return p.type==="hour"});
      const h=Number(part&&part.value);
      return Number.isFinite(h)?h:new Date(now||Date.now()).getHours();
    }catch(e){
      return new Date(now||Date.now()).getHours();
    }
  }

  function build(input){
    input=input||{};
    const live=input.live||{};
    const signals=input.signals||{};
    const rules=Array.isArray(input.rules)?input.rules:[];
    const hour=localHour(input.now);
    const out=[];

    const wx=live.weather||{};
    if(wx.freshness==="stale" || wx.status==="unknown"){
      out.push(item("weather-stale","WEATHER","Thời tiết chưa có cập nhật mới","Mở Thời tiết & Biển để xem lần cập nhật gần nhất.","unknown","/weather/",{freshness:wx.freshness||"unknown"}));
    }else if(wx.status==="watch"){
      out.push(item("weather-watch","WEATHER","Thời tiết cần theo dõi","Thời tiết có dấu hiệu cần chú ý trước khi chọn hoạt động ngoài trời.","watch","/weather/",{convective_levels:signals.convective_levels||[]}));
    }else if(wx.status==="advisory"){
      out.push(item("weather-rain","WEATHER","Có mưa được ghi nhận","Giữ lịch linh hoạt và xem chi tiết khu vực trước khi di chuyển.","advisory","/weather/",{}));
    }else{
      out.push(item("weather-normal","WEATHER","Chưa thấy cảnh báo thời tiết nổi bật",wx.secondary||"Xem Thời tiết & Biển nếu hoạt động phụ thuộc biển hoặc mưa.","normal","/weather/",{}));
    }

    const ferry=live.ferry||{};
    const marine=live.marine||{};
    const transport=live.transport||{};
    const transportStatus=transport.status||((ferry.status==="unknown"&&marine.status==="unknown")?"unknown":(ferry.status==="watch"||marine.status==="watch")?"watch":"normal");
    const stateLabel=value=>({DIRECT_CONFIRMED:"Chạy bình thường",FIELD_REQUIRED:"Chưa rõ hôm nay",RUNNING:"Chạy bình thường",SUSPENDED:"Tạm dừng",UNKNOWN:"Chưa rõ"})[value]||"Chưa rõ";
    const transportSummary="Cano: "+stateLabel(signals.cano_state)+" · Tàu cao tốc: "+stateLabel(signals.fast_boat_state)+" · Phà: "+stateLabel(signals.ferry_state);
    if(transportStatus==="unknown"){
      out.push(item("marine-unknown","TRANSPORT","Cano, tàu và phà chưa có cập nhật mới","Mở Tàu & Phà để xem thông tin hôm nay.","unknown","/ferry/",{}));
    }else if(transportStatus==="watch"){
      out.push(item("marine-watch","TRANSPORT","Có dịch vụ biển cần xem lại",transportSummary,"watch","/ferry/",{}));
    }else{
      out.push(item("marine-status","TRANSPORT","Hôm nay chưa thấy gián đoạn lớn",transportSummary,"normal","/ferry/",{}));
    }

    const airport=live.airport||{};
    if(airport.status==="unknown"){
      out.push(item("airport-unknown","AIRPORT","Sân bay chưa có cập nhật mới","Mở Sân bay để xem các chuyến hôm nay.","unknown","/airport/",{}));
    }else if(airport.status==="watch"){
      out.push(item("airport-watch","AIRPORT",airport.primary||"Có chuyến bay cần theo dõi",(signals.airport_total==null?"-":signals.airport_total)+" chuyến trong bảng hiện tại.","watch","/airport/",{}));
    }else{
      out.push(item("airport-normal","AIRPORT","Sân bay chưa thấy gián đoạn nổi bật",(signals.airport_total==null?"-":signals.airport_total)+" chuyến trong bảng hiện tại.","normal","/airport/",{}));
    }

    const activeRule=rules.find(function(r){
      return hour>=Number(r.start_hour)&&hour<Number(r.end_hour);
    });
    if(activeRule){
      const unsafeWeather=activeRule.weather_sensitive && (wx.status==="watch" || wx.status==="unknown");
      if(!unsafeWeather){
        out.push(item("editorial-"+activeRule.id,"EDITORIAL",activeRule.title,activeRule.summary,"info",activeRule.route,{
          source_type:activeRule.source_type,
          source_id:activeRule.source_id
        }));
      }
    }

    if(live.sunset&&live.sunset.primary){
      out.push(item("sunset","ASTRONOMICAL","Hoàng hôn bờ Tây khoảng "+live.sunset.primary,"Giờ thiên văn để định hướng cuối chiều, không phải cam kết trời quang.","info","/#happening",{}));
    }

    return {generated_at:new Date().toISOString(),hour:hour,items:out.slice(0,5)};
  }

  global.OpenPQTodayEngineV2={build:build};
})(window);
